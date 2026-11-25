import { Monitor, Moon, Sun, X } from 'lucide-react';
import { memberColor } from '../utils/memberColor';

export function MemberTag({ name, colors, small = false }) {
  const color = memberColor(name, colors);
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border font-medium ${small ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}
      style={{ backgroundColor: `${color}12`, borderColor: `${color}55`, color: '#0f172a' }}
      data-member-chip="true"
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export function CardHeading({ title, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6e3dc] px-3 py-2.5 sm:px-4 sm:py-3">
      <h2 className="text-sm font-bold tracking-tight text-[#0f172a]">{title}</h2>
      {right}
    </div>
  );
}

export function ThemeSelector({ theme, setTheme }) {
  const options = [
    { value: 'light', label: 'Light theme', Icon: Sun },
    { value: 'dark', label: 'Dark theme', Icon: Moon },
    { value: 'system', label: 'Use system theme', Icon: Monitor },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white p-1" role="group" aria-label="Appearance">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          aria-label={label}
          aria-pressed={theme === value}
          title={label}
          className={`rounded-md p-1.5 transition ${theme === value ? 'bg-[#0f766e] text-white' : 'text-[#64748b] hover:bg-[#f1f5f9]'}`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export function ModalFrame({
  title,
  titleId,
  subtitle,
  onClose,
  closeDisabled = false,
  closeLabel = 'Close',
  panelClassName = 'sm:max-w-md',
  children,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl sm:p-6 ${panelClassName}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-[#0f172a]">{title}</h2>
            {subtitle && <p className="mt-1 break-words text-sm text-[#64748b]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label={closeLabel}
            className="rounded-md p-1.5 text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
