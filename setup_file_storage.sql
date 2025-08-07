-- Create storage bucket for message files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('message-files', 'message-files', true);

-- Set up storage policies for message files bucket
CREATE POLICY "Anyone can upload message files" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'message-files');

CREATE POLICY "Anyone can view message files" ON storage.objects 
FOR SELECT USING (bucket_id = 'message-files');

CREATE POLICY "Users can delete their own files" ON storage.objects 
FOR DELETE USING (bucket_id = 'message-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add file-related columns to messages table if they don't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT;
