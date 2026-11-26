import { formatDate } from './formatDate.js';

// Shared four-column table format for paste import.
export const TABLE_HEADERS = ['Description', 'Amount', 'Paid By', 'Split Between'];
export const EXPORT_HEADERS = ['Date', ...TABLE_HEADERS];

export function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) { row.push(cell.trim()); cell = ''; }
    else if (c === '\n' && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseTableText(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  let rows;
  if (source.includes('\t')) rows = parseDelimited(source, '\t');
  else if (source.split('\n').some((line) => /^\s*\|/.test(line))) {
    rows = source.split(/\r?\n/).filter((line) => line.trim().startsWith('|'))
      .map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((item) => item.trim()))
      .filter((row) => !row.every((item) => /^:?-+:?$/.test(item)));
  } else rows = parseDelimited(source, ',');
  if (rows.length && rows[0].some((cell) => /^(description|amount|paid\s*by|split\s*between|expense|transaction)$/i.test(cell))) rows.shift();
  return rows;
}

export function parseAmount(raw) {
  const normalized = String(raw ?? '').trim().replace(/[₱$€£¥₩₫,\s]/g, '').replace(/^(PHP|USD|EUR|GBP|JPY|SGD|AUD|CAD|KRW|VND)/i, '');
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return NaN;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
}

export function parseImportedTransactions(text, existingMembers = []) {
  const rows = parseTableText(text);
  const issues = [], transactions = [], newMembers = new Set();
  const names = new Map(existingMembers.map((name) => [name.trim().toLowerCase(), name]));
  const resolve = (raw) => {
    const name = String(raw || '').trim();
    if (!name) return '';
    const key = name.toLowerCase();
    if (!names.has(key)) { names.set(key, name); newMembers.add(name); }
    return names.get(key);
  };
  rows.forEach((row, index) => {
    const [description, rawAmount, rawPaid, rawSplit] = row;
    const rowNumber = index + 1;
    if (row.length !== 4 || !description || !rawPaid || !rawSplit) {
      issues.push(`Row ${rowNumber}: expected four non-empty columns (Description, Amount, Paid By, Split Between).`);
      return;
    }
    const amount = parseAmount(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) { issues.push(`Row ${rowNumber}: invalid amount.`); return; }
    const splitWith = [...new Set(String(rawSplit).split(/[,;\n]+/).map((name) => name.trim()).filter(Boolean).map(resolve))];
    if (!splitWith.length) { issues.push(`Row ${rowNumber}: missing split participants.`); return; }
    // Single payer, or multi-payer notation: "Alex (100); Pat (50)".
    const paidCells = String(rawPaid).split(/\s*;\s*/).filter(Boolean);
    let payers;
    if (paidCells.length === 1 && !/\([^)]*\)\s*$/.test(paidCells[0])) {
      payers = [{ member: resolve(rawPaid), amount }];
    } else {
      payers = paidCells.map((part) => {
        const match = part.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
        return match ? { member: resolve(match[1]), amount: parseAmount(match[2]) } : null;
      });
      const total = payers.reduce((sum, p) => sum + (p?.amount || 0), 0);
      if (payers.some((p) => !p || !p.member || !Number.isFinite(p.amount) || p.amount <= 0) || Math.abs(total - amount) > 0.011) {
        issues.push(`Row ${rowNumber}: payer amounts must add up to the transaction amount.`); return;
      }
    }
    const settlement = /^Settlement:\s*.+\s*[→>-]\s*.+$/i.test(description);
    transactions.push({ desc: description, amount, paidBy: payers.length === 1 ? payers[0].member : `${payers.length} payers`, payers, splitWith, isSettlement: settlement });
  });
  return { transactions, issues, newMembers: [...newMembers], rowCount: rows.length };
}

export function getPayers(expense) {
  if (Array.isArray(expense?.payers) && expense.payers.length) return expense.payers;
  return [{ member: expense?.paidBy || 'Unknown', amount: expense?.amount }];
}

export function tableRowForTransaction(expense) {
  const payers = Array.isArray(expense?.payers) && expense.payers.length
    ? expense.payers
    : [{ member: expense?.paidBy || '', amount: expense?.amount }];
  const recordedAmount = Number(expense?.amount || 0);
  const payerText = payers.length === 1
    ? (payers[0].member || '')
    : payers.map(({ member, amount }) => `${member} (${Number(amount).toFixed(2)})`).join('; ');
  const shareNames = expense?.isSettlement && expense.splitShares && typeof expense.splitShares === 'object'
    ? Object.keys(expense.splitShares)
    : [];
  const splitNames = shareNames.length ? shareNames : (expense?.splitWith || []);
  const description = expense?.desc || (expense?.isSettlement ? 'Settlement' : 'General Expense');
  return [description, (Number.isFinite(recordedAmount) ? recordedAmount : 0).toFixed(2), payerText, splitNames.join(', ')];
}

export function exportRowForTransaction(expense) {
  return [formatDate(expense?.datetime) || '', ...tableRowForTransaction(expense)];
}
