import { getExpenseShares, cents, allocateCents } from './splitShares.js';

export function calculateFinancials(members, expenses) {
  const balances = {};
  const totalPaid = {};
  const totalShare = {};
  const totalSettled = {};
  const netCashFlow = {};
  const expensesById = new Map(expenses.map((expense) => [String(expense.id), expense]));

  members.forEach((member) => {
    balances[member] = 0;
    totalPaid[member] = 0;
    totalShare[member] = 0;
    totalSettled[member] = 0;
    netCashFlow[member] = 0;
  });

  const addNetCashFlowCents = (member, amountCents) => {
    if (netCashFlow[member] !== undefined) netCashFlow[member] += amountCents;
  };
  const recordCashTransfer = (from, to, amount) => {
    const amountCents = Math.round(Number(amount) * 100);
    if (!from || !to || from === to || !Number.isSafeInteger(amountCents) || amountCents <= 0) return;
    addNetCashFlowCents(from, -amountCents);
    addNetCashFlowCents(to, amountCents);
  };

  expenses.forEach((exp) => {
    const amount = Number(exp.amount) || 0;
    if (exp.isSettlement) {
      if (!exp.internalSettlementOffset) {
        const payers = Array.isArray(exp.payers) && exp.payers.length
          ? exp.payers
          : exp.paidBy ? [{ member: exp.paidBy, amount }] : [];
        payers.forEach((payer) => {
          const paidCents = Math.round(Number(payer.amount) * 100);
          if (Number.isSafeInteger(paidCents) && paidCents > 0) {
            addNetCashFlowCents(payer.member, -paidCents);
          }
        });
        const shares = getExpenseShares(exp);
        [...new Set(exp.splitWith || [])].forEach((recipient) => {
          const receivedCents = Math.round((Number(shares[recipient]) || 0) * 100);
          if (receivedCents > 0) addNetCashFlowCents(recipient, receivedCents);
        });
      }
    } else {
      (exp.settlementCashEvents || []).forEach((event) => {
        recordCashTransfer(event.from, event.to, event.amount);
      });
    }

    if (!(amount > 0)) return;

    if (exp.isSettlement && exp.balanceNeutral) return;

    if (exp.isSettlement && exp.sourceExpenseId != null) {
      const sourceExpense = expensesById.get(String(exp.sourceExpenseId));
      const payer = exp.paidBy || exp.payers?.[0]?.member;
      if (sourceExpense && payer && getSettledMemberIds(sourceExpense, expenses).includes(payer)) return;
    }

    const shares = getExpenseShares(exp);
    const recipients = exp.isSettlement
      ? [...new Set([...(exp.splitWith || []), ...Object.keys(shares || {})])]
      : (exp.splitWith || []);
    if (!recipients.length) return;

    if (exp.isSettlement && exp.internalSettlementOffset) {
      // Reverse the automatic payer-credit reduction for a consolidated third-party share.
      if (balances[exp.paidBy] !== undefined) balances[exp.paidBy] -= amount;
      recipients.forEach((person) => {
        if (balances[person] !== undefined) balances[person] += Number(shares[person]) || 0;
      });
      return;
    }

    if (Array.isArray(exp.payers) && exp.payers.length > 0) {
      exp.payers.forEach((payer) => {
        const paid = Number(payer.amount) || 0;
        if (balances[payer.member] !== undefined) balances[payer.member] += paid;
        if (totalPaid[payer.member] !== undefined && !exp.isSettlement) totalPaid[payer.member] += paid;
        if (totalSettled[payer.member] !== undefined && exp.isSettlement) totalSettled[payer.member] += paid;
      });
    } else if (exp.paidBy) {
      if (balances[exp.paidBy] !== undefined) balances[exp.paidBy] += amount;
      if (totalPaid[exp.paidBy] !== undefined && !exp.isSettlement) totalPaid[exp.paidBy] += amount;
      if (totalSettled[exp.paidBy] !== undefined && exp.isSettlement) totalSettled[exp.paidBy] += amount;
    }

    if (exp.isSettlement) {
      recipients.forEach((person) => {
        const share = Number(shares[person]) || 0;
        if (balances[person] !== undefined) balances[person] -= share;
      });
      return;
    }

    const splitMembers = [...new Set(exp.splitWith || [])];
    const settledMembers = new Set(getSettledMemberIds(exp, expenses));
    const payerNames = new Set((Array.isArray(exp.payers) && exp.payers.length
      ? exp.payers.map((payer) => payer.member)
      : [exp.paidBy]).filter(Boolean));
    const transfers = transfersForExpense(exp);

    splitMembers.forEach((person) => {
      const share = Number(shares[person]) || 0;
      if (totalShare[person] !== undefined) totalShare[person] += share;
      if (balances[person] !== undefined) balances[person] -= share;
      if (settledMembers.has(person)) {
        if (totalSettled[person] !== undefined) totalSettled[person] += share;
        if (payerNames.has(person)) return;

        if (balances[person] !== undefined) balances[person] += share;
        const matchingCredits = getCreditOwnerShares(exp).filter((share) => share.memberId === person);
        if (matchingCredits.length) {
          matchingCredits.forEach((share) => {
            if (balances[share.creditOwnerId] !== undefined) balances[share.creditOwnerId] -= share.amount;
          });
        } else {
          const matchingTransfers = transfers.filter((transfer) => transfer.from === person);
          matchingTransfers.forEach((transfer) => {
            if (balances[transfer.to] !== undefined) balances[transfer.to] -= transfer.amount;
          });
        }
        return;
      }
    });
  });

  members.forEach((member) => {
    balances[member] = Math.round(balances[member] * 100) / 100;
    totalPaid[member] = Math.round(totalPaid[member] * 100) / 100;
    totalShare[member] = Math.round(totalShare[member] * 100) / 100;
    totalSettled[member] = Math.round(totalSettled[member] * 100) / 100;
    netCashFlow[member] = netCashFlow[member] / 100;
  });

  // 3. Debt Minimization Algorithm
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([person, balance]) => {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded < -0.01) debtors.push({ person, amount: -rounded });
    else if (rounded > 0.01) creditors.push({ person, amount: rounded });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0;
  let j = 0;

  const debtorList = debtors.map((d) => ({ ...d }));
  const creditorList = creditors.map((c) => ({ ...c }));

  while (i < debtorList.length && j < creditorList.length) {
    const matchAmount = Math.min(debtorList[i].amount, creditorList[j].amount);
    if (matchAmount > 0.009) {
      settlements.push({
        from: debtorList[i].person,
        to: creditorList[j].person,
        amount: matchAmount.toFixed(2),
      });
    }

    debtorList[i].amount -= matchAmount;
    creditorList[j].amount -= matchAmount;

    if (debtorList[i].amount < 0.01) i++;
    if (creditorList[j].amount < 0.01) j++;
  }

  return { balances, totalPaid, totalShare, totalSettled, netCashFlow, settlements };
}

