-- Add room_id column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS room_id TEXT DEFAULT 'general';

-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default general room
INSERT INTO public.chat_rooms (id, name, created_by, created_at)
VALUES ('general', 'General', 'system', NOW())
ON CONFLICT (id) DO NOTHING;

-- Enable row level security
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view rooms" ON public.chat_rooms
    FOR SELECT USING (true);

CREATE POLICY "Users can create rooms" ON public.chat_rooms
    FOR INSERT WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_rooms;
