import { Activity, Check, Copy, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CURRENCIES } from '../utils/currency';
import { secondaryButton } from '../utils/uiClasses';
import { ThemeSelector } from './roomUi';

export default function RoomHeader({
  roomName,
  currentUser,
  onSwitchUser,
  currency,
  savingCurrency,
  onCurrencyChange,
  copied,
  onCopyLink,
  theme,
  setTheme,
  onOpenActivity,
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[#e6e3dc] bg-white">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/" aria-label="Who2Pay home" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0f766e] text-white sm:h-10 sm:w-10">
            <Wallet className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold sm:text-base">{roomName}</h1>
            <p className="text-xs text-[#64748b]">
              Viewing as <span className="font-semibold text-[#334155]">{currentUser}</span>
              <button type="button" onClick={onSwitchUser} className="ml-2 font-semibold text-[#0f766e] hover:underline">Switch</button>
            </p>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
          <label htmlFor="room-currency" className="sr-only">Room currency</label>
          <select
            id="room-currency"
            value={currency || 'PHP'}
            onChange={(event) => onCurrencyChange(event.target.value)}
            disabled={savingCurrency}
            title="Currency for this room"
            className="min-w-0 max-w-[146px] rounded-lg border border-[#cbd5e1] bg-white px-1.5 py-2 text-xs font-medium text-[#334155] focus:border-[#0f766e] focus:outline-none disabled:opacity-50 sm:max-w-none sm:px-2 sm:text-sm"
          >
            {CURRENCIES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
          </select>
          <ThemeSelector theme={theme} setTheme={setTheme} />
          <button type="button" onClick={onOpenActivity} className={`${secondaryButton} !px-2`} title="Room activity" aria-label="Room activity">
            <Activity className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCopyLink} className={secondaryButton}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
          <Link to="/" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#334155]">Exit</Link>
        </div>
      </div>
    </header>
  );
}
