import { evaluateAmount } from '../utils/amountExpression';
import { primaryButton, secondaryButton, fieldClass } from '../utils/uiClasses';
import DateField from './DateField';
import { ModalFrame } from './roomUi';

export default function SettlementModal({
  draft,
  members,
  formatAmount,
  memberPaymentDetails = {},
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  if (!draft) return null;

  const parsedAmount = evaluateAmount(draft.amount);
  const samePerson = draft.from && draft.from === draft.to;

  const update = (patch) => onChange({ ...draft, ...patch });

  const chooseFrom = (from) => {
    update({ from, to: draft.to === from ? '' : draft.to });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.from || !draft.to || draft.from === draft.to) {
      window.alert('Choose two different members.');
      return;
    }
    if (parsedAmount === null || parsedAmount <= 0) {
      window.alert('Enter a valid amount greater than 0.');
      return;
    }
    if (!draft.date) {
      window.alert('Choose a valid date.');
      return;
    }
    onSubmit({
      from: draft.from,
      to: draft.to,
      amount: parsedAmount,
      note: draft.note.trim(),
      date: draft.date,
    });
  };

  return (
    <ModalFrame
      titleId="settlement-title"
      title="Settle up / Transfer"
      onClose={onClose}
      closeDisabled={saving}
      closeLabel="Close settlement"
      panelClassName="sm:max-w-lg"
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settlement-from" className="mb-2 block text-sm font-semibold text-[#334155]">From (Payer)</label>
            <select
              id="settlement-from"
              value={draft.from}
              onChange={(event) => chooseFrom(event.target.value)}
              disabled={saving}
              className={fieldClass}
            >
              {members.map((name) => (
                <option key={name} value={name} disabled={name === draft.to}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settlement-to" className="mb-2 block text-sm font-semibold text-[#334155]">To (Recipient)</label>
            <select
              id="settlement-to"
              value={draft.to}
              onChange={(event) => update({ to: event.target.value })}
              disabled={saving}
              required
              className={fieldClass}
            >
              <option value="" disabled>Select recipient</option>
              {members.map((name) => (
                <option key={name} value={name} disabled={name === draft.from}>{name}</option>
              ))}
            </select>
            {draft.to && memberPaymentDetails[draft.to] && (
              <div className="mt-2 rounded-md border border-[#d5e3de] bg-[#f2f8f5] px-3 py-2">
                <p className="text-xs font-semibold text-[#315d53]">Recipient payment details</p>
                <p className="mt-1 break-words text-sm text-[#173f37]">{memberPaymentDetails[draft.to]}</p>
              </div>
            )}
          </div>
        </div>
        {samePerson && <p role="alert" className="text-sm text-[#b91c1c]">Choose two different members.</p>}
        <div>
          <label htmlFor="settlement-amount" className="mb-2 block text-sm font-semibold text-[#334155]">Amount</label>
          <input
            id="settlement-amount"
            type="text"
            inputMode="decimal"
            required
            value={draft.amount}
            onChange={(event) => update({ amount: event.target.value })}
            placeholder="0.00 or 100+50"
            disabled={saving}
            className={fieldClass}
          />
          {draft.amount.trim() && (
            <p className="mt-1 text-xs text-[#64748b]">
              {parsedAmount === null || parsedAmount <= 0
                ? <span className="text-[#be123c]">Enter a valid amount greater than 0</span>
                : <span className="font-semibold tabular-nums text-[#0f766e]">= {formatAmount(parsedAmount)}</span>}
            </p>
          )}
        </div>
        <DateField id="settlement-date" label="Date" value={draft.date} onChange={(date) => update({ date })} required />
        <div>
          <label htmlFor="settlement-note" className="mb-2 block text-sm font-semibold text-[#334155]">Note</label>
          <input
            id="settlement-note"
            type="text"
            maxLength={150}
            value={draft.note}
            onChange={(event) => update({ note: event.target.value })}
            placeholder="Optional"
            disabled={saving}
            className={fieldClass}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e6e3dc] pt-4">
          <button type="button" onClick={onClose} disabled={saving} className={secondaryButton}>Cancel</button>
          <button type="submit" disabled={saving || samePerson} className={primaryButton}>
            {saving ? 'Saving…' : 'Record'}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
