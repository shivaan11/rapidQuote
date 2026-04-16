-- Store the actual prompts sent to Claude (master + user message) and to
-- Gemini (fused prompt), plus the image model ID used. Makes it possible to
-- audit or replay any past generation. Also keep fusion_log around for the
-- older reasoning dump — harmless to have both for a while.

alter table public.generations
  add column if not exists master_prompt text,
  add column if not exists user_message  text,
  add column if not exists fused_prompt  text,
  add column if not exists fusion_reasoning text,
  add column if not exists image_model   text;
