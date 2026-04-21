export class ProviderRefusalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRefusalError";
  }
}

export type StickerRefs = {
  uplight: Buffer;
  downlight: Buffer;
  pathlight: Buffer;
};

export type ProviderInput = {
  annotatedBytes: Buffer;
  annotatedUrl: string;
  prompt: string;
  refs: StickerRefs;
};

export type ImageProvider = {
  name: string;
  modelId: string;
  generate(input: ProviderInput): Promise<Buffer>;
};
