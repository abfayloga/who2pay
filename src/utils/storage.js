import { supabase } from './supabase';

export async function getRoomData(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error) {
    console.error('Error loading room:', error.message);
    return null;
  }
  return data;
}

export async function saveRoomData(roomId, roomData) {
  const { error } = await supabase
    .from('rooms')
    .upsert({
      id: roomId,
      name: roomData.name,
      members: roomData.members,
      expenses: roomData.expenses,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error saving room:', error.message);
  }
}