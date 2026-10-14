import { getExpenseShares, cents, allocateCents } from './splitShares.js';

export function calculateFinancials(members, expenses) {
  const balances = {};
  const totalPaid = {};
  const totalShare = {};

  members.forEach((member) => {
    balances[member] = 0;
    totalPaid[member] = 0;
    totalShare[member] = 0;
  });

  expenses.forEach((exp) => {
    const amount = Number(exp.amount) || 0;
    const splitWith = exp.splitWith || [];

    if (splitWith.length === 0 || amount <= 0) return;

    const shares = getExpenseShares(exp);

    // 1. Credit payers (supports both multiple payers array & legacy single paidBy)
    if (Array.isArray(exp.payers) && exp.payers.length > 0) {
      exp.payers.forEach((p) => {
        const pAmt = Number(p.amount) || 0;
        if (balances[p.member] !== undefined) {
          balances[p.member] += pAmt;
        }
        if (totalPaid[p.member] !== undefined && !exp.isSettlement) {
          totalPaid[p.member] += pAmt;
        }
      });
    } else if (exp.paidBy) {
      if (balances[exp.paidBy] !== undefined) {
        balances[exp.paidBy] += amount;
      }
      if (totalPaid[exp.paidBy] !== undefined && !exp.isSettlement) {
        totalPaid[exp.paidBy] += amount;
      }
    }

    // 2. Debit debtors
    splitWith.forEach((person) => {
      if (balances[person] !== undefined) {
        balances[person] -= Number(shares[person]) || 0;
      }
      if (totalShare[person] !== undefined && !exp.isSettlement) {
        totalShare[person] += Number(shares[person]) || 0;
      }
    });
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

  return { balances, totalPaid, totalShare, settlements };
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
