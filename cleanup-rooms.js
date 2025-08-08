import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanupAndFix() {
  try {
    console.log('🧹 Cleaning up test rooms and fixing data types...');
    
    // 1. Delete test rooms (keeping only the first one or two)
    console.log('1. Removing test rooms...');
    
    const { data: allRooms, error: fetchError } = await supabase
      .from('chat_rooms')
      .select('*')
      .order('id', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching rooms:', fetchError);
      return;
    }
    
    console.log('Current rooms:', allRooms);
    
    // Keep the first room (General) and delete test rooms
    const roomsToDelete = allRooms.filter(room => 
      room.name.includes('Test') || 
      room.created_by === 'script@test.com' ||
      (room.id > 2 && room.name !== 'General') // Keep General, delete others with ID > 2
    );
    
    console.log('Rooms to delete:', roomsToDelete);
    
    for (const room of roomsToDelete) {
      console.log(`Deleting room: ${room.name} (ID: ${room.id})`);
      
      // Delete messages in this room first
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('room_id', room.id);
      
      if (msgError) {
        console.log(`Error deleting messages for room ${room.id}:`, msgError.message);
      }
      
      // Delete the room
      const { error: roomError } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', room.id);
      
      if (roomError) {
        console.log(`Error deleting room ${room.id}:`, roomError.message);
      } else {
        console.log(`✅ Deleted room: ${room.name}`);
      }
    }
    
    // 2. Fix existing messages with null room_id
    console.log('2. Fixing messages with null room_id...');
    
    const { data: remainingRooms } = await supabase
      .from('chat_rooms')
      .select('*')
      .order('id', { ascending: true });
    
    if (remainingRooms && remainingRooms.length > 0) {
      const defaultRoomId = remainingRooms[0].id;
      console.log(`Setting null room_id messages to room ${defaultRoomId}`);
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ room_id: defaultRoomId })
        .is('room_id', null);
      
      if (updateError) {
        console.log('Error updating null room_id:', updateError.message);
      } else {
        console.log('✅ Fixed null room_id messages');
      }
    }
    
    // 3. Show final state
    console.log('3. Final state:');
    const { data: finalRooms } = await supabase.from('chat_rooms').select('*');
    const { data: messageCount } = await supabase.from('messages').select('room_id', { count: 'exact', head: true });
    
    console.log('Remaining rooms:', finalRooms);
    console.log('Total messages:', messageCount);
    
    console.log('🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
  }
}

cleanupAndFix();
