import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAmount } from '../src/utils/amountExpression.js';
import { formatCurrency } from '../src/utils/currency.js';
import {
  formatCompactDate,
  formatDate,
  parseDateParts,
  toIsoDate,
} from '../src/utils/formatDate.js';
import {
  allocateCents,
  fillRemainingEqually,
  getExpenseShares,
  itemizedShares,
  validateCustomShares,
} from '../src/utils/splitShares.js';
import { calculateFinancials } from '../src/utils/settlement.js';
import {
  exportRowForTransaction,
  parseAmount,
  parseImportedTransactions,
  parseTableText,
  tableRowForTransaction,
} from '../src/utils/tableTransactions.js';

test('amount expressions honor arithmetic precedence and reject invalid input', () => {
  assert.equal(evaluateAmount('12 + 3 * (4 - 1)'), 21);
  assert.equal(evaluateAmount('-(10 / 4)'), -2.5);
  assert.equal(evaluateAmount('1 / 0'), null);
  assert.equal(evaluateAmount('2 + alert(1)'), null);
  assert.equal(evaluateAmount('(2 + 3'), null);
});

test('equal, custom, and itemized shares preserve the receipt total in cents', () => {
  assert.deepEqual(allocateCents(1000, ['A', 'B', 'C', 'A']), {
    A: 334,
    B: 333,
    C: 333,
  });
  assert.deepEqual(getExpenseShares({ amount: 10, splitWith: ['A', 'B', 'C'] }), {
    A: 3.34,
    B: 3.33,
    C: 3.33,
  });

  assert.deepEqual(validateCustomShares(
    10,
    ['A', 'B'],
    { A: '3 + 2', B: '5' },
    evaluateAmount,
  ), { A: 5, B: 5 });
  assert.throws(() => validateCustomShares(
    10,
    ['A', 'B'],
    { A: '4', B: '5' },
    evaluateAmount,
  ), /Assigned amounts must equal/);

  const itemized = itemizedShares([
    { amount: '10', members: ['A', 'B'] },
    { amount: '5', members: ['B', 'C'] },
  ], evaluateAmount);
  assert.equal(itemized.total, 15);
  assert.deepEqual(itemized.shares, { A: 5, B: 7.5, C: 2.5 });
});

test('fill-remaining equally distributes only the unassigned cents', () => {
  assert.deepEqual(fillRemainingEqually(
    10,
    ['A', 'B', 'C'],
    { A: '4' },
    evaluateAmount,
  ), { A: '4.00', B: '3.00', C: '3.00' });
  assert.throws(() => fillRemainingEqually(
    10,
    ['A', 'B'],
    { A: '8', B: '3' },
    evaluateAmount,
  ), /Assigned amounts exceed/);
});

test('multi-payer custom expenses produce balanced member totals', () => {
  const financials = calculateFinancials(['A', 'B', 'C'], [{
    id: 'multi-payer',
    amount: 100,
    paidBy: '2 payers',
    payers: [{ member: 'A', amount: 60 }, { member: 'B', amount: 40 }],
    splitWith: ['A', 'B', 'C'],
    splitShares: { A: 20, B: 30, C: 50 },
    settledMemberIds: ['A', 'B'],
  }]);

  assert.deepEqual(financials.balances, { A: 40, B: 10, C: -50 });
  assert.deepEqual(financials.totalPaid, { A: 60, B: 40, C: 0 });
  assert.deepEqual(financials.totalShare, { A: 20, B: 30, C: 50 });
  assert.deepEqual(financials.totalSettled, { A: 20, B: 30, C: 0 });
  assert.deepEqual(financials.settlements, [
    { from: 'C', to: 'A', amount: '40.00' },
    { from: 'C', to: 'B', amount: '10.00' },
  ]);
});

test('table import handles quoted descriptions, multi-payers, currency values, and settlements', () => {
  const rows = parseTableText([
    'Description\tAmount\tPaid By\tSplit Between',
    '"Lunch, team"\t₱1,000.00\tAlex\tAlex, Jamie',
    'Dinner\t50\tAlex (30); Jamie (20)\tAlex, Jamie, Pat',
    'Settlement: Jamie → Alex\t25\tJamie\tAlex',
  ].join('\n'));
  const imported = parseImportedTransactions(rows.map((row) => row.join('\t')).join('\n'), ['Alex', 'Jamie']);

  assert.equal(imported.issues.length, 0);
  assert.equal(imported.transactions.length, 3);
  assert.deepEqual(imported.newMembers, ['Pat']);
  assert.equal(imported.transactions[0].desc, 'Lunch, team');
  assert.equal(imported.transactions[0].amount, 1000);
  assert.deepEqual(imported.transactions[1].payers, [
    { member: 'Alex', amount: 30 },
    { member: 'Jamie', amount: 20 },
  ]);
  assert.equal(imported.transactions[2].isSettlement, true);
  assert.equal(parseAmount('$1,234.50'), 1234.5);
});

test('table import reports invalid amounts and payer totals instead of accepting bad rows', () => {
  const imported = parseImportedTransactions([
    'Description\tAmount\tPaid By\tSplit Between',
    'Invalid amount\tabc\tAlex\tAlex, Jamie',
    'Payer mismatch\t50\tAlex (30); Jamie (15)\tAlex, Jamie',
  ].join('\n'));

  assert.equal(imported.transactions.length, 0);
  assert.equal(imported.issues.length, 2);
});

test('transaction table and exports keep payer, share, and numeric date data', () => {
  const transaction = {
    desc: 'Dinner',
    amount: 50,
    paidBy: '2 payers',
    payers: [{ member: 'Alex', amount: 30 }, { member: 'Jamie', amount: 20 }],
    splitWith: ['Alex', 'Jamie'],
    datetime: '2026-11-26T20:00:00Z',
  };

  assert.deepEqual(tableRowForTransaction(transaction), [
    'Dinner',
    '50.00',
    'Alex (30.00); Jamie (20.00)',
    'Alex, Jamie',
  ]);
  assert.deepEqual(exportRowForTransaction(transaction), [
    '11/26/2026',
    'Dinner',
    '50.00',
    'Alex (30.00); Jamie (20.00)',
    'Alex, Jamie',
  ]);
});

test('date parsing, display formatting, and currency formatting handle valid and invalid values', () => {
  assert.deepEqual(parseDateParts('2026-11-26T20:00:00Z'), {
    year: 2026,
    month: 11,
    day: 26,
  });
  assert.equal(formatDate('2026-11-26'), '11/26/2026');
  assert.equal(formatCompactDate('2026-11-26'), 'Nov 26');
  assert.equal(toIsoDate('11/26/2026'), '2026-11-26');
  assert.equal(formatDate('2026-02-30'), '');
  assert.match(formatCurrency(1234.5, 'PHP'), /1,234\.50/);
  assert.match(formatCurrency(1234.5, 'INVALID'), /1,234\.50/);
});
