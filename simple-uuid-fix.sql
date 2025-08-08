-- CLEAN UUID CONVERSION - Run this entire script at once
-- This will completely reset the chat_rooms table with proper UUID support

-- Step 1: Drop all existing policies first (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Anyone can view rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.chat_rooms;
DROP POLICY IF EXISTS "Enable insert for all authenticated users" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can update own rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can delete own rooms" ON public.chat_rooms;

-- Step 2: Create new table with UUID structure
DROP TABLE IF EXISTS public.chat_rooms_new;
CREATE TABLE public.chat_rooms_new (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Insert the General room with a specific UUID
INSERT INTO public.chat_rooms_new (id, name, created_by, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'General', 'system', NOW());

-- Step 4: Update only NULL room_id values to point to General room
-- (Since room_id is already UUID type, we only handle NULLs)
UPDATE public.messages 
SET room_id = '00000000-0000-0000-0000-000000000001'
WHERE room_id IS NULL;

-- Step 5: Replace old table with new one
DROP TABLE public.chat_rooms CASCADE;
ALTER TABLE public.chat_rooms_new RENAME TO chat_rooms;

-- Step 6: Enable RLS and create fresh policies
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select_policy" ON public.chat_rooms
    FOR SELECT USING (true);

CREATE POLICY "rooms_insert_policy" ON public.chat_rooms
    FOR INSERT WITH CHECK (true);

CREATE POLICY "rooms_update_policy" ON public.chat_rooms
    FOR UPDATE USING (true);

CREATE POLICY "rooms_delete_policy" ON public.chat_rooms
    FOR DELETE USING (true);

-- Step 7: Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;

-- Step 8: Verification
SELECT 'FINAL RESULT - chat_rooms:' as info, id, name, created_by FROM public.chat_rooms;
SELECT 'FINAL RESULT - messages:' as info, COUNT(*) as message_count, room_id FROM public.messages GROUP BY room_id;
