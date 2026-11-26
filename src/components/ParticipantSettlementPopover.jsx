import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getExpenseShares } from '../utils/splitShares';
import { MemberTag } from './roomUi';

export default function ParticipantSettlementPopover({
  expense,
  anchor,
  colors,
  currentUser,
  formatAmount,
  saving,
  onSetParticipant,
  onSetParticipants,
  onClose,
}) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState(null);
  const participants = [...new Set(expense.splitWith || [])];
  const settledMembers = new Set(expense.settledMemberIds || []);
  const shares = getExpenseShares(expense);
  const allSettled = participants.length > 0 && participants.every((member) => settledMembers.has(member));
  const shareStateKey = [...settledMembers].sort().join('|');

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !anchor?.isConnected) return;

    const anchorBounds = anchor.getBoundingClientRect();
    const panelWidth = Math.min(320, window.innerWidth - 24);
    const panelHeight = panel.offsetHeight;
    const placeAbove = window.innerHeight - anchorBounds.bottom < panelHeight + 8
      && anchorBounds.top > panelHeight + 8;
    const top = placeAbove
      ? anchorBounds.top - panelHeight - 8
      : Math.min(anchorBounds.bottom + 8, window.innerHeight - panelHeight - 12);
    const left = Math.max(12, Math.min(
      anchorBounds.right - panelWidth,
      window.innerWidth - panelWidth - 12,
    ));

    setPosition({ top, left, width: panelWidth });
  }, [anchor, expense, shareStateKey]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (panelRef.current?.contains(event.target) || anchor?.contains(event.target)) return;
      onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const handleScroll = (event) => {
      if (event.target === document || event.target === document.documentElement) onClose();
    };
    const handleResize = () => onClose();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Settle shares for ${expense.desc || 'transaction'}`}
      className="fixed z-[100] max-h-[70vh] overflow-y-auto rounded-lg border border-[#e6e3dc] bg-white p-3 shadow-xl"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 12,
        width: position?.width ?? 'min(320px, calc(100vw - 24px))',
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[#0f172a]">Participant shares</h3>
          <p className="mt-0.5 truncate text-xs text-[#64748b]" title={expense.desc}>{expense.desc}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[#f1f5f9] px-2 py-1 text-[11px] font-semibold tabular-nums text-[#475569]">
          {settledMembers.size}/{participants.length}
        </span>
      </div>

      {currentUser && participants.includes(currentUser) && !settledMembers.has(currentUser) && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSetParticipant(currentUser, true)}
          className="mb-2 w-full rounded-md border border-[#99f6e4] bg-[#f0fdfa] px-2.5 py-2 text-left text-xs font-semibold text-[#0f766e] hover:bg-[#ccfbf1] disabled:opacity-50"
        >
          Settle my share · {formatAmount(shares[currentUser] || 0)}
        </button>
      )}

      <ul className="space-y-1">
        {participants.map((member) => {
          const settled = settledMembers.has(member);
          return (
            <li key={member}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[#f8fafc]">
                <input
                  type="checkbox"
                  checked={settled}
                  disabled={saving}
                  onChange={(event) => onSetParticipant(member, event.target.checked)}
                  aria-label={`${settled ? 'Unsettle' : 'Settle'} ${member}'s share`}
                  className="h-4 w-4 shrink-0 accent-[#0f766e]"
                />
                <MemberTag name={member} colors={colors} small />
                <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-[#334155]">
                  {formatAmount(shares[member] || 0)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={saving || allSettled || !participants.length}
        onClick={() => onSetParticipants(participants, true)}
        className="mt-2 w-full rounded-md bg-[#0f766e] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#115e59] disabled:opacity-50"
      >
        Settle all ({participants.length}/{participants.length})
      </button>
    </div>,
    document.body,
  );
}
