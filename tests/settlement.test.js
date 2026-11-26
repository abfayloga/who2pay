import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFinancials,
  createPayerCreditTransfer,
  createSettlementOffsets,
  initializeCreditOwnerShares,
  getSettledMemberIds,
  getUnsettledPayerCredit,
  reassignUnsettledPayerCredits,
  undoTransferSettlement,
} from '../src/utils/settlement.js';

const sharedExpense = (settledMemberIds) => ({
  id: 'expense-1',
  desc: 'Dinner',
  amount: 100,
  paidBy: 'A',
  payers: [{ member: 'A', amount: 100 }],
  splitWith: ['A', 'B'],
  splitShares: { A: 50, B: 50 },
  ...(settledMemberIds === undefined ? {} : { settledMemberIds }),
});

function settleSuggestedDebt(members, expenses, debtor) {
  const financials = calculateFinancials(members, expenses);
  const suggestion = financials.settlements.find((entry) => entry.from === debtor);
  assert.ok(suggestion, `Expected a settlement suggestion for ${debtor}`);
  const affected = expenses.filter((expense) => (
    !expense.isSettlement
    && (expense.splitWith || []).includes(debtor)
    && !getSettledMemberIds(expense, expenses).includes(debtor)
  ));
  const movedCredits = reassignUnsettledPayerCredits(expenses, debtor, suggestion.to);
  const updatedExpenses = movedCredits.expenses.map((expense) => {
    if (!affected.some((entry) => String(entry.id) === String(expense.id))) return expense;
    return {
      ...expense,
      settledMemberIds: [...new Set([...getSettledMemberIds(expense, expenses), debtor])],
    };
  });
  const transferId = `transfer-${debtor}`;
  const transfer = {
    id: transferId,
    amount: Number(suggestion.amount),
    paidBy: debtor,
    splitWith: [suggestion.to],
    splitShares: { [suggestion.to]: Number(suggestion.amount) },
    isSettlement: true,
    balanceNeutral: true,
    settledExpenseIds: affected.map((expense) => expense.id),
    creditOwnerChanges: movedCredits.creditOwnerChanges,
    settlementStatusChanges: movedCredits.settlementStatusChanges,
    balanceNeutralChanges: [],
  };
  const offsets = createSettlementOffsets(affected, debtor, suggestion.to, transferId, '2026-11-26');
  const projectedBalance = calculateFinancials(members, [transfer, ...offsets, ...updatedExpenses])
    .balances[debtor];
  const creditTransfer = createPayerCreditTransfer(
    debtor,
    suggestion.to,
    Math.max(0, Math.round(projectedBalance * 100) / 100),
    transferId,
    '2026-11-26',
  );
  return [
    transfer,
    ...offsets,
    ...(creditTransfer ? [creditTransfer] : []),
    ...updatedExpenses,
  ];
}

test('settling participants preserves gross shares while reducing their balances', () => {
  const financials = calculateFinancials(['A', 'B'], [sharedExpense(['A', 'B'])]);

  assert.deepEqual(financials.balances, { A: 0, B: 0 });
  assert.deepEqual(financials.totalShare, { A: 50, B: 50 });
  assert.deepEqual(financials.totalSettled, { A: 50, B: 50 });
});

test('payer is auto-settled for legacy expenses while gross shares remain unchanged', () => {
  const expense = sharedExpense(undefined);
  const financials = calculateFinancials(['A', 'B'], [expense]);

  assert.deepEqual(getSettledMemberIds(expense), ['A']);
  assert.deepEqual(financials.balances, { A: 50, B: -50 });
  assert.deepEqual(financials.totalShare, { A: 50, B: 50 });
  assert.deepEqual(financials.totalSettled, { A: 50, B: 0 });
});

test('a participant outside the split is not marked settled as a payer', () => {
  const expense = {
    id: 'expense-2',
    amount: 100,
    paidBy: 'C',
    splitWith: ['A', 'B'],
    settledMemberIds: [],
  };

  assert.deepEqual(getSettledMemberIds(expense), []);
  assert.deepEqual(calculateFinancials(['A', 'B', 'C'], [expense]).balances, {
    A: -50,
    B: -50,
    C: 100,
  });
});

