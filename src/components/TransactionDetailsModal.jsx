import { formatDate } from '../utils/formatDate';
import { getExpenseShares } from '../utils/splitShares';
import { getPayers } from '../utils/tableTransactions';
import { secondaryButton } from '../utils/uiClasses';
import { MemberTag, ModalFrame } from './roomUi';

export default function TransactionDetailsModal({ expense, colors, formatAmount, onClose }) {
  if (!expense) return null;

  const payers = getPayers(expense);
  const participants = [...new Set([...(expense.splitWith || []), ...Object.keys(expense.splitShares || {})])];
  const shares = getExpenseShares(expense);
  const items = Array.isArray(expense.items) ? expense.items.filter((item) => item && (item.desc || item.amount)) : [];
  const dateLabel = formatDate(expense.datetime);

  return (
    <ModalFrame
      titleId="transaction-detail-title"
      title="Details"
      onClose={onClose}
      closeLabel="Close details"
    >
      <dl className="mt-4 space-y-4 text-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3">
          <dt className="text-[#64748b]">Date</dt>
          <dd className="font-medium tabular-nums">{dateLabel || '—'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[#64748b]">Amount</dt>
          <dd className="font-semibold">{formatAmount(expense.amount)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Paid by</dt>
          <dd className="mt-2 space-y-2">
            {payers.map((payer, index) => (
              <div key={`${payer.member}-${index}`} className="flex items-center justify-between gap-3">
                <MemberTag name={payer.member} colors={colors} small />
                <span className="font-medium">{formatAmount(payer.amount)}</span>
              </div>
            ))}
          </dd>
        </div>
        {participants.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Split between</dt>
            <dd className="mt-2 space-y-2">
              {participants.map((name) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <MemberTag name={name} colors={colors} small />
                  <span className="font-medium">{formatAmount(shares[name] || 0)}</span>
                </div>
              ))}
            </dd>
          </div>
        )}
        {items.length > 0 && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Items</dt>
            <dd className="mt-2 space-y-2">
              {items.map((item, index) => (
                <div key={`${item.desc}-${index}`} className="rounded-md border border-[#e6e3dc] px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words font-medium">{item.desc || `Item ${index + 1}`}</span>
                    <span className="shrink-0 font-medium">{formatAmount(item.amount)}</span>
                  </div>
                  {!!item.members?.length && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.members.map((name) => <MemberTag key={name} name={name} colors={colors} small />)}
                    </div>
                  )}
                </div>
              ))}
            </dd>
          </div>
        )}
        {expense.desc && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Note</dt>
            <dd className="mt-1 break-words text-[#334155]">{expense.desc}</dd>
          </div>
        )}
      </dl>
      <button type="button" onClick={onClose} className={`${secondaryButton} mt-5 w-full justify-center`}>Close</button>
    </ModalFrame>
  );
}
