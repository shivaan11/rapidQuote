-- Track which image provider actually produced each generation, and whether
-- the primary (Gemini) call failed and the backup (FLUX Kontext) took over.
-- Lets us monitor how often upstream Gemini outages hit the client.

alter table public.generations
  add column if not exists used_model    text,
  add column if not exists fallback_used boolean not null default false,
  add column if not exists primary_error text;
