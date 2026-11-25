import { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { getExpenseShares } from '../utils/splitShares';
import { MEMBER_PALETTE, memberColor } from '../utils/memberColor';
import { cardClass, fieldClass, primaryButton, secondaryButton } from '../utils/uiClasses';
import { CardHeading, MemberTag } from './roomUi';

function RepaymentRow({ suggestion, currentUser, formatAmount, onOpen, locked }) {
  const incoming = suggestion.to === currentUser;
  const label = incoming ? 'Received' : 'Settle';
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d5e3de] bg-white px-3 py-2">
      <button
        type="button"
        onClick={() => onOpen(suggestion)}
        disabled={locked}
        className="min-w-0 flex-1 rounded-md text-left text-xs text-[#475569] disabled:opacity-50"
      >
        <strong className="text-[#0f172a]">{suggestion.from}</strong> pays <strong className="text-[#0f172a]">{suggestion.to}</strong>
        <strong className="ml-2 text-[#0f172a]">{formatAmount(suggestion.amount)}</strong>
      </button>
      <button
        type="button"
        disabled={locked}
        onClick={() => onOpen(suggestion)}
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
  const pendingTotal = settlements
    .filter((entry) => entry.from === currentUser)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const receivableTotal = settlements
    .filter((entry) => entry.to === currentUser)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const relevantSettlements = settlements.filter((entry) => entry.from === currentUser || entry.to === currentUser);

  return (
    <div>
      <div className="mb-3 sm:mb-6">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Overview</h2>
        <p className="mt-1 text-sm text-[#77756e]">{roomName} · {members.length} members · {currency}</p>
      </div>
      <div className="mb-4 grid grid-cols-1 items-start gap-3 sm:mb-7 sm:grid-cols-2 sm:gap-4">
        <section className="rounded-lg border border-[#247367] border-l-[5px] bg-[#f2f8f5] px-3 py-3 sm:px-5 sm:py-5" aria-label="Group and individual expenses">
          <h3 className="text-sm font-medium text-[#315d53]">Total group expenses</h3>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-[#173f37] sm:mt-2 sm:text-3xl">{formatAmount(totalExpenses)}</p>
          <div className="mt-3 border-t border-[#c8ded4] pt-2 sm:mt-4 sm:pt-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#315d53]">Individual expenses</h4>
            {individualExpenses.length ? (
              <div className="space-y-1 sm:space-y-2">
                {individualExpenses.map(({ name, share }) => (
                  <div key={name} className="flex items-center justify-between gap-3 text-sm">
                    <MemberTag name={name} colors={colors} small />
                    <span className="font-semibold tabular-nums text-[#173f37]">{formatAmount(share)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-[#627c74]">No members yet.</p>}
          </div>
        </section>
        <section className="rounded-lg border border-[#b8793d] border-l-[5px] bg-[#fff7ed] px-3 py-3 sm:px-5 sm:py-5" aria-label="Your pending settlements">
          <h3 className="text-sm font-medium text-[#905a28]">Your pending settlements</h3>
          <p className="mt-2 text-sm text-[#75431e]">
            <span className="font-semibold">To pay: {formatAmount(pendingTotal)}</span>
            <span className="mx-2 text-[#b8793d]">·</span>
            <span className="font-semibold">To receive: {formatAmount(receivableTotal)}</span>
          </p>
          {relevantSettlements.length ? (
            <div className="mt-3 space-y-2 border-t border-[#ead4bb] pt-2 sm:mt-4 sm:pt-3">
              {relevantSettlements.map((suggestion, index) => {
                const incoming = suggestion.to === currentUser;
                return (
                  <div key={`${suggestion.from}:${suggestion.to}:${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#ead4bb] bg-white px-2.5 py-2 sm:px-3 sm:py-3">
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
                      onClick={() => onOpenTransfer(suggestion)}
                      className={`${primaryButton} !px-3 !py-2 !text-xs`}
                    >
                      {incoming ? 'Received' : 'Settle'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : <p className="mt-4 border-t border-[#ead4bb] pt-3 text-sm text-[#905a28]">You’re all settled up.</p>}
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
  settlements,
  currentUser,
  formatAmount,
  onOpenTransfer,
  transferLocked,
  onAddMember,
  onRemoveMember,
  onSaveColor,
  onResetColor,
  colorNotice,
}) {
  const [newMemberName, setNewMemberName] = useState('');
  const [editingColorMember, setEditingColorMember] = useState(null);
  const [customColor, setCustomColor] = useState(MEMBER_PALETTE[0].hex);

  const toggleColorEditor = (name) => {
    setEditingColorMember((current) => (current === name ? null : name));
    setCustomColor(memberColor(name, colors));
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    const added = await onAddMember(newMemberName);
    if (added) setNewMemberName('');
  };

  return (
    <aside className="min-w-0 space-y-4 sm:space-y-6">
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
        <div className="space-y-2 p-3 sm:space-y-3 sm:p-6">
          {members.map((name) => {
            const balance = balances[name] || 0;
            return (
              <div key={name} className="rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <MemberTag name={name} colors={colors} small />
                  <span className={`text-sm font-semibold ${balance > 0.01 ? 'text-[#047857]' : balance < -0.01 ? 'text-[#be123c]' : 'text-[#64748b]'}`}>
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
                    locked={transferLocked}
                  />
                ))}
                <div className="mt-2 flex flex-wrap justify-between gap-2 border-t border-[#e6e3dc] pt-2 text-xs text-[#64748b]">
                  <span>Paid: {formatAmount(totalPaid[name])}</span>
                  <span>Share: {formatAmount(totalShare[name])}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={cardClass}>
        <CardHeading title={`Members (${members.length})`} />
        <div className="p-3 sm:p-6">
          {colorNotice && <p role="status" className="mb-3 rounded-md border border-[#e4dccb] bg-[#faf7ef] px-3 py-2 text-xs text-[#6b5e45]">{colorNotice}</p>}
          <form onSubmit={handleAddMember} className="mb-4 flex gap-2">
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
