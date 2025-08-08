import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRoomCreation() {
  try {
    console.log('🧪 Testing room creation with service role...');
    
    // Test creating a room with service role (should work)
    const { data, error } = await supabase
      .from('chat_rooms')
      .insert([{
        name: 'Test Room from Script',
        created_by: 'script@test.com',
        created_at: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error('❌ Room creation failed even with service role:', error);
      console.log('🔧 This means there might be a deeper issue with the table setup');
      
      // Try to read existing rooms
      const { data: rooms, error: readError } = await supabase
        .from('chat_rooms')
        .select('*');
        
      if (readError) {
        console.error('❌ Can\'t even read rooms:', readError);
      } else {
        console.log('✅ Can read rooms:', rooms);
      }
    } else {
      console.log('✅ Room created successfully with service role:', data);
      console.log('❗ The issue is with RLS policies for regular users');
    }
    
    console.log('\n📋 To fix this issue:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the SQL commands in fix-rls-policies.sql');
    console.log('4. Or temporarily disable RLS with: ALTER TABLE public.chat_rooms DISABLE ROW LEVEL SECURITY;');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testRoomCreation()
  .then(() => {
    console.log('🏁 Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
