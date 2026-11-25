import { supabase } from './supabase';

const PAYMENT_DETAILS_KEY = '__paymentDetails';
const ACTIVITY_KEY = '__activity';

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

// The UI uses camelCase while Supabase stores the colors in member_colors.
export function normalizeRoomData(row) {
  if (!row) return null;
  const { member_colors, ...rest } = row;
  const savedMetadata = isObject(member_colors) ? member_colors : {};
  const rawColors = isObject(member_colors) ? member_colors : (row.memberColors || {});
  const memberColors = Object.fromEntries(
    Object.entries(rawColors).filter(([key]) => key !== PAYMENT_DETAILS_KEY && key !== ACTIVITY_KEY)
  );
  return {
    ...rest,
    members: Array.isArray(row.members) ? row.members : [],
    expenses: Array.isArray(row.expenses) ? row.expenses : [],
    currency: row.currency || 'PHP',
    memberColors,
    memberPaymentDetails: isObject(savedMetadata[PAYMENT_DETAILS_KEY])
      ? savedMetadata[PAYMENT_DETAILS_KEY]
      : (isObject(row.memberPaymentDetails) ? row.memberPaymentDetails : {}),
    activity: Array.isArray(savedMetadata[ACTIVITY_KEY])
      ? savedMetadata[ACTIVITY_KEY]
      : (Array.isArray(row.activity) ? row.activity : []),
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
  const memberColors = isObject(roomData.memberColors) ? roomData.memberColors : {};
  const memberPaymentDetails = isObject(roomData.memberPaymentDetails) ? roomData.memberPaymentDetails : {};
  const activity = Array.isArray(roomData.activity) ? roomData.activity : [];
  const { data, error } = await supabase
    .from('rooms')
    .upsert({
      id: roomId,
      name: roomData.name,
      members: roomData.members || [],
      expenses: roomData.expenses || [],
      member_colors: {
        ...memberColors,
        [PAYMENT_DETAILS_KEY]: memberPaymentDetails,
        [ACTIVITY_KEY]: activity,
      },
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
