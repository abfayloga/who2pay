import { supabase } from './supabase';

// The UI uses camelCase while Supabase stores the colors in member_colors.
export function normalizeRoomData(row) {
  if (!row) return null;
  const { member_colors, ...rest } = row;
  return {
    ...rest,
    members: Array.isArray(row.members) ? row.members : [],
    expenses: Array.isArray(row.expenses) ? row.expenses : [],
    currency: row.currency || 'PHP',
    memberColors: member_colors && typeof member_colors === 'object' && !Array.isArray(member_colors)
      ? member_colors : (row.memberColors || {}),
  };
}

export async function getRoomData(roomId) {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error) {
    console.error('Error loading room:', error.message);
    throw error;
  }
  return normalizeRoomData(data);
}

export async function saveRoomData(roomId, roomData) {
  const { data, error } = await supabase
    .from('rooms')
    .upsert({
      id: roomId,
      name: roomData.name,
      members: roomData.members || [],
      expenses: roomData.expenses || [],
      member_colors: roomData.memberColors || {},
      currency: roomData.currency || 'PHP',
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error saving room:', error.message);
    throw error;
  }
  return normalizeRoomData(data);
}
