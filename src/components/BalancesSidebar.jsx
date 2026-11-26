import { useState } from 'react';
import { ArrowLeftRight, Check, PieChart, Plus, Receipt, Trash2, X } from 'lucide-react';
import { getExpenseShares } from '../utils/splitShares';
import { MEMBER_PALETTE, memberColor } from '../utils/memberColor';
import { cardClass, fieldClass, primaryButton, secondaryButton } from '../utils/uiClasses';
import { CardHeading, MemberTag } from './roomUi';

function RepaymentRow({ suggestion, currentUser, formatAmount, onOpen, onSettle, locked }) {
  const incoming = suggestion.to === currentUser;
  const label = incoming ? 'Received' : 'Settle';
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d5e3de] bg-white px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => onOpen(suggestion)}
        disabled={locked}
        className="min-w-0 flex-1 rounded-md text-left text-xs text-[#475569] disabled:opacity-50"
      >
        <strong className="text-[#0f172a]">{suggestion.from}</strong> pays <strong className="text-[#0f172a]">{suggestion.to}</strong>
        <strong className="ml-2 tabular-nums text-[#0f172a]">{formatAmount(suggestion.amount)}</strong>
      </button>
      <button
        type="button"
        disabled={locked}
        onClick={() => onSettle(suggestion)}
        className={`${primaryButton} !px-3 !py-2 !text-xs`}
        aria-label={incoming
          ? `Record receipt of ${formatAmount(suggestion.amount)} from ${suggestion.from}`
          : `Record ${suggestion.from} paying ${formatAmount(suggestion.amount)} to ${suggestion.to}`}
      >
        {label}
      </button>
    </div>
  );
}

