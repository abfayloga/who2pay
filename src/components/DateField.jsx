import { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDate, toIsoDate } from '../utils/formatDate';
import { fieldClass } from '../utils/uiClasses';

export default function DateField({
  id,
  value,
  onChange,
  required = false,
  label,
  labelClassName = 'mb-2 block text-sm font-semibold text-[#334155]',
}) {
  const dateInputRef = useRef(null);
  const iso = toIsoDate(value);
  const formatted = iso ? formatDate(iso) : '';

  const openCalendar = () => {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  };

  return (
    <div className="min-w-0">
      {label && <label htmlFor={id} className={labelClassName}>{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={openCalendar}
          className={`${fieldClass} flex items-center justify-between text-left`}
          aria-label={formatted ? `Choose date, ${formatted}` : 'Choose date'}
          aria-haspopup="dialog"
        >
          <span className={formatted ? 'text-[#0f172a]' : 'text-[#94a3b8]'}>{formatted || 'MM/DD/YYYY'}</span>
          <CalendarDays className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden="true" />
        </button>
        <input
          ref={dateInputRef}
          id={id}
          type="date"
          required={required}
          value={iso}
          onChange={(event) => onChange(toIsoDate(event.target.value))}
          aria-label={formatted ? `${label || 'Date'} ${formatted}` : (label || 'Date')}
          tabIndex={-1}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      </div>
    </div>
  );
}
