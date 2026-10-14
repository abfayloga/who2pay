// Work in integer cents so displayed shares always add up to the receipt total.
export const cents = (value) => Math.round(Number(value) * 100);
export const money = (value) => Math.round(Number(value) * 100) / 100;

export function allocateCents(total, members) {
  const unique = [...new Set(members || [])];
  if (!unique.length || !Number.isSafeInteger(total) || total < 0) throw Error('Invalid split');
  const base = Math.floor(total / unique.length);
  const remainder = total % unique.length;
  return Object.fromEntries(unique.map((name, i) => [name, base + (i < remainder ? 1 : 0)]));
}

export function getExpenseShares(expense) {
  if (expense?.splitShares && typeof expense.splitShares === 'object' && !Array.isArray(expense.splitShares)) {
    return expense.splitShares;
  }
  const names = expense?.splitWith || [];
  const total = cents(expense?.amount || 0);
  if (!names.length || !Number.isSafeInteger(total) || total < 0) return {};
  return Object.fromEntries(Object.entries(allocateCents(total, names)).map(([name, amount]) => [name, amount / 100]));
}

export function validateCustomShares(total, members, inputs, parseAmount) {
  const totalCents = cents(total);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || !members.length) throw Error('Choose participants and a positive total.');
  const result = {};
  for (const member of members) {
    const raw = String(inputs[member] ?? '').trim();
    const parsed = raw ? parseAmount(raw) : 0;
    if (parsed === null || !Number.isFinite(parsed) || parsed < 0) throw Error(`Invalid amount for ${member}.`);
    result[member] = cents(parsed);
  }
  const sum = Object.values(result).reduce((a, b) => a + b, 0);
  if (sum !== totalCents) throw Error(`Assigned amounts must equal the receipt total (difference: ${(totalCents - sum) / 100}).`);
  return Object.fromEntries(Object.entries(result).map(([name, share]) => [name, share / 100]));
}

export function itemizedShares(items, parseAmount) {
  const shares = {};
  let totalCents = 0;
  for (const [index, item] of items.entries()) {
    const amount = parseAmount(String(item.amount ?? ''));
    const participants = [...new Set(item.members || [])];
    if (amount === null || !Number.isFinite(amount) || amount <= 0 || !participants.length) {
      throw Error(`Item ${index + 1} needs a positive amount and at least one member.`);
    }
    const lineCents = cents(amount);
    if (!Number.isSafeInteger(lineCents)) throw Error('Amount too large.');
    totalCents += lineCents;
    for (const [member, share] of Object.entries(allocateCents(lineCents, participants))) {
      shares[member] = (shares[member] || 0) + share;
    }
  }
  if (!items.length) throw Error('Add at least one item.');
  return {
    total: totalCents / 100,
    shares: Object.fromEntries(Object.entries(shares).map(([name, share]) => [name, share / 100])),
  };
}

export function fillRemainingEqually(total, members, inputs, parseAmount) {
  const totalCents = cents(total);
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0 || !members.length) throw Error('Enter a valid total.');
  const assigned = {};
  const empty = [];
  for (const member of members) {
    const raw = String(inputs[member] ?? '').trim();
    if (!raw) { empty.push(member); continue; }
    const value = parseAmount(raw);
    if (value === null || !Number.isFinite(value) || value < 0) throw Error(`Invalid amount for ${member}.`);
    assigned[member] = cents(value);
  }
  const remaining = totalCents - Object.values(assigned).reduce((sum, n) => sum + n, 0);
  if (remaining < 0) throw Error('Assigned amounts exceed the total.');
  if (!empty.length) throw Error('Leave at least one member blank to split the remaining amount.');
  return Object.fromEntries(Object.entries({ ...assigned, ...allocateCents(remaining, empty) }).map(([name, n]) => [name, (n / 100).toFixed(2)]));
}