export function getSettledMemberIds(expense, entries = []) {
  const participants = [...new Set(expense?.splitWith || [])];
  if (!participants.length) return [];

  if (Array.isArray(expense.settledMemberIds)) {
    return [...new Set(expense.settledMemberIds.filter((member) => participants.includes(member)))];
  }

  const settledMembers = new Set();
  const payers = Array.isArray(expense.payers) && expense.payers.length
    ? expense.payers.map((payer) => payer.member)
    : [expense.paidBy];
  payers.filter((member) => participants.includes(member)).forEach((member) => settledMembers.add(member));

  const transfers = repaymentsForExpense(expense, entries);
  participants.forEach((member) => {
    const obligations = transfers.filter((transfer) => transfer.from === member);
    if (obligations.length && obligations.every((transfer) => transfer.paid)) settledMembers.add(member);
  });
  return [...settledMembers];
}

export function getCreditOwnerShares(expense) {
  if (Array.isArray(expense?.creditOwnerShares)) {
    return expense.creditOwnerShares.filter((share) => (
      share?.memberId && share?.creditOwnerId && Number(share.amount) > 0
    )).map((share) => ({
      memberId: share.memberId,
      creditOwnerId: share.creditOwnerId,
      amount: Number(share.amount),
    }));
  }
  return transfersForExpense(expense).map((transfer) => ({
    memberId: transfer.from,
    creditOwnerId: transfer.to,
    amount: transfer.amount,
  }));
}

