-- Create table for draggable shared video tiles on boards
CREATE TABLE IF NOT EXISTS public.video_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  user_id uuid NULL,
  source_type public.video_source_type NOT NULL,
  youtube_video_id text NULL,
  file_path text NULL,
  start_at_seconds integer DEFAULT 0,
  x numeric NOT NULL DEFAULT 80,
  y numeric NOT NULL DEFAULT 60,
  width numeric NOT NULL DEFAULT 320,
  height numeric NOT NULL DEFAULT 180,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_tiles
  ADD CONSTRAINT video_tiles_board_id_fkey
  FOREIGN KEY (board_id)
  REFERENCES public.boards(id)
  ON DELETE CASCADE;

-- Enable RLS on video_tiles
ALTER TABLE public.video_tiles ENABLE ROW LEVEL SECURITY;

-- Video tiles readable on accessible boards (same pattern as strokes/messages)
CREATE POLICY "Video tiles readable on accessible boards"
ON public.video_tiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = video_tiles.board_id
      AND (
        b.owner_id = auth.uid()
        OR b.visibility = 'public'::board_visibility
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- Users (including anonymous on the global public board) can manage tiles on accessible boards
CREATE POLICY "Users can manage video tiles on accessible boards"
ON public.video_tiles
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = video_tiles.board_id
      AND (
        b.owner_id = auth.uid()
        OR b.visibility = 'public'::board_visibility
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE b.id = video_tiles.board_id
      AND (
        b.owner_id = auth.uid()
        OR b.visibility = 'public'::board_visibility
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

-- Add table to realtime publication so all clients see tile changes live
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_tiles;

-- Create a public bucket for uploaded video files (if it doesn't exist yet)
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read video files from the "videos" bucket
CREATE POLICY "Video files are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'videos');

-- Allow anyone (including anonymous visitors) to upload video files into the "videos" bucket
CREATE POLICY "Anyone can upload video files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'videos');