test('credit ownership initializes for new expenses and survives expense edits', () => {
  const expense = {
    amount: 100,
    paidBy: 'A',
    payers: [{ member: 'A', amount: 100 }],
    splitWith: ['A', 'B'],
    splitShares: { A: 50, B: 50 },
  };
  const initialOwners = initializeCreditOwnerShares(expense);
  assert.deepEqual(initialOwners, [{ memberId: 'B', creditOwnerId: 'A', amount: 50 }]);

  const editedExpense = {
    ...expense,
    amount: 200,
    splitShares: { A: 100, B: 100 },
  };
  const editedOwners = initializeCreditOwnerShares({
    ...editedExpense,
    creditOwnerShares: [{ memberId: 'B', creditOwnerId: 'C', amount: 50 }],
  }, {
    ...expense,
    creditOwnerShares: [{ memberId: 'B', creditOwnerId: 'C', amount: 50 }],
  });
  assert.deepEqual(editedOwners, [{ memberId: 'B', creditOwnerId: 'C', amount: 100 }]);
});

test('partial transfer rows continue to reduce balances without settling the participant', () => {
  const expense = sharedExpense(['A']);
  const partialTransfer = {
    id: 'transfer-1',
    amount: 25,
    paidBy: 'B',
    payers: [{ member: 'B', amount: 25 }],
    splitWith: ['A'],
    splitShares: { A: 25 },
    isSettlement: true,
  };
  const financials = calculateFinancials(['A', 'B'], [expense, partialTransfer]);

  assert.deepEqual(financials.balances, { A: 25, B: -25 });
  assert.deepEqual(financials.totalShare, { A: 50, B: 50 });
  assert.deepEqual(financials.totalSettled, { A: 50, B: 25 });
  assert.deepEqual(getSettledMemberIds(expense), ['A']);
});

test('net cash flow counts receipts and payments, not upfront spending or internal offsets', () => {
  const expense = sharedExpense(['A']);
  const partialTransfer = {
    id: 'cash-transfer',
    amount: 25,
    paidBy: 'B',
    payers: [{ member: 'B', amount: 25 }],
    splitWith: ['A'],
    splitShares: { A: 25 },
    isSettlement: true,
  };
  const internalOffset = {
    id: 'internal-offset',
    amount: 10,
    paidBy: 'Unknown',
    splitWith: ['Missing'],
    splitShares: { Missing: 10 },
    isSettlement: true,
    internalSettlementOffset: true,
  };
  const financials = calculateFinancials(
    ['A', 'B'],
    [expense, partialTransfer, internalOffset],
  );

  assert.deepEqual(financials.totalPaid, { A: 100, B: 0 });
  assert.deepEqual(financials.netCashFlow, { A: 25, B: -25 });
  assert.deepEqual(financials.balances, { A: 25, B: -25 });
  assert.equal(
    financials.totalPaid.A - financials.totalShare.A - financials.netCashFlow.A,
    financials.balances.A,
  );
  assert.equal(
    financials.totalPaid.B - financials.totalShare.B - financials.netCashFlow.B,
    financials.balances.B,
  );
});

test('individual participant settlement events contribute to net cash flow', () => {
  const expense = {
    ...sharedExpense(['A', 'B']),
    settlementCashEvents: [{ from: 'B', to: 'A', amount: 50 }],
  };
  const financials = calculateFinancials(['A', 'B'], [expense]);

  assert.deepEqual(financials.balances, { A: 0, B: 0 });
  assert.deepEqual(financials.netCashFlow, { A: 50, B: -50 });
});

test('a direct payment transaction is included in balance calculations', () => {
  const expense = sharedExpense(['A']);
  const payment = {
    id: 'payment-1',
    amount: 50,
    paidBy: 'B',
    splitWith: ['A'],
    splitShares: { A: 50 },
    isSettlement: true,
  };
  const financials = calculateFinancials(['A', 'B'], [expense, payment]);

  assert.deepEqual(financials.balances, { A: 0, B: 0 });
  assert.deepEqual(financials.totalSettled, { A: 50, B: 50 });
  assert.deepEqual(calculateFinancials(['A', 'B'], [expense]).balances, { A: 50, B: -50 });
});

