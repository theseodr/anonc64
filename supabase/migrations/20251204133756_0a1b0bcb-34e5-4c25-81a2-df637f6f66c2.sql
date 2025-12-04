-- Add server-side abuse protections for messages and strokes

-- Limit chat message length via RLS policy (max 4096 characters)
DROP POLICY IF EXISTS "Users can post messages on accessible boards" ON public.messages;

CREATE POLICY "Users can post messages on accessible boards"
ON public.messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE
      b.id = messages.board_id
      AND (
        b.owner_id = auth.uid()
        OR b.visibility = 'public'::board_visibility
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
  AND ((user_id = auth.uid()) OR (user_id IS NULL))
  AND char_length(content) <= 4096
);

-- Limit stroke payload size via RLS policy (max ~2MB JSON payload)
DROP POLICY IF EXISTS "Users can add strokes to accessible boards" ON public.strokes;

CREATE POLICY "Users can add strokes to accessible boards"
ON public.strokes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.boards b
    WHERE
      b.id = strokes.board_id
      AND (
        b.owner_id = auth.uid()
        OR b.visibility = 'public'::board_visibility
        OR has_role(auth.uid(), 'admin'::app_role)
      )
  )
  AND ((user_id = auth.uid()) OR (user_id IS NULL))
  AND octet_length(path_data::text) <= 2000000
);
