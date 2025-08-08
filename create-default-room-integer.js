import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createDefaultRoomWithIntegerId() {
  try {
    console.log('Creating default "general" room with integer ID...');
    
    // Check if any room named "General" already exists
    const { data: existingRoom, error: checkError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('name', 'General')
      .single();
    
    if (existingRoom) {
      console.log('✅ General room already exists:', existingRoom);
      return existingRoom;
    }
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means "no rows returned" which is expected if room doesn't exist
      throw checkError;
    }
    
    // Insert the default general room (let Supabase auto-generate the integer ID)
    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{
        name: 'General',
        created_by: 'system',
        created_at: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error('❌ Error creating room:', error);
      throw error;
    }
    
    console.log('✅ Default "general" room created successfully:', data[0]);
    
    return data[0];
    
  } catch (error) {
    console.error('❌ Failed to create default room:', error.message);
    process.exit(1);
  }
}

// Run the script
createDefaultRoomWithIntegerId()
  .then((room) => {
    console.log('🎉 Script completed successfully!');
    console.log('📋 Room created with ID:', room.id);
    console.log('⚠️  NOTE: You may need to update your app to use integer room IDs instead of "general"');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