test('an overpayment is fully reflected without settling unrelated transaction shares', () => {
  const expense = sharedExpense(['A']);
  const overpayment = {
    id: 'overpayment',
    amount: 75,
    paidBy: 'B',
    splitWith: ['A'],
    splitShares: { A: 75 },
    isSettlement: true,
  };
  const financials = calculateFinancials(['A', 'B'], [expense, overpayment]);

  assert.deepEqual(financials.balances, { A: -25, B: 25 });
  assert.deepEqual(financials.settlements, [{ from: 'A', to: 'B', amount: '25.00' }]);
  assert.deepEqual(getSettledMemberIds(expense), ['A']);
});

test('a full transfer represented by participant statuses does not apply twice', () => {
  const expense = sharedExpense(['A', 'B']);
  const transfer = {
    id: 'transfer-2',
    amount: 50,
    paidBy: 'B',
    payers: [{ member: 'B', amount: 50 }],
    splitWith: ['A'],
    splitShares: { A: 50 },
    isSettlement: true,
    balanceNeutral: true,
  };
  const financials = calculateFinancials(['A', 'B'], [expense, transfer]);

  assert.deepEqual(financials.balances, { A: 0, B: 0 });
});

test('deleting a full transfer restores the payer settlement status and balance', () => {
  const expense = sharedExpense(['A', 'B']);
  const transfer = {
    id: 'transfer-3',
    amount: 50,
    paidBy: 'B',
    payers: [{ member: 'B', amount: 50 }],
    splitWith: ['A'],
    splitShares: { A: 50 },
    isSettlement: true,
    balanceNeutral: true,
    settledExpenseIds: [expense.id],
  };
  const expenses = [expense, transfer];
  const afterDelete = undoTransferSettlement(expenses, transfer)
    .filter((entry) => entry.id !== transfer.id);

  assert.deepEqual(getSettledMemberIds(afterDelete[0], afterDelete), ['A']);
  assert.deepEqual(calculateFinancials(['A', 'B'], afterDelete).balances, { A: 50, B: -50 });
});

test('consolidated settlements preserve third-party payers with internal offsets', () => {
  const creditorExpense = {
    id: 'creditor-expense',
    amount: 100,
    paidBy: 'PJ',
    payers: [{ member: 'PJ', amount: 100 }],
    splitWith: ['PJ', 'Achi'],
    splitShares: { PJ: 50, Achi: 50 },
    settledMemberIds: ['PJ'],
  };
  const thirdPartyExpense = {
    id: 'third-party-expense',
    amount: 100,
    paidBy: 'Chons',
    payers: [{ member: 'Chons', amount: 100 }],
    splitWith: ['Chons', 'Achi'],
    splitShares: { Chons: 50, Achi: 50 },
    settledMemberIds: ['Chons'],
  };
  const before = calculateFinancials(
    ['PJ', 'Chons', 'Achi'],
    [creditorExpense, thirdPartyExpense],
  );
  const offsets = createSettlementOffsets(
    [thirdPartyExpense],
    'Achi',
    'PJ',
    'group-transfer',
    '2026-11-26',
  );
  const after = calculateFinancials(
    ['PJ', 'Chons', 'Achi'],
    [
      { ...creditorExpense, settledMemberIds: ['PJ', 'Achi'] },
      { ...thirdPartyExpense, settledMemberIds: ['Chons', 'Achi'] },
      ...offsets,
    ],
  );

  assert.equal(offsets.length, 1);
  assert.equal(offsets[0].amount, 50);
  assert.equal(before.balances.Chons, after.balances.Chons);
  assert.equal(after.balances.Achi, 0);
  assert.equal(after.balances.PJ, -50);
});