export function initializeCreditOwnerShares(expense, previousExpense = null) {
  const initialShares = transfersForExpense(expense).map((transfer) => ({
    memberId: transfer.from,
    creditOwnerId: transfer.to,
    amount: transfer.amount,
  }));
  if (!previousExpense) return initialShares;

  const previousShares = getCreditOwnerShares(previousExpense);
  const nextShares = [];
  const currentShares = getExpenseShares(expense);
  const splitMembers = [...new Set(expense.splitWith || [])];

  splitMembers.forEach((memberId) => {
    const previousMemberShares = previousShares.filter((share) => share.memberId === memberId);
    if (!previousMemberShares.length) {
      nextShares.push(...initialShares.filter((share) => share.memberId === memberId));
      return;
    }

    const targetCents = cents(currentShares[memberId] || 0);
    const previousTotalCents = previousMemberShares.reduce((sum, share) => sum + cents(share.amount), 0);
    if (targetCents <= 0 || previousTotalCents <= 0) return;

    let remainingCents = targetCents;
    previousMemberShares.forEach((share, index) => {
      const allocatedCents = index === previousMemberShares.length - 1
        ? remainingCents
        : Math.floor((targetCents * cents(share.amount)) / previousTotalCents);
      remainingCents -= allocatedCents;
      if (allocatedCents > 0) {
        nextShares.push({
          memberId,
          creditOwnerId: share.creditOwnerId,
          amount: allocatedCents / 100,
        });
      }
    });
  });

  return nextShares;
}

export function getTransferSettledExpenseIds(settlement, expenses) {
  if (!settlement?.isSettlement || !settlement.balanceNeutral || settlement.sourceExpenseId != null) return [];
  const member = settlement.paidBy || settlement.payers?.[0]?.member;
  if (!member) return [];

  if (Array.isArray(settlement.settledExpenseIds)) {
    return [...new Set([
      ...settlement.settledExpenseIds,
      ...(settlement.creditOwnerChanges || []).map((change) => change.expenseId),
      ...(settlement.settlementStatusChanges || []).map((change) => change.expenseId),
      ...(settlement.balanceNeutralChanges || []).map((change) => change.expenseId),
    ])].filter((id) => expenses.some(
      (expense) => !expense.isSettlement && String(expense.id) === String(id),
    ));
  }

  return expenses.filter((expense) => {
    if (expense.isSettlement || !(expense.splitWith || []).includes(member)) return false;
    const payers = Array.isArray(expense.payers) && expense.payers.length
      ? expense.payers.map((payer) => payer.member)
      : [expense.paidBy];
    return !payers.includes(member) && getSettledMemberIds(expense, expenses).includes(member);
  }).map((expense) => expense.id);
}

export function undoTransferSettlement(expenses, settlement) {
  const member = settlement?.paidBy || settlement?.payers?.[0]?.member;
  if (!member) return expenses;
  const ownerChanges = Array.isArray(settlement.creditOwnerChanges)
    ? settlement.creditOwnerChanges
    : [];
  const statusChanges = Array.isArray(settlement.settlementStatusChanges)
    ? settlement.settlementStatusChanges
    : [];
  const balanceNeutralChanges = Array.isArray(settlement.balanceNeutralChanges)
    ? settlement.balanceNeutralChanges
    : [];
  const affectedExpenseIds = new Set(getTransferSettledExpenseIds(settlement, expenses).map(String));
  if (!affectedExpenseIds.size) return expenses;

  return expenses.map((expense) => {
    if (!affectedExpenseIds.has(String(expense.id))) return expense;
    if (expense.isSettlement) {
      const neutralChange = balanceNeutralChanges.find(
        (change) => String(change.expenseId) === String(expense.id),
      );
      if (!neutralChange) return expense;
      if (neutralChange.hadValue) {
        return { ...expense, balanceNeutral: neutralChange.previousValue };
      }
      const restored = { ...expense };
      delete restored.balanceNeutral;
      return restored;
    }

    let restored = expense;
    const membersToUnsettle = new Set(statusChanges
      .filter((change) => String(change.expenseId) === String(expense.id))
      .map((change) => change.memberId));
    if (Array.isArray(settlement.settledExpenseIds)
      && settlement.settledExpenseIds.some((id) => String(id) === String(expense.id))) {
      membersToUnsettle.add(member);
    } else if (!Array.isArray(settlement.settledExpenseIds)
      && (expense.splitWith || []).includes(member)
      && getSettledMemberIds(expense, expenses).includes(member)) {
      membersToUnsettle.add(member);
    }
    if (membersToUnsettle.size) {
      restored = {
        ...restored,
        settledMemberIds: getSettledMemberIds(expense, expenses)
          .filter((name) => !membersToUnsettle.has(name)),
      };
    }

    const changesForExpense = ownerChanges.filter(
      (change) => String(change.expenseId) === String(expense.id),
    );
    if (changesForExpense.length) {
      const creditOwnerShares = getCreditOwnerShares(restored).map((share) => {
        const change = changesForExpense.find((candidate) => (
          candidate.memberId === share.memberId
          && candidate.creditOwnerIdTo === share.creditOwnerId
          && Math.abs(Number(candidate.amount) - share.amount) < 0.005
        ));
        return change ? { ...share, creditOwnerId: change.creditOwnerIdFrom } : share;
      });
      restored = { ...restored, creditOwnerShares };
    }
    return restored;
  });
}

