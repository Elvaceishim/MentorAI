-- Convert chat_rooms table ID from INTEGER to UUID to match messages.room_id
-- The messages table already uses UUID for room_id, so we need to fix chat_rooms

-- Step 1: Create a temporary mapping table to preserve data relationships
CREATE TEMP TABLE room_id_mapping AS
SELECT id as old_id, gen_random_uuid() as new_uuid
FROM public.chat_rooms;

-- Step 2: Add new UUID column to chat_rooms
ALTER TABLE public.chat_rooms ADD COLUMN new_id UUID;

-- Step 3: Update with the generated UUIDs
UPDATE public.chat_rooms 
SET new_id = room_id_mapping.new_uuid
FROM room_id_mapping 
WHERE public.chat_rooms.id = room_id_mapping.old_id;

-- Step 4: Update any existing messages that might reference the old integer IDs
-- (This handles any messages that might have integer values in UUID column)
UPDATE public.messages 
SET room_id = room_id_mapping.new_uuid::text
FROM room_id_mapping 
WHERE public.messages.room_id = room_id_mapping.old_id::text;

-- Step 5: Drop old ID column and rename new UUID column
ALTER TABLE public.chat_rooms DROP CONSTRAINT chat_rooms_pkey CASCADE;
ALTER TABLE public.chat_rooms DROP COLUMN id;
ALTER TABLE public.chat_rooms RENAME COLUMN new_id TO id;

-- Step 6: Make UUID column the primary key
ALTER TABLE public.chat_rooms ADD PRIMARY KEY (id);

-- Step 7: Set a default UUID for any null room_id in messages
UPDATE public.messages 
SET room_id = (SELECT id::text FROM public.chat_rooms LIMIT 1)
WHERE room_id IS NULL;

-- Step 8: Recreate any foreign key constraints if they existed
-- (Add any specific constraints here if needed)

-- Verification query - run this to check the conversion worked
-- SELECT 'chat_rooms' as table_name, pg_typeof(id) as id_type FROM public.chat_rooms LIMIT 1
-- UNION ALL
-- SELECT 'messages' as table_name, pg_typeof(room_id) as room_id_type FROM public.messages LIMIT 1;
