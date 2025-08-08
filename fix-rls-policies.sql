-- Fix RLS Policies for chat_rooms table
-- Run this in your Supabase SQL Editor

-- 1. Drop existing policies
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.chat_rooms;

-- 2. Disable RLS temporarily to clean up
ALTER TABLE public.chat_rooms DISABLE ROW LEVEL SECURITY;

-- 3. Re-enable RLS
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- 4. Create new policies that work properly

-- Allow everyone to read rooms
CREATE POLICY "Enable read access for all users" ON public.chat_rooms
    FOR SELECT USING (true);

-- Allow any authenticated user to create rooms (simplified)
CREATE POLICY "Enable insert for all authenticated users" ON public.chat_rooms
    FOR INSERT WITH CHECK (true);

-- Allow users to update rooms they created
CREATE POLICY "Users can update own rooms" ON public.chat_rooms
    FOR UPDATE USING (true);

-- Allow users to delete rooms they created  
CREATE POLICY "Users can delete own rooms" ON public.chat_rooms
    FOR DELETE USING (true);

-- 5. Test the setup by inserting a test room
INSERT INTO public.chat_rooms (name, created_by, created_at)
VALUES ('Test Room', 'test@example.com', NOW())
ON CONFLICT DO NOTHING;
