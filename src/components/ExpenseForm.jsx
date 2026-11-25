import { forwardRef, useEffect, useRef, useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { evaluateAmount } from '../utils/amountExpression';
import { todayIsoDate, toIsoDate } from '../utils/formatDate';
import { memberColor } from '../utils/memberColor';
import { fillRemainingEqually, itemizedShares, validateCustomShares } from '../utils/splitShares';
import { getPayers } from '../utils/tableTransactions';
import { cardClass, fieldClass, primaryButton, secondaryButton } from '../utils/uiClasses';
import DateField from './DateField';
import { CardHeading, MemberTag } from './roomUi';

function blankItem() {
  return { id: 'first', desc: '', amount: '', members: [] };
}

function createFormState(expense, members, currentUser) {
  if (!expense) {
    return {
      desc: '',
      notes: '',
      amount: '',
      payerMode: 'single',
      paidBy: currentUser || members[0] || '',
      payerShares: {},
      splitWith: [...members],
      splitMethod: 'equal',
      customShares: {},
      lineItems: [blankItem()],
      date: todayIsoDate(),
    };
  }

  const payers = getPayers(expense);
  const multiple = payers.length > 1;
  return {
    desc: expense.desc || '',
    notes: expense.notes || '',
    amount: multiple ? '' : String(expense.amount ?? ''),
    payerMode: multiple ? 'multiple' : 'single',
    paidBy: multiple ? (currentUser || members[0] || '') : (payers[0]?.member || currentUser || members[0] || ''),
    payerShares: multiple ? Object.fromEntries(payers.map((payer) => [payer.member, String(payer.amount)])) : {},
    splitWith: [...(expense.splitWith || members)],
    splitMethod: expense.splitMethod || (expense.splitShares ? 'custom' : 'equal'),
    customShares: Object.fromEntries(Object.entries(expense.splitShares || {}).map(([name, value]) => [name, String(value)])),
    lineItems: expense.items?.length
      ? expense.items.map((item, index) => ({ ...item, id: item.id || `line-${index}`, members: item.members || [] }))
      : [blankItem()],
      date: toIsoDate(expense.datetime) || todayIsoDate(),
  };
}

const ExpenseForm = forwardRef(function ExpenseForm({
  expense,
  members,
  colors,
  currentUser,
  currency,
  formatAmount,
  onCancel,
  onSave,
}, ref) {
  const initial = createFormState(expense, members, currentUser);
  const [desc, setDesc] = useState(initial.desc);
  const [notes, setNotes] = useState(initial.notes);
  const [amount, setAmount] = useState(initial.amount);
  const [payerMode, setPayerMode] = useState(initial.payerMode);
  const [paidBy, setPaidBy] = useState(initial.paidBy);
  const [payerShares, setPayerShares] = useState(initial.payerShares);
  const [splitWith, setSplitWith] = useState(initial.splitWith);
  const [splitMethod, setSplitMethod] = useState(initial.splitMethod);
  const [customShares, setCustomShares] = useState(initial.customShares);
  const [lineItems, setLineItems] = useState(initial.lineItems);
  const [date, setDate] = useState(initial.date);
  const previousMembersRef = useRef(members);

  useEffect(() => {
    const previousMembers = previousMembersRef.current;
    previousMembersRef.current = members;
    const removed = previousMembers.filter((name) => !members.includes(name));
    const added = members.filter((name) => !previousMembers.includes(name));
    if (!removed.length && !added.length) return;

    setSplitWith((current) => [...current.filter((name) => !removed.includes(name)), ...added]);
    setPaidBy((current) => (members.includes(current) ? current : (members[0] || '')));
    if (!removed.length) return;

    setPayerShares((current) => {
      const next = { ...current };
      removed.forEach((name) => delete next[name]);
      return next;
    });
    setCustomShares((current) => {
      const next = { ...current };
      removed.forEach((name) => delete next[name]);
      return next;
    });
    setLineItems((current) => current.map((item) => ({
      ...item,
      members: (item.members || []).filter((name) => !removed.includes(name)),
    })));
  }, [members]);

  const multiplePayersTotal = Object.values(payerShares).reduce(
    (total, value) => total + (evaluateAmount(value) || 0), 0
  );
  const parsedAmount = evaluateAmount(amount);
  const editing = Boolean(expense);

  const toggleSplitMember = (member) => {
    setSplitWith((current) => (
      current.includes(member) ? current.filter((name) => name !== member) : [...current, member]
    ));
  };

  const clearNewExpenseFields = () => {
    setDesc('');
    setNotes('');
    setAmount('');
    setPayerShares({});
    setSplitMethod('equal');
    setCustomShares({});
    setLineItems([blankItem()]);
    setDate(todayIsoDate());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (splitMethod !== 'items' && !splitWith.length) {
      window.alert('Choose at least one member to split with.');
      return;
    }

    let finalPayers;
    if (payerMode === 'single') {
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || !paidBy) {
        window.alert('Enter a valid amount and payer.');
        return;
      }
      finalPayers = [{ member: paidBy, amount: parsedAmount }];
    } else {
      if (Object.values(payerShares).some((value) => String(value).trim() && evaluateAmount(value) === null)) {
        window.alert('Fix the invalid payer calculation before saving.');
        return;
      }
      finalPayers = Object.entries(payerShares)
        .map(([member, value]) => ({ member, amount: evaluateAmount(value) || 0 }))
        .filter(({ member, amount: paid }) => members.includes(member) && paid > 0);
      if (!finalPayers.length) {
        window.alert('Enter a positive amount for at least one payer.');
        return;
      }
    }

    const finalAmount = Math.round(finalPayers.reduce((sum, payer) => sum + payer.amount, 0) * 100) / 100;
    let finalSplitShares;
    let finalMembers = [...splitWith];
    let savedItems;
    try {
      if (splitMethod === 'custom') {
        finalSplitShares = validateCustomShares(finalAmount, finalMembers, customShares, evaluateAmount);
      } else if (splitMethod === 'items') {
        const result = itemizedShares(lineItems, evaluateAmount);
        if (Math.round(result.total * 100) !== Math.round(finalAmount * 100)) {
          throw Error(`Items total ${formatAmount(result.total)}, but payers paid ${formatAmount(finalAmount)}.`);
        }
        finalSplitShares = result.shares;
        finalMembers = Object.keys(result.shares);
        savedItems = lineItems.map((item) => ({
          desc: item.desc,
          amount: evaluateAmount(String(item.amount)),
          members: item.members,
        }));
      }
    } catch (error) {
      window.alert(error.message);
      return;
    }

    const payload = {
      desc: desc.trim() || 'General Expense',
      notes: notes.trim(),
      amount: finalAmount,
      paidBy: finalPayers.length === 1 ? finalPayers[0].member : `${finalPayers.length} payers`,
      payers: finalPayers,
      splitWith: finalMembers,
      splitMethod,
      splitShares: finalSplitShares || null,
      items: savedItems || [],
      datetime: date || todayIsoDate(),
      isSettlement: false,
    };

    const saved = await onSave(payload);
    if (saved && !editing) clearNewExpenseFields();
  };

  return (
    <section ref={ref} className={`${cardClass} scroll-mt-24 ${editing ? 'ring-2 ring-[#99f6e4]' : ''}`}>
      <CardHeading
        title={editing ? 'Edit transaction' : 'Add an expense'}
        right={(
          <div className="flex rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-1" role="group" aria-label="Payer mode">
            {[
              { id: 'single', label: 'One payer' },
              { id: 'multiple', label: 'Multiple' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPayerMode(option.id)}
                aria-pressed={payerMode === option.id}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${payerMode === option.id ? 'border-[#0f766e] bg-[#0f766e] text-white shadow-sm' : 'border-transparent bg-white text-[#64748b] hover:border-[#cbd5e1] hover:text-[#334155]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      />
      <form onSubmit={handleSubmit} className="space-y-3 p-3 sm:space-y-4 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={payerMode === 'multiple' ? 'sm:col-span-2' : ''}>
            <label htmlFor="description" className="mb-1.5 block text-xs font-semibold text-[#334155]">Description</label>
            <input
              id="description"
              type="text"
              required
              maxLength={150}
              placeholder="e.g. Dinner, Groceries"
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              className={fieldClass}
            />
          </div>
          {payerMode === 'single' && (
            <div>
              <label htmlFor="amount" className="mb-1.5 block text-xs font-semibold text-[#334155]">Amount ({currency})</label>
              <input
                id="amount"
                type="text"
                inputMode="decimal"
                required
                placeholder="e.g. 1200 + 450 / 3"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-describedby="amount-help"
                className={fieldClass}
              />
              {amount.trim() && (
                <p id="amount-help" className="mt-1 text-xs text-[#64748b]">
                  {parsedAmount === null
                    ? <span className="text-[#be123c]">Check expression</span>
                    : <span className="font-semibold text-[#0f766e]">= {formatAmount(parsedAmount)}</span>}
                </p>
              )}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="expense-notes" className="mb-1.5 block text-xs font-semibold text-[#334155]">Notes / Receipt link <span className="font-normal text-[#64748b]">(optional)</span></label>
          <textarea
            id="expense-notes"
            rows={1}
            maxLength={500}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add a note or receipt link"
            className={fieldClass}
          />
        </div>

        {payerMode === 'single' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="paid-by" className="mb-1.5 block text-xs font-semibold text-[#334155]">Paid by</label>
              <select id="paid-by" value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className={fieldClass}>
                {members.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <DateField id="expense-date" label="Date" value={date} onChange={setDate} required />
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#334155]">How much did each person pay?</p>
              <span className="text-sm font-bold tabular-nums text-[#0f766e]">Total: {formatAmount(multiplePayersTotal)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((name) => (
                <label key={name} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#e6e3dc] bg-white p-2.5">
                  <MemberTag name={name} colors={colors} small />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0 or 100+50"
                    value={payerShares[name] || ''}
                    onChange={(event) => setPayerShares((current) => ({ ...current, [name]: event.target.value }))}
                    aria-label={`Amount or calculation paid by ${name}`}
                    className="w-24 shrink-0 rounded-md border border-[#cbd5e1] px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-[#0f766e]"
                  />
                </label>
              ))}
            </div>
            <DateField id="multi-expense-date" label="Date" value={date} onChange={setDate} required />
          </div>
        )}

        <div className="space-y-2.5 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3">
          <label className="block text-xs font-semibold text-[#334155]" htmlFor="split-method">Split method</label>
          <select id="split-method" value={splitMethod} onChange={(event) => setSplitMethod(event.target.value)} className={fieldClass}>
            <option value="equal">Equal split</option>
            <option value="custom">Custom amounts</option>
            <option value="items">Itemized orders</option>
          </select>
          {splitMethod === 'custom' && (
            <div className="space-y-2">
              {splitWith.map((name) => (
                <label key={name} className="flex items-center justify-between gap-2 text-sm">
                  <MemberTag name={name} colors={colors} small />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00 or 200+50"
                    value={customShares[name] ?? ''}
                    onChange={(event) => setCustomShares((current) => ({ ...current, [name]: event.target.value }))}
                    aria-label={`Share for ${name}`}
                    className="w-36 rounded-md border border-[#cbd5e1] px-2 py-2 text-right text-sm"
                  />
                </label>
              ))}
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  try {
                    const total = payerMode === 'single' ? parsedAmount : multiplePayersTotal;
                    setCustomShares(fillRemainingEqually(total, splitWith, customShares, evaluateAmount));
                  } catch (error) {
                    window.alert(error.message);
                  }
                }}
              >
                Split remaining equally
              </button>
              <p className="text-xs text-[#64748b]">
                Assigned: {formatAmount(splitWith.reduce((sum, name) => sum + (evaluateAmount(customShares[name] || '0') || 0), 0))}
              </p>
            </div>
          )}
          {splitMethod === 'items' && (
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={item.id} className="space-y-2 rounded-md border border-[#e6e3dc] bg-white p-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs">Item {index + 1}</strong>
                    <button
                      type="button"
                      aria-label={`Remove item ${index + 1}`}
                      onClick={() => setLineItems((current) => current.filter((entry) => entry.id !== item.id))}
                      className="text-[#64748b]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                    <input
                      aria-label={`Item ${index + 1} description`}
                      placeholder="e.g. Chicken meal"
                      className={fieldClass}
                      value={item.desc}
                      onChange={(event) => setLineItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, desc: event.target.value } : entry))}
                    />
                    <input
                      aria-label={`Item ${index + 1} amount`}
                      placeholder="Price"
                      inputMode="decimal"
                      className={fieldClass}
                      value={item.amount}
                      onChange={(event) => setLineItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, amount: event.target.value } : entry))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((name) => (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={item.members.includes(name)}
                        onClick={() => setLineItems((current) => current.map((entry) => {
                          if (entry.id !== item.id) return entry;
                          const selected = entry.members.includes(name);
                          return {
                            ...entry,
                            members: selected ? entry.members.filter((member) => member !== name) : [...entry.members, name],
                          };
                        }))}
                        className={`rounded-md border px-2 py-1 text-xs ${item.members.includes(name) ? 'border-[#0f766e] bg-[#f0fdfa] text-[#0f766e]' : 'border-[#e6e3dc] text-[#64748b]'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-[#0f766e] underline"
                    onClick={() => setLineItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, members: [...members] } : entry))}
                  >
                    Everyone
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setLineItems((current) => [...current, { id: `item-${Date.now()}-${current.length}`, desc: '', amount: '', members: [] }])}
              >
                <Plus className="h-4 w-4" /> Add item
              </button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#64748b]">
                  Item total: {formatAmount(lineItems.reduce((sum, item) => sum + (evaluateAmount(String(item.amount)) || 0), 0))}. Must match the amount paid.
                </p>
                {payerMode === 'single' && (
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => {
                      try {
                        const result = itemizedShares(lineItems, evaluateAmount);
                        setAmount(result.total.toFixed(2));
                      } catch (error) {
                        window.alert(error.message);
                      }
                    }}
                  >
                    Use item total as amount
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {splitMethod !== 'items' && (
          <fieldset>
            <legend className="text-xs font-semibold text-[#334155]">
              Split between <span className="font-normal text-[#64748b]">({splitWith.length} selected)</span>
            </legend>
            <div className="mb-1.5 flex justify-end gap-3 text-xs font-semibold">
              <button type="button" onClick={() => setSplitWith([...members])} className="text-[#0f766e] hover:underline">Select All</button>
              <button type="button" onClick={() => setSplitWith([])} className="text-[#64748b] hover:underline">Clear</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {members.map((name) => {
                const selected = splitWith.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleSplitMember(name)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition ${selected ? 'border-[#0f766e] bg-[#f0fdfa] font-semibold text-[#0f766e]' : 'border-[#e6e3dc] text-[#64748b] hover:border-[#94a3b8]'}`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: memberColor(name, colors) }} />
                    {name} {selected && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap gap-2 border-t border-[#e6e3dc] pt-5">
          <button type="submit" className={`${primaryButton} flex-1 sm:flex-none`}>
            {editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? 'Save changes' : 'Add expense'}
          </button>
          {editing && <button type="button" onClick={onCancel} className={secondaryButton}>Cancel</button>}
        </div>
      </form>
    </section>
  );
});

export default ExpenseForm;
