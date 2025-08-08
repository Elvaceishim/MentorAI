import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey);

try {
  console.log('Checking current table structure...');
  
  // Check what's currently in chat_rooms
  const { data: currentRooms, error: roomsError } = await supabase
    .from('chat_rooms')
    .select('*');
  
  console.log('Current rooms:', { currentRooms, roomsError });
  
  if (roomsError) {
    console.log('Error accessing chat_rooms. The table might not exist or have wrong structure.');
    console.log('Please ensure the chat_rooms table has these exact columns:');
    console.log('- id (TEXT, PRIMARY KEY)');
    console.log('- name (TEXT, NOT NULL)'); 
    console.log('- created_by (TEXT, NOT NULL)');
    console.log('- created_at (TIMESTAMP WITH TIME ZONE)');
    process.exit(1);
  }
  
  // Try to insert default room
  console.log('Inserting default "general" room...');
  const { data, error } = await supabase
    .from('chat_rooms')
    .upsert([{
      id: 'general',
      name: 'General',
      created_by: 'system',
      created_at: new Date().toISOString()
    }], {
      onConflict: 'id'
    })
    .select();
    
  if (error) {
    console.error('Error inserting default room:', error);
    console.log('\nPlease check that your chat_rooms table has the correct column structure.');
  } else {
    console.log('Default room created successfully:', data);
  }
  
  // Final check
  const { data: finalRooms, error: finalError } = await supabase
    .from('chat_rooms')
    .select('*');
  console.log('Final rooms state:', { finalRooms, finalError });
  
} catch (e) {
  console.error('Unexpected error:', e);
}
