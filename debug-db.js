// Quick debug script to check database
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabase() {
  console.log('Checking recent messages...');
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Database error:', error);
  } else {
    console.log('Recent messages:', data);
  }

  // Test insert
  console.log('\nTesting insert...');
  const { data: insertData, error: insertError } = await supabase
    .from('messages')
    .insert([{
      content: 'Test message from debug script',
      user_email: 'debug@test',
      created_at: new Date().toISOString(),
    }]);

  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('Insert successful:', insertData);
  }
}

checkDatabase();