test('a debtor-payer credit is transferred to the consolidated creditor', () => {
  const members = ['PJ', 'Chons', 'Achi', 'Santino', 'Emman', 'Member 6', 'Member 7', 'Member 8'];
  const payerExpense = {
    id: 'red-horse',
    amount: 1680,
    paidBy: 'Chons',
    payers: [{ member: 'Chons', amount: 1680 }],
    splitWith: ['Chons', 'Achi', 'Santino', 'Emman', 'Member 6', 'Member 7', 'Member 8'],
    splitShares: {
      Chons: 240,
      Achi: 240,
      Santino: 240,
      Emman: 240,
      'Member 6': 240,
      'Member 7': 240,
      'Member 8': 240,
    },
    settledMemberIds: ['Chons'],
  };
  const debtorExpense = {
    id: 'pj-expense',
    amount: 8040.96,
    paidBy: 'PJ',
    payers: [{ member: 'PJ', amount: 8040.96 }],
    splitWith: ['PJ', 'Chons'],
    splitShares: { PJ: 4020.48, Chons: 4020.48 },
    settledMemberIds: ['PJ'],
  };
  const expenses = [payerExpense, debtorExpense];
  const before = calculateFinancials(members, expenses);
  const payerCredit = getUnsettledPayerCredit(expenses, 'Chons');
  const payerCreditMove = reassignUnsettledPayerCredits(expenses, 'Chons', 'PJ');
  const creditTransfer = createPayerCreditTransfer(
    'Chons',
    'PJ',
    payerCreditMove.amount,
    'chons-pj',
    '2026-11-26',
  );
  const groupTransfer = {
    id: 'chons-pj',
    amount: 2580.48,
    paidBy: 'Chons',
    splitWith: ['PJ'],
    splitShares: { PJ: 2580.48 },
    isSettlement: true,
    balanceNeutral: true,
    settledExpenseIds: [debtorExpense.id],
  };
  const settledExpenses = [
    ...payerCreditMove.expenses.map((expense) => (
      expense.id === debtorExpense.id
        ? { ...expense, settledMemberIds: ['PJ', 'Chons'] }
        : expense
    )),
    groupTransfer,
    creditTransfer,
  ];
  const after = calculateFinancials(members, [
    ...settledExpenses,
  ]);
  const restoredExpenses = undoTransferSettlement(settledExpenses, groupTransfer)
    .filter((expense) => (
      String(expense.id) !== String(groupTransfer.id)
      && String(expense.sourceTransferId) !== String(groupTransfer.id)
    ));
  const restored = calculateFinancials(members, restoredExpenses);
  const unchangedSuggestions = (financials) => financials.settlements
    .filter((entry) => entry.from !== 'Chons')
    .map(({ from, to, amount }) => ({ from, to, amount }));

  assert.equal(payerCredit, 1440);
  assert.equal(payerCreditMove.amount, 1440);
  assert.equal(creditTransfer.amount, 1440);
  assert.equal(before.balances.Chons, -2580.48);
  assert.equal(after.balances.Chons, 0);
  assert.equal(after.netCashFlow.Chons, -2580.48);
  assert.equal(after.netCashFlow.PJ, 2580.48);
  assert.equal(Math.round((before.balances.PJ - after.balances.PJ) * 100) / 100, 2580.48);
  assert.deepEqual(unchangedSuggestions(after), unchangedSuggestions(before));
  assert.deepEqual(restored.balances, before.balances);
  assert.deepEqual(restored.settlements, before.settlements);
});