export function createSettlementOffsets(expenses, debtor, creditor, transferId, datetime) {
  let offsetIndex = 0;
  return expenses.flatMap((expense) => getCreditOwnerShares(expense)
    .filter((share) => (
      share.memberId === debtor
      && share.creditOwnerId !== debtor
      && share.creditOwnerId !== creditor
    ))
    .map((share) => {
      offsetIndex += 1;
      return {
        id: `${transferId}-offset-${offsetIndex}`,
        desc: `Settlement offset: ${creditor} → ${share.creditOwnerId}`,
        amount: share.amount,
        paidBy: creditor,
        payers: [{ member: creditor, amount: share.amount }],
        splitWith: [share.creditOwnerId],
        splitShares: { [share.creditOwnerId]: share.amount },
        datetime,
        isSettlement: true,
        internalSettlementOffset: true,
        sourceTransferId: transferId,
      };
    }));
}

export function getUnsettledPayerCredit(expenses, member) {
  let totalCents = 0;
  expenses.forEach((expense) => {
    if (expense.isSettlement) return;
    const settledMembers = new Set(getSettledMemberIds(expense, expenses));
    getCreditOwnerShares(expense).forEach((share) => {
      if (share.creditOwnerId === member
        && share.memberId !== member
        && !settledMembers.has(share.memberId)) {
        totalCents += Math.round(share.amount * 100);
      }
    });
  });
  return totalCents / 100;
}

export function reassignUnsettledPayerCredits(expenses, debtor, creditor) {
  let totalCents = 0;
  const creditOwnerChanges = [];
  const settlementStatusChanges = [];
  const changedExpenseIds = [];
  const updatedExpenses = expenses.map((expense) => {
    if (expense.isSettlement) return expense;
    const settledMembers = new Set(getSettledMemberIds(expense, expenses));
    const shares = getExpenseShares(expense);
    const creditOwnerShares = getCreditOwnerShares(expense);
    const memberRows = new Map();
    creditOwnerShares.forEach((share) => {
      if (!memberRows.has(share.memberId)) memberRows.set(share.memberId, []);
      memberRows.get(share.memberId).push(share);
    });

    let changed = false;
    const updatedCreditOwnerShares = creditOwnerShares.map((share) => {
      if (share.creditOwnerId !== debtor
        || share.memberId === debtor
        || settledMembers.has(share.memberId)) return share;
      changed = true;
      const amountCents = Math.round(share.amount * 100);
      totalCents += amountCents;
      creditOwnerChanges.push({
        expenseId: expense.id,
        memberId: share.memberId,
        creditOwnerIdFrom: debtor,
        creditOwnerIdTo: creditor,
        amount: amountCents / 100,
      });
      return { ...share, creditOwnerId: creditor };
    });
    if (!changed) {
      return Array.isArray(expense.creditOwnerShares)
        ? expense
        : { ...expense, creditOwnerShares };
    }

    const nextSettledMembers = new Set(settledMembers);
    const creditorShares = memberRows.get(creditor) || [];
    if (creditorShares.length
      && creditorShares.every((share) => share.creditOwnerId === debtor && !settledMembers.has(creditor))
      && creditorShares.reduce((sum, share) => sum + Math.round(share.amount * 100), 0)
        === Math.round(Number(shares[creditor] || 0) * 100)) {
      nextSettledMembers.add(creditor);
      settlementStatusChanges.push({ expenseId: expense.id, memberId: creditor });
    }
    changedExpenseIds.push(expense.id);
    return {
      ...expense,
      creditOwnerShares: updatedCreditOwnerShares,
      ...(nextSettledMembers.size !== settledMembers.size
        ? { settledMemberIds: [...nextSettledMembers] }
        : {}),
    };
  });

  return {
    expenses: updatedExpenses,
    amount: totalCents / 100,
    creditOwnerChanges,
    settlementStatusChanges,
    changedExpenseIds,
  };
}

