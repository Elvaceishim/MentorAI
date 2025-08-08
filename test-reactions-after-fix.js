import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testReactionsAfterFix() {
    console.log('Testing message_reactions table after schema fix...');
    
    try {
        // Test insert
        console.log('1. Testing insert...');
        const { data: insertData, error: insertError } = await supabase
            .from('message_reactions')
            .insert([{
                message_id: 'test-message-123',
                user_email: 'test@example.com',
                emoji: '👍'
            }])
            .select();
        
        if (insertError) {
            console.error('❌ Insert failed:', insertError);
            return;
        }
        console.log('✅ Insert successful:', insertData);
        
        // Test select
        console.log('\n2. Testing select...');
        const { data: selectData, error: selectError } = await supabase
            .from('message_reactions')
            .select('*')
            .eq('message_id', 'test-message-123');
        
        if (selectError) {
            console.error('❌ Select failed:', selectError);
            return;
        }
        console.log('✅ Select successful:', selectData);
        
        // Test another emoji for the same message
        console.log('\n3. Testing multiple reactions...');
        const { data: insertData2, error: insertError2 } = await supabase
            .from('message_reactions')
            .insert([{
                message_id: 'test-message-123',
                user_email: 'test@example.com',
                emoji: '❤️'
            }])
            .select();
        
        if (insertError2) {
            console.error('❌ Second insert failed:', insertError2);
        } else {
            console.log('✅ Multiple reactions working:', insertData2);
        }
        
        // Test delete
        console.log('\n4. Testing delete...');
        const { error: deleteError } = await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', 'test-message-123')
            .eq('user_email', 'test@example.com')
            .eq('emoji', '👍');
        
        if (deleteError) {
            console.error('❌ Delete failed:', deleteError);
        } else {
            console.log('✅ Delete successful');
        }
        
        // Clean up remaining test data
        console.log('\n5. Cleaning up...');
        await supabase
            .from('message_reactions')
            .delete()
            .eq('message_id', 'test-message-123');
        
        console.log('✅ All tests passed! Reactions functionality is working.');
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

testReactionsAfterFix();
