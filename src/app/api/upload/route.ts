import { getSupabaseServer } from "@/lib/supabase";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid multipart body";
    return Response.json({ error: `Could not parse upload: ${msg}` }, { status: 400 });
  }

  const file = formData.get("image");

  if (!file || !(file instanceof Blob)) {
    return Response.json({ error: "Missing image field" }, { status: 400 });
  }

  if (file.size > 4_500_000) {
    return Response.json(
      { error: `Image too large (${(file.size / 1_000_000).toFixed(1)}MB). Max 4.5MB.` },
      { status: 413 },
    );
  }

  const supabase = getSupabaseServer();
  const sessionId = randomUUID();
  const storagePath = `${sessionId}/photo.jpg`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("originals")
    .upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return Response.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("originals").getPublicUrl(storagePath);

  const { error: insertError } = await supabase.from("sessions").insert({
    id: sessionId,
    original_url: publicUrl,
  });

  if (insertError) {
    return Response.json(
      { error: `DB insert failed: ${insertError.message}` },
      { status: 500 },
    );
  }

  return Response.json({ sessionId, originalUrl: publicUrl });
}
