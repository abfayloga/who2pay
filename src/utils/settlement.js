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

    const splitShare = amount / splitWith.length;

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
        balances[person] -= splitShare;
      }
      if (totalShare[person] !== undefined && !exp.isSettlement) {
        totalShare[person] += splitShare;
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