import { readFile } from "fs/promises";
import path from "path";
import { config } from "./config";
import { geminiProvider } from "./providers/gemini";
import { fluxKontextProvider } from "./providers/flux";
import {
  ProviderRefusalError,
  type ImageProvider,
  type ProviderInput,
  type StickerRefs,
} from "./providers/types";

// Re-exported under the old names so existing imports keep working.
export { ProviderRefusalError as GeminiRefusalError };
export { ProviderRefusalError as ImageGenRefusalError };
export { ProviderRefusalError };

let cachedStickers: StickerRefs | null = null;

async function loadStickerRefs(): Promise<StickerRefs> {
  if (cachedStickers) return cachedStickers;
  const base = path.join(process.cwd(), "public", "stickers");
  const [uplight, downlight, pathlight] = await Promise.all([
    readFile(path.join(base, "uplight.png")),
    readFile(path.join(base, "downlight.png")),
    readFile(path.join(base, "pathlight.png")),
  ]);
  cachedStickers = { uplight, downlight, pathlight };
  return cachedStickers;
}

export type PipelineInput = {
  annotatedBytes: Buffer;
  annotatedUrl: string;
  prompt: string;
};

export type PipelineResult = {
  bytes: Buffer;
  usedModel: string;
  usedProvider: string;
  fallbackUsed: boolean;
  primaryError: string | null;
};

/**
 * Try the primary provider (Gemini Nano Banana Pro) first. If it throws for
 * any reason other than a content refusal, transparently fall back to the
 * backup provider (FLUX Kontext Pro on fal.ai). Refusals propagate — the
 * model actively rejecting the image isn't an availability issue, and
 * retrying on a different model usually won't help.
 */
export async function runImagePipeline(
  annotatedBytes: Buffer,
  finalPrompt: string,
  annotatedUrl?: string,
): Promise<PipelineResult> {
  const refs = await loadStickerRefs();
  const input: ProviderInput = {
    annotatedBytes,
    annotatedUrl: annotatedUrl ?? "",
    prompt: finalPrompt,
    refs,
  };

  const primary = geminiProvider;
  const backupAvailable = config.fal.configured();

  try {
    const bytes = await primary.generate(input);
    return {
      bytes,
      usedModel: primary.modelId,
      usedProvider: primary.name,
      fallbackUsed: false,
      primaryError: null,
    };
  } catch (err) {
    if (err instanceof ProviderRefusalError) throw err;

    const primaryError = err instanceof Error ? err.message : String(err);
    console.warn(
      `[pipeline] primary (${primary.name} / ${primary.modelId}) failed: ${primaryError}`,
    );

    if (!backupAvailable) {
      console.warn("[pipeline] no backup provider configured (FAL_KEY missing)");
      throw err;
    }

    if (!annotatedUrl) {
      console.warn("[pipeline] backup requires annotatedUrl, none provided");
      throw err;
    }

    return runBackup(fluxKontextProvider, input, primaryError);
  }
}

async function runBackup(
  provider: ImageProvider,
  input: ProviderInput,
  primaryError: string,
): Promise<PipelineResult> {
  console.warn(`[pipeline] falling back to ${provider.name} / ${provider.modelId}`);
  const bytes = await provider.generate(input);
  return {
    bytes,
    usedModel: provider.modelId,
    usedProvider: provider.name,
    fallbackUsed: true,
    primaryError,
  };
}