export function GroupSummary({
  roomName,
  currency,
  members,
  expenses,
  colors,
  currentUser,
  settlements,
  formatAmount,
  onOpenTransfer,
  onSettleSuggestion,
  transferLocked,
}) {
  const totalExpenses = expenses.filter((expense) => !expense.isSettlement)
    .reduce((total, expense) => total + (Number(expense.amount) || 0), 0);
  const individualExpenses = members.map((name) => ({
    name,
    share: expenses.reduce((sum, expense) => {
      if (expense.isSettlement) return sum;
      return sum + (Number(getExpenseShares(expense)[name]) || 0);
    }, 0),
  }));
  const currentUserShare = individualExpenses.find(({ name }) => name === currentUser)?.share || 0;
  const pendingTotal = settlements
    .filter((entry) => entry.from === currentUser)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const receivableTotal = settlements
    .filter((entry) => entry.to === currentUser)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const relevantSettlements = settlements.filter((entry) => entry.from === currentUser || entry.to === currentUser);

  return (
    <div>
      <div className="mb-2 sm:mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">Overview</h2>
          <p className="text-xs text-[#77756e]">{roomName} · {members.length} members · {currency}</p>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-1 items-start gap-2 sm:mb-4 sm:grid-cols-2 sm:gap-3">
        <section className="rounded-lg border border-[#c8ded4] bg-[#f2f8f5] px-3 py-3 shadow-sm sm:px-4 sm:py-3" aria-label="Group and individual shares">
          <div className="grid grid-cols-2 gap-3 border-b border-[#c8ded4] pb-3">
            <div className="min-w-0">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#315d53]">Your total share</h3>
              <p className="mt-1 truncate text-xl font-bold tracking-tight tabular-nums text-[#173f37] sm:text-2xl">{formatAmount(currentUserShare)}</p>
            </div>
            <div className="min-w-0 border-l border-[#c8ded4] pl-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#315d53]">Total group expenses</h3>
              <p className="mt-1 truncate text-lg font-semibold tracking-tight tabular-nums text-[#315d53] sm:text-xl">{formatAmount(totalExpenses)}</p>
            </div>
          </div>
          <div className="pt-2">
            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#315d53]">Individual share</h4>
            {individualExpenses.length ? (
              <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2">
                {individualExpenses.map(({ name, share }) => (
                  <div key={name} className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs ${name === currentUser ? 'bg-[#dff2e9]' : ''}`}>
                    <MemberTag name={name} colors={colors} small />
                    <span className="font-semibold tabular-nums text-[#173f37]">{formatAmount(share)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-[#627c74]">No members yet.</p>}
          </div>
        </section>
        <section className={`rounded-lg border px-3 py-3 shadow-sm sm:px-4 sm:py-3 ${pendingTotal > 0.01 || receivableTotal > 0.01 ? 'border-[#ead4bb] bg-[#fff7ed]' : 'border-[#bbf7d0] bg-[#f0fdf4]'}`} aria-label="Your pending settlements">
          <h3 className={`text-sm font-medium ${pendingTotal > 0.01 || receivableTotal > 0.01 ? 'text-[#905a28]' : 'text-[#166534]'}`}>Your pending settlements</h3>
          <p className={`mt-1.5 text-xs ${pendingTotal > 0.01 || receivableTotal > 0.01 ? 'text-[#75431e]' : 'text-[#166534]'}`}>
            <span className="font-semibold">To pay: <span className="tabular-nums">{formatAmount(pendingTotal)}</span></span>
            <span className={`mx-2 ${pendingTotal > 0.01 || receivableTotal > 0.01 ? 'text-[#b8793d]' : 'text-[#166534]'}`}>·</span>
            <span className="font-semibold">To receive: <span className="tabular-nums">{formatAmount(receivableTotal)}</span></span>
          </p>
          {relevantSettlements.length ? (
            <div className={`mt-2 space-y-1.5 border-t pt-2 ${pendingTotal > 0.01 || receivableTotal > 0.01 ? 'border-[#ead4bb]' : 'border-[#bbf7d0]'}`}>
              {relevantSettlements.map((suggestion, index) => {
                const incoming = suggestion.to === currentUser;
                return (
                  <div key={`${suggestion.from}:${suggestion.to}:${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#ead4bb] bg-white px-2.5 py-1.5">
                    <button type="button" onClick={() => onOpenTransfer(suggestion)} disabled={transferLocked} className="min-w-0 text-left disabled:opacity-50">
                      <p className="text-xs font-medium text-[#905a28]">{incoming ? 'To receive from' : 'To pay'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <MemberTag name={incoming ? suggestion.from : suggestion.to} colors={colors} small />
                        <span className="text-sm font-semibold tabular-nums text-[#75431e]">{formatAmount(suggestion.amount)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      disabled={transferLocked}
                      onClick={() => onSettleSuggestion(suggestion)}
                      className={`${primaryButton} !px-3 !py-2 !text-xs`}
                    >
                      {incoming ? 'Received' : 'Settle'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-2 border-t border-[#bbf7d0] pt-2 text-sm font-medium text-[#166534]">You’re all settled up.</p>}
        </section>
      </div>
    </div>
  );
}

export default function BalancesSidebar({
  members,
  colors,
  balances,
  totalPaid,
  totalShare,
  netCashFlow,
  settlements,
  currentUser,
  formatAmount,
  onOpenTransfer,
  onSettleSuggestion,
  transferLocked,
  onAddMember,
  onRemoveMember,
  onSaveColor,
  onResetColor,
  memberPaymentDetails,
  onSavePaymentDetails,
  colorNotice,
}) {
  const [newMemberName, setNewMemberName] = useState('');
  const [editingColorMember, setEditingColorMember] = useState(null);
  const [customColor, setCustomColor] = useState(MEMBER_PALETTE[0].hex);
  const [editingPaymentMember, setEditingPaymentMember] = useState(null);
  const [paymentDetailsDraft, setPaymentDetailsDraft] = useState('');

  const toggleColorEditor = (name) => {
    setEditingColorMember((current) => (current === name ? null : name));
    setCustomColor(memberColor(name, colors));
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    const added = await onAddMember(newMemberName);
    if (added) setNewMemberName('');
  };

  const startEditingPaymentDetails = (name) => {
    setEditingPaymentMember(name);
    setPaymentDetailsDraft(memberPaymentDetails[name] || '');
  };

  const savePaymentDetails = async (name) => {
    if (await onSavePaymentDetails(name, paymentDetailsDraft)) setEditingPaymentMember(null);
  };

  const sortedMembers = [...members].sort((first, second) => {
    const firstBalance = Number(balances[first]) || 0;
    const secondBalance = Number(balances[second]) || 0;
    const firstSettled = Math.abs(firstBalance) <= 0.01;
    const secondSettled = Math.abs(secondBalance) <= 0.01;
    if (firstSettled !== secondSettled) return firstSettled ? 1 : -1;
    return Math.abs(secondBalance) - Math.abs(firstBalance);
  });
  const unsettledMembers = sortedMembers.filter((name) => Math.abs(Number(balances[name]) || 0) > 0.01);
  const settledMembers = sortedMembers.filter((name) => Math.abs(Number(balances[name]) || 0) <= 0.01);

  const renderBalanceCard = (name) => {
    const balance = balances[name] || 0;
    const spent = Number(totalPaid[name]) || 0;
    const share = Number(totalShare[name]) || 0;
    const cashFlow = Number(netCashFlow[name]) || 0;
    const netCashFlowLabel = cashFlow > 0.01
      ? `+${formatAmount(cashFlow)}`
      : cashFlow < -0.01 ? `−${formatAmount(Math.abs(cashFlow))}` : formatAmount(0);
    const cashFlowLabel = cashFlow > 0.01 ? 'Received' : 'Settled';
    const signedBalance = balance > 0.01
      ? `+${formatAmount(balance)}`
      : balance < -0.01 ? `−${formatAmount(Math.abs(balance))}` : formatAmount(0);
    const breakdownTooltip = `Spent: ${formatAmount(spent)} · Share: ${formatAmount(share)} · ${cashFlowLabel}: ${netCashFlowLabel} · Current Balance: ${signedBalance}`;
    const breakdownTooltipId = `balance-breakdown-tooltip-${members.indexOf(name)}`;
    return (
      <div key={name} className="rounded-lg border border-[#e6e3dc] bg-[#faf9f6] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <MemberTag name={name} colors={colors} small />
          <span className={`text-sm font-semibold tabular-nums ${balance > 0.01 ? 'text-[#047857]' : balance < -0.01 ? 'text-[#be123c]' : 'text-[#64748b]'}`}>
            {balance > 0.01 ? '+' : balance < -0.01 ? '−' : ''}{formatAmount(Math.abs(balance))}
          </span>
        </div>
        {settlements.filter((item) => item.from === name).map((item, index) => (
          <RepaymentRow
            key={`${item.from}:${item.to}:${index}`}
            suggestion={item}
            currentUser={currentUser}
            formatAmount={formatAmount}
            onOpen={onOpenTransfer}
            onSettle={onSettleSuggestion}
            locked={transferLocked}
          />
        ))}
        <div
          title={breakdownTooltip}
          aria-label={breakdownTooltip}
          aria-describedby={breakdownTooltipId}
          tabIndex={0}
          className="group relative mt-1.5 flex max-w-full items-center gap-x-[14px] whitespace-nowrap overflow-visible border-t border-[#e6e3dc] pt-1.5 text-[10px] text-[#64748b] tabular-nums"
        >
          <span
            role="group"
            className="flex shrink-0 items-center gap-1"
            title={`Spent: ${formatAmount(spent)}`}
            aria-label={`Spent: ${formatAmount(spent)}`}
          >
            <Receipt aria-hidden="true" className="h-[13px] w-[13px] shrink-0 opacity-75" />
            <span className="font-medium">{formatAmount(spent)}</span>
          </span>
          <span
            role="group"
            className="flex shrink-0 items-center gap-1"
            title={`Share: ${formatAmount(share)}`}
            aria-label={`Share: ${formatAmount(share)}`}
          >
            <PieChart aria-hidden="true" className="h-[13px] w-[13px] shrink-0 opacity-75" />
            <span className="font-medium">{formatAmount(share)}</span>
          </span>
          <span
            role="group"
            className="flex shrink-0 items-center gap-1"
            title={`${cashFlowLabel}: ${netCashFlowLabel}`}
            aria-label={`${cashFlowLabel}: ${netCashFlowLabel}`}
          >
            <ArrowLeftRight aria-hidden="true" className="h-[13px] w-[13px] shrink-0 opacity-75" />
            <span className="font-medium">{netCashFlowLabel}</span>
          </span>
          <span
            id={breakdownTooltipId}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden max-w-[calc(100vw-2rem)] whitespace-normal rounded-md border border-[#e6e3dc] bg-white px-2.5 py-1.5 text-[10px] font-medium text-[#475569] shadow-md group-hover:block group-focus:block"
          >
            {breakdownTooltip}
          </span>
        </div>
      </div>
    );
  };

  return (
    <aside className="min-w-0 space-y-3 sm:space-y-4">
      <section className={cardClass}>
        <CardHeading
          title="Balances"
          right={(
            <button
              type="button"
              className={`${primaryButton} !px-3 !py-2 !text-xs`}
              onClick={() => onOpenTransfer()}
              disabled={transferLocked || members.length < 2}
            >
              Settle Up / Transfer
            </button>
          )}
        />
        <div className="space-y-1.5 p-3 sm:p-4">
          {unsettledMembers.map(renderBalanceCard)}
          {settledMembers.length > 0 && (
            <details className="rounded-lg border border-[#e6e3dc] bg-[#faf9f6]">
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[#64748b]">
                Settled ({settledMembers.length})
              </summary>
              <div className="space-y-2 border-t border-[#e6e3dc] p-2">
                {settledMembers.map(renderBalanceCard)}
              </div>
            </details>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <CardHeading title={`Members (${members.length})`} />
        <div className="p-3 sm:p-4">
          {colorNotice && <p role="status" className="mb-3 rounded-md border border-[#e4dccb] bg-[#faf7ef] px-3 py-2 text-xs text-[#6b5e45]">{colorNotice}</p>}
          <form onSubmit={handleAddMember} className="mb-3 flex gap-2">
            <input
              type="text"
              maxLength={60}
              aria-label="New member name"
              placeholder="Add a member"
              value={newMemberName}
              onChange={(event) => setNewMemberName(event.target.value)}
              className={`${fieldClass} flex-1`}
            />
            <button type="submit" className={primaryButton} aria-label="Add member">
              <Plus className="h-4 w-4" /><span className="hidden sm:inline">Add</span>
            </button>
          </form>
          <div className="divide-y divide-[#e2e8f0]">
            {members.map((name) => (
              <div key={name} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <MemberTag name={name} colors={colors} />
                    {name === currentUser && <span className="text-xs text-[#64748b]">You</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleColorEditor(name)}
                      aria-expanded={editingColorMember === name}
                      aria-label={`Change color for ${name}`}
                      title={`Change color for ${name}`}
                      className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-[#0f766e] transition hover:bg-[#f0fdfa]"
                    >
                      <span className="h-3.5 w-3.5 rounded-full border border-white" style={{ backgroundColor: memberColor(name, colors) }} /> Color
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingPaymentDetails(name)}
                      aria-expanded={editingPaymentMember === name}
                      aria-label={`Edit payment details for ${name}`}
                      title={`Edit payment details for ${name}`}
                      className="rounded-lg px-2 py-2 text-xs font-semibold text-[#0f766e] transition hover:bg-[#f0fdfa]"
                    >
                      Payment
                    </button>
                    {members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(name)}
                        aria-label={`Remove ${name}`}
                        title={`Remove ${name}`}
                        className="rounded-lg p-2 text-[#94a3b8] transition hover:bg-[#fff1f2] hover:text-[#be123c]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {editingPaymentMember === name ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3">
                    <label htmlFor={`payment-details-${name}`} className="block text-xs font-semibold text-[#475569]">Payment details</label>
                    <textarea
                      id={`payment-details-${name}`}
                      rows={2}
                      maxLength={200}
                      value={paymentDetailsDraft}
                      onChange={(event) => setPaymentDetailsDraft(event.target.value)}
                      placeholder="GCash, Maya, bank details, or QR link"
                      className={fieldClass}
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setEditingPaymentMember(null)} className={secondaryButton}>Cancel</button>
                      <button type="button" onClick={() => savePaymentDetails(name)} className={primaryButton}>Save</button>
                    </div>
                  </div>
                ) : memberPaymentDetails[name] ? (
                  <p className="mt-2 break-words text-xs text-[#64748b]">Payment: {memberPaymentDetails[name]}</p>
                ) : null}
                {editingColorMember === name && (
                  <div className="mt-3 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3">
                    <p className="mb-2 text-xs font-semibold text-[#475569]">Choose a color for {name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {MEMBER_PALETTE.map(({ label, hex }) => {
                        const selected = memberColor(name, colors).toLowerCase() === hex.toLowerCase();
                        return (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => onSaveColor(name, hex)}
                            title={label}
                            aria-label={`${label} for ${name}`}
                            aria-pressed={selected}
                            className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] ${selected ? 'border-[#0f172a]' : 'border-white'}`}
                            style={{ backgroundColor: hex }}
                          >
                            {selected && <Check className="h-4 w-4 text-white" />}
                          </button>
                        );
                      })}
                      <label title="Custom color" className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[#cbd5e1] bg-white text-[#334155] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#0f766e]">
                        <span aria-hidden="true" className="text-lg font-medium">+</span>
                        <input
                          type="color"
                          value={customColor}
                          aria-label={`Custom color for ${name}`}
                          onChange={(event) => setCustomColor(event.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                      <button type="button" className={`${secondaryButton} !px-2.5 !py-1.5 !text-xs`} onClick={() => onSaveColor(name, customColor)}>Apply custom</button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button type="button" className="px-2 py-1.5 text-xs font-semibold text-[#64748b] hover:underline" onClick={() => onResetColor(name)}>Reset</button>
                      <button type="button" aria-label="Close color picker" onClick={() => setEditingColorMember(null)} className="ml-auto p-1 text-[#64748b] hover:text-[#0f172a]">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </aside>
  );
}
