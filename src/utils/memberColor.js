export const MEMBER_PALETTE = [
  { label: 'Red', hex: '#dc2626' },
  { label: 'Orange', hex: '#ea580c' },
  { label: 'Yellow', hex: '#ca8a04' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Teal', hex: '#0d9488' },
  { label: 'Cyan', hex: '#0891b2' },
  { label: 'Blue', hex: '#2563eb' },
  { label: 'Indigo', hex: '#4f46e5' },
  { label: 'Purple', hex: '#9333ea' },
  { label: 'Pink', hex: '#db2777' },
  { label: 'Brown', hex: '#92400e' },
  { label: 'Gray', hex: '#64748b' },
];

export function defaultMemberColor(name) {
  let hash = 0;
  for (const char of String(name || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return MEMBER_PALETTE[Math.abs(hash % MEMBER_PALETTE.length)].hex;
}

export function memberColor(name, colors = {}) {
  const chosen = colors?.[name];
  return typeof chosen === 'string' && /^#[0-9a-fA-F]{6}$/.test(chosen)
    ? chosen
    : defaultMemberColor(name);
}
