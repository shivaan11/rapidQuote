import { fal } from "@fal-ai/client";
import { config } from "../config";
import { ProviderRefusalError, type ImageProvider, type ProviderInput } from "./types";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  fal.config({ credentials: config.fal.apiKey() });
  configured = true;
}

type KontextResult = {
  data: {
    images?: Array<{ url: string; content_type?: string }>;
    has_nsfw_concepts?: boolean[];
  };
};

export const fluxKontextProvider: ImageProvider = {
  name: "flux-kontext",
  get modelId() {
    return config.fal.model();
  },

  async generate({ annotatedUrl, prompt }: ProviderInput): Promise<Buffer> {
    ensureConfigured();
    const endpointId = config.fal.model();

    // FLUX Kontext Pro takes one reference image. We pass the flattened
    // annotated Supabase URL; the prompt already describes fixture types,
    // so we don't need the 3 fixture reference PNGs on this path.
    const result = (await fal.subscribe(endpointId, {
      input: {
        prompt,
        image_url: annotatedUrl,
        output_format: "png",
        num_images: 1,
        safety_tolerance: "6",
      },
      logs: false,
    })) as KontextResult;

    const nsfw = result.data.has_nsfw_concepts?.some(Boolean);
    if (nsfw) {
      throw new ProviderRefusalError(
        "FLUX Kontext's safety filter rejected this image.",
      );
    }

    const first = result.data.images?.[0];
    if (!first?.url) {
      throw new Error("FLUX Kontext returned no image");
    }

    const res = await fetch(first.url);
    if (!res.ok) {
      throw new Error(`FLUX Kontext image fetch failed: ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  },
};