export function createPayerCreditTransfer(debtor, creditor, amount, transferId, datetime) {
  if (amount <= 0) return null;

  return {
    id: `${transferId}-credit`,
    desc: `Settlement credit transfer: ${debtor} → ${creditor}`,
    amount,
    paidBy: debtor,
    payers: [{ member: debtor, amount }],
    splitWith: [creditor],
    splitShares: { [creditor]: amount },
    datetime,
    isSettlement: true,
    internalSettlementOffset: true,
    sourceTransferId: transferId,
  };
}

// Build expense-specific repayments in integer cents to avoid rounding errors.
// These entries follow the same semantics as the app's regular settlements.
export function transfersForExpense(expense) {
  if (!expense || expense.isSettlement) return [];
  const participants = [...new Set(expense.splitWith || [])];
  const totalCents = Math.round(Number(expense.amount) * 100);
  if (!participants.length || !Number.isSafeInteger(totalCents) || totalCents <= 0) return [];
  const balances = new Map();
  const allocated = expense.splitShares
    ? Object.fromEntries(Object.entries(getExpenseShares(expense)).map(([name, value]) => [name, cents(value)]))
    : allocateCents(totalCents, participants);
  if (Object.values(allocated).reduce((sum, n) => sum + n, 0) !== totalCents) return [];
  Object.entries(allocated).forEach(([name, share]) => balances.set(name, -share));
  const payers = Array.isArray(expense.payers) && expense.payers.length
    ? expense.payers : [{ member: expense.paidBy, amount: expense.amount }];
  let paidCents = 0;
  for (let i = 0; i < payers.length; i += 1) {
    const payer = payers[i];
    // Assign any final rounding remainder to the last payer.
    const cents = i === payers.length - 1
      ? totalCents - paidCents : Math.round(Number(payer.amount) * 100);
    if (!payer.member || !Number.isSafeInteger(cents) || cents < 0) return [];
    balances.set(payer.member, (balances.get(payer.member) || 0) + cents);
    paidCents += cents;
  }
  const debtors = [...balances].filter(([, cents]) => cents < 0).map(([name, cents]) => ({ name, cents: -cents }));
  const creditors = [...balances].filter(([, cents]) => cents > 0).map(([name, cents]) => ({ name, cents }));
  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const cents = Math.min(debtors[i].cents, creditors[j].cents);
    if (cents > 0) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount: cents / 100 });
    debtors[i].cents -= cents;
    creditors[j].cents -= cents;
    if (!debtors[i].cents) i += 1;
    if (!creditors[j].cents) j += 1;
  }
  return transfers;
}

// Rebuild per-expense repayment checks from saved settlements, including older records without an index.
export function repaymentsForExpense(expense, entries = []) {
  const transfers = transfersForExpense(expense);
  const recorded = entries.filter((entry) =>
    entry.isSettlement && !entry.balanceNeutral && String(entry.sourceExpenseId) === String(expense?.id)
  );
  const usedLegacy = new Set();
  return transfers.map((transfer, index) => {
    const exact = recorded.find((entry) => Number(entry.sourceTransferIndex) === index);
    let matched = exact;
    if (!matched) {
      const legacyIndex = recorded.findIndex((entry, entryIndex) =>
        entry.sourceTransferIndex == null && !usedLegacy.has(entryIndex) &&
        (entry.paidBy === transfer.from || entry.payers?.[0]?.member === transfer.from) &&
        entry.splitWith?.includes(transfer.to) &&
        Math.abs(Number(entry.amount) - transfer.amount) < 0.005
      );
      if (legacyIndex !== -1) {
        usedLegacy.add(legacyIndex);
        matched = recorded[legacyIndex];
      }
    }
    return { ...transfer, index, paid: Boolean(matched) };
  });
}
