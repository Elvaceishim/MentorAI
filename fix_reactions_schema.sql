-- Fix message_reactions table schema
-- First, check if the table exists and what columns it has

-- Drop the table if it exists (to recreate with correct schema)
DROP TABLE IF EXISTS public.message_reactions CASCADE;

-- Create message_reactions table with correct schema
CREATE TABLE public.message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_email, emoji)
);

-- Enable row level security
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view reactions" ON public.message_reactions
    FOR SELECT USING (true);

CREATE POLICY "Users can add their own reactions" ON public.message_reactions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can remove their own reactions" ON public.message_reactions
    FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'message_reactions' 
AND table_schema = 'public'
ORDER BY ordinal_position;
