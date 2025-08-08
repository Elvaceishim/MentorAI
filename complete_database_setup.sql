-- Complete MentorAI Database Setup Script
-- Run this in your Supabase SQL Editor

-- 1. Add room_id column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS room_id TEXT DEFAULT 'general';

-- 2. Create chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert default general room
INSERT INTO public.chat_rooms (id, name, created_by, created_at)
VALUES ('general', 'General', 'system', NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_email, emoji)
);

-- 5. Add edited_at column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;

-- 6. Add file columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- 7. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_emoji TEXT DEFAULT '👤',
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Enable Row Level Security on all tables
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for chat_rooms
CREATE POLICY "Anyone can view rooms" ON public.chat_rooms
    FOR SELECT USING (true);

CREATE POLICY "Users can create rooms" ON public.chat_rooms
    FOR INSERT WITH CHECK (true);

-- 10. Create RLS policies for message_reactions
CREATE POLICY "Anyone can view reactions" ON public.message_reactions
    FOR SELECT USING (true);

CREATE POLICY "Users can add their own reactions" ON public.message_reactions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can remove their own reactions" ON public.message_reactions
    FOR DELETE USING (true);

-- 11. Create RLS policies for user_profiles
CREATE POLICY "Anyone can view profiles" ON public.user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can create their own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.jwt() ->> 'email' = user_email);

-- 12. Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profiles;

-- 13. Create storage bucket for message files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('message-files', 'message-files', true)
ON CONFLICT (id) DO NOTHING;

-- 14. Create storage policies for message files
CREATE POLICY "Anyone can upload message files" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'message-files');

CREATE POLICY "Anyone can view message files" ON storage.objects 
FOR SELECT USING (bucket_id = 'message-files');

CREATE POLICY "Users can delete their own files" ON storage.objects 
FOR DELETE USING (bucket_id = 'message-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 15. Update existing messages to have room_id
UPDATE public.messages SET room_id = 'general' WHERE room_id IS NULL;

-- 16. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(user_email);

-- Setup complete! Your MentorAI database is now ready.
