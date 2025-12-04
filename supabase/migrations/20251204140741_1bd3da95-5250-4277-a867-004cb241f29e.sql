-- Allow a global public board that is not tied to a specific auth user
ALTER TABLE public.boards
  DROP CONSTRAINT IF EXISTS boards_owner_id_fkey;

ALTER TABLE public.boards
  ALTER COLUMN owner_id DROP NOT NULL;