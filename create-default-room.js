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

async function createDefaultRoom() {
  try {
    console.log('Creating default "general" room...');
    
    // Check if general room already exists
    const { data: existingRoom, error: checkError } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('id', 'general')
      .single();
    
    if (existingRoom) {
      console.log('✅ General room already exists!');
      return;
    }
    
    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means "no rows returned" which is expected if room doesn't exist
      throw checkError;
    }
    
    // Insert the default general room
    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{
        id: 'general',
        name: 'General',
        created_by: 'system',
        created_at: new Date().toISOString()
      }]);
    
    if (error) {
      console.error('❌ Error creating room:', error);
      throw error;
    }
    
    console.log('✅ Default "general" room created successfully!');
    
    // Verify it was created
    const { data: verification, error: verifyError } = await supabase
      .from('chat_rooms')
      .select('*')
      .eq('id', 'general')
      .single();
    
    if (verifyError) {
      console.error('❌ Error verifying room creation:', verifyError);
    } else {
      console.log('✅ Room verified:', verification);
    }
    
  } catch (error) {
    console.error('❌ Failed to create default room:', error.message);
    process.exit(1);
  }
}

// Run the script
createDefaultRoom()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