test('credit ownership keeps settled debtors at zero when settlements happen in any order', () => {
  const members = ['PJ', 'Chons', 'Achi', 'Santino', 'Emman', 'Trish', 'Member 6', 'Member 7'];
  const expenses = [
    {
      id: 'red-horse',
      amount: 1680,
      paidBy: 'Chons',
      payers: [{ member: 'Chons', amount: 1680 }],
      splitWith: ['Chons', 'Achi', 'Santino', 'Emman', 'Trish', 'Member 6', 'Member 7'],
      splitShares: {
        Chons: 240,
        Achi: 240,
        Santino: 240,
        Emman: 240,
        Trish: 240,
        'Member 6': 240,
        'Member 7': 240,
      },
      settledMemberIds: ['Chons'],
    },
    {
      id: 'pj-expense',
      amount: 8040.96,
      paidBy: 'PJ',
      payers: [{ member: 'PJ', amount: 8040.96 }],
      splitWith: ['PJ', 'Chons'],
      splitShares: { PJ: 4020.48, Chons: 4020.48 },
      settledMemberIds: ['PJ'],
    },
  ];
  const initialFinancials = calculateFinancials(members, expenses);
  assert.equal(initialFinancials.balances.Chons, -2580.48);
  assert.deepEqual(initialFinancials.settlements.find((entry) => entry.from === 'Chons'), {
    from: 'Chons',
    to: 'PJ',
    amount: '2580.48',
  });

  let chonsFirst = settleSuggestedDebt(members, expenses, 'Chons');
  let financials = calculateFinancials(members, chonsFirst);
  assert.equal(financials.balances.Chons, 0);
  assert.equal(financials.balances.PJ, 1440);
  assert.deepEqual(
    financials.settlements.find((entry) => entry.from === 'Santino'),
    { from: 'Santino', to: 'PJ', amount: '240.00' },
  );
  const chonsTransfer = chonsFirst.find((expense) => expense.id === 'transfer-Chons');
  const undone = undoTransferSettlement(chonsFirst, chonsTransfer).filter((expense) => (
    String(expense.id) !== String(chonsTransfer.id)
    && String(expense.sourceTransferId) !== String(chonsTransfer.id)
  ));
  assert.deepEqual(calculateFinancials(members, undone).balances, initialFinancials.balances);
  assert.ok(
    undone.find((expense) => expense.id === 'red-horse')
      .creditOwnerShares.every((share) => share.creditOwnerId === 'Chons'),
  );

  ['Achi', 'Santino', 'Emman', 'Trish', 'Member 6', 'Member 7'].forEach((member) => {
    chonsFirst = settleSuggestedDebt(members, chonsFirst, member);
    financials = calculateFinancials(members, chonsFirst);
    assert.equal(financials.balances.Chons, 0, `${member}'s settlement must not revive Chons`);
  });
  assert.ok(Object.values(financials.balances).every((balance) => balance === 0));

  let membersFirst = expenses;
  ['Achi', 'Santino', 'Emman', 'Trish', 'Member 6', 'Member 7', 'Chons'].forEach((member) => {
    membersFirst = settleSuggestedDebt(members, membersFirst, member);
    financials = calculateFinancials(members, membersFirst);
    if (member !== 'Chons') assert.ok(financials.balances.Chons < 0);
  });
  assert.ok(Object.values(financials.balances).every((balance) => balance === 0));
});

test('legacy full transfers can be removed without leaving settled participant states', () => {
  const expense = sharedExpense(['A', 'B']);
  const legacyTransfer = {
    id: 'legacy-transfer',
    amount: 50,
    paidBy: 'B',
    splitWith: ['A'],
    splitShares: { A: 50 },
    isSettlement: true,
    balanceNeutral: true,
  };
  const expenses = [expense, legacyTransfer];
  const afterDelete = undoTransferSettlement(expenses, legacyTransfer)
    .filter((entry) => entry.id !== legacyTransfer.id);

  assert.deepEqual(getSettledMemberIds(afterDelete[0], afterDelete), ['A']);
  assert.deepEqual(calculateFinancials(['A', 'B'], afterDelete).balances, { A: 50, B: -50 });
});

test('legacy individual settlement records are reflected without double counting', () => {
  const expense = sharedExpense(undefined);
  const legacySettlement = {
    id: 'legacy-settlement',
    amount: 50,
    paidBy: 'B',
    payers: [{ member: 'B', amount: 50 }],
    splitWith: ['A'],
    splitShares: { A: 50 },
    isSettlement: true,
    sourceExpenseId: expense.id,
    sourceTransferIndex: 0,
  };
  const entries = [expense, legacySettlement];

  assert.deepEqual(getSettledMemberIds(expense, entries), ['A', 'B']);
  assert.deepEqual(calculateFinancials(['A', 'B'], entries).balances, { A: 0, B: 0 });
});
