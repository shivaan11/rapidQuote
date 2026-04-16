import { getAnthropic, PROMPT_FUSION_MODEL } from "./anthropic";
import { MASTER_PROMPT, buildUserMessage } from "./prompts/master-prompt";
import type { StrokeCounts } from "./types";

type FusionResult = {
  finalPrompt: string;
  reasoning: string;
  masterPrompt: string;
  userMessage: string;
};

export async function fusePrompt(
  counts: StrokeCounts,
  notes: string,
): Promise<FusionResult> {
  const client = getAnthropic();
  const userMessage = buildUserMessage(counts, notes);

  const response = await client.messages.create({
    model: PROMPT_FUSION_MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: MASTER_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const parsed = JSON.parse(text) as { finalPrompt: string; reasoning: string };
    if (!parsed.finalPrompt) {
      throw new Error("Missing finalPrompt in fusion response");
    }
    return {
      finalPrompt: parsed.finalPrompt,
      reasoning: parsed.reasoning,
      masterPrompt: MASTER_PROMPT,
      userMessage,
    };
  } catch {
    return {
      finalPrompt: text,
      reasoning: "Failed to parse JSON — using raw response as prompt",
      masterPrompt: MASTER_PROMPT,
      userMessage,
    };
  }
}
