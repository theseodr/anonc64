-- Add IP and RDNS columns to messages for per-message network identity
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS rdns text;