import { getSupabaseServer } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ResultView from "@/components/ResultView";

export default async function ResultPage(
  props: PageProps<"/result/[sessionId]/[genId]">,
) {
  const { sessionId, genId } = await props.params;

  const supabase = getSupabaseServer();

  const [{ data: session }, { data: generation }, { data: allGenerations }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("id, original_url, label")
        .eq("id", sessionId)
        .single(),
      supabase
        .from("generations")
        .select("id, status, result_url, annotated_url, fusion_log, error")
        .eq("id", genId)
        .single(),
      supabase
        .from("generations")
        .select("id, status, result_url, created_at")
        .eq("session_id", sessionId)
        .eq("status", "complete")
        .order("created_at", { ascending: false }),
    ]);

  if (
    !session ||
    !generation ||
    generation.status !== "complete" ||
    !generation.result_url
  ) {
    notFound();
  }

  const generationOptions = (allGenerations ?? []).map((g, i) => ({
    id: g.id,
    resultUrl: g.result_url!,
    label: `Generation ${(allGenerations?.length ?? 0) - i}`,
    createdAt: g.created_at,
  }));

  return (
    <ResultView
      sessionId={session.id}
      genId={generation.id}
      originalUrl={session.original_url}
      resultUrl={generation.result_url}
      annotatedUrl={generation.annotated_url ?? undefined}
      label={session.label ?? undefined}
      generations={generationOptions}
    />
  );
}
