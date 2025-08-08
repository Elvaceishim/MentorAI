import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkMessageReactionsTable() {
    console.log('Checking message_reactions table structure...');
    
    try {
        // Try to select from the table to see if it exists
        const { data, error } = await supabase
            .from('message_reactions')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error accessing message_reactions table:', error);
            
            if (error.message.includes("relation \"public.message_reactions\" does not exist")) {
                console.log('❌ Table message_reactions does not exist');
            } else if (error.message.includes("emoji")) {
                console.log('❌ Table exists but emoji column is missing');
            } else {
                console.log('❌ Other error:', error.message);
            }
        } else {
            console.log('✅ Table message_reactions exists and is accessible');
            console.log('Sample data:', data);
        }
        
        // Try a simple insert to test the schema
        console.log('\nTesting table schema with a test insert...');
        const { data: insertData, error: insertError } = await supabase
            .from('message_reactions')
            .insert([{
                message_id: 'test-message-id',
                user_email: 'test@example.com',
                emoji: '👍'
            }])
            .select();
        
        if (insertError) {
            console.error('❌ Error inserting test data:', insertError);
        } else {
            console.log('✅ Test insert successful:', insertData);
            
            // Clean up test data
            await supabase
                .from('message_reactions')
                .delete()
                .eq('message_id', 'test-message-id');
            console.log('✅ Test data cleaned up');
        }
        
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

checkMessageReactionsTable();
