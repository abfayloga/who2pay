import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { Link, useParams } from 'react-router-dom';
import { getRoomData, normalizeRoomData, saveRoomData } from '../utils/storage';
import { calculateFinancials, transfersForExpense } from '../utils/settlement';
import { supabase } from '../utils/supabase';
import { TABLE_HEADERS, parseImportedTransactions, tableRowForTransaction } from '../utils/tableTransactions';
import { evaluateAmount } from '../utils/amountExpression';
import { getExpenseShares, validateCustomShares, itemizedShares, fillRemainingEqually } from '../utils/splitShares';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  Download,
  Eye,
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
  Moon,
  Sun,
  Monitor,
  X,
} from 'lucide-react';

// All new and existing rooms use the same default palette. Custom choices are
// saved in room.memberColors and shared through the existing room data/realtime.
const MEMBER_PALETTE = [
  { label: 'Red', hex: '#dc2626' },
  { label: 'Orange', hex: '#ea580c' },
  { label: 'Yellow', hex: '#ca8a04' },
  { label: 'Green', hex: '#16a34a' },
  { label: 'Teal', hex: '#0d9488' },
  { label: 'Cyan', hex: '#0891b2' },
  { label: 'Blue', hex: '#2563eb' },
  { label: 'Indigo', hex: '#4f46e5' },
  { label: 'Purple', hex: '#9333ea' },
  { label: 'Pink', hex: '#db2777' },
  { label: 'Brown', hex: '#92400e' },
  { label: 'Gray', hex: '#64748b' },
];
const CURRENCIES = [
  { code: 'PHP', label: 'PHP · Philippine Peso' },
  { code: 'USD', label: 'USD · US Dollar' },
  { code: 'EUR', label: 'EUR · Euro' },
  { code: 'GBP', label: 'GBP · British Pound' },
  { code: 'JPY', label: 'JPY · Japanese Yen' },
  { code: 'SGD', label: 'SGD · Singapore Dollar' },
  { code: 'AUD', label: 'AUD · Australian Dollar' },
  { code: 'CAD', label: 'CAD · Canadian Dollar' },
  { code: 'KRW', label: 'KRW · South Korean Won' },
  { code: 'VND', label: 'VND · Vietnamese Dong' },
];
const formatCurrency = (value, currency = 'PHP') => {
  const code = CURRENCIES.some((option) => option.code === currency) ? currency : 'PHP';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number(value) || 0);
};
// Separate date/time controls avoid overflowing native datetime-local fields on iOS.
function DateTimeFields({ idBase, value, onChange }) {
  const date = value?.slice(0, 10) || '';
  const time = value?.slice(11, 16) || '00:00';
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] gap-2">
      <div className="min-w-0">
        <label htmlFor={`${idBase}-date`} className="mb-1 block text-xs text-[#64748b]">Date</label>
        <input id={`${idBase}-date`} type="date" required value={date}
          onChange={(event) => onChange(`${event.target.value}T${time}`)}
          className={`${fieldClass} block w-full min-w-0 max-w-full !px-2 sm:!px-3 `} />
      </div>
      <div className="min-w-0">
        <label htmlFor={`${idBase}-time`} className="mb-1 block text-xs text-[#64748b]">Time</label>
        <input id={`${idBase}-time`} type="time" required value={time}
          onChange={(event) => onChange(`${date}T${event.target.value}`)}
          className={`${fieldClass} block w-full min-w-0 max-w-full !px-2 sm:!px-3 `} />
      </div>
    </div>
  );
}

const fieldClass = 'w-full min-w-0 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2.5 text-sm text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#0f766e] focus:ring-2 focus:ring-[#ccfbf1]';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:cursor-not-allowed disabled:opacity-50';
const cardClass = 'rounded-lg border border-[#dedbd4] bg-white';

const getNowDatetime = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};



const formatDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).replace('T', ' ')
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const getPayers = (expense) =>
  Array.isArray(expense.payers) && expense.payers.length
    ? expense.payers
    : [{ member: expense.paidBy || 'Unknown', amount: expense.amount }];

const defaultMemberColor = (name) => {
  let hash = 0;
  for (const char of String(name || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return MEMBER_PALETTE[Math.abs(hash % MEMBER_PALETTE.length)].hex;
};

const memberColor = (name, colors = {}) => {
  const chosen = colors?.[name];
  return typeof chosen === 'string' && /^#[0-9a-fA-F]{6}$/.test(chosen)
    ? chosen
    : defaultMemberColor(name);
};

const tagStyle = (name, colors) => {
  const color = memberColor(name, colors);
  return { backgroundColor: `${color}12`, borderColor: `${color}55`, color: '#0f172a' };
};

function MemberTag({ name, colors, small = false }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border font-medium ${small ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}
      style={tagStyle(name, colors)} data-member-chip='true'
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: memberColor(name, colors) }} aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

function CardHeading({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e6e3dc] px-3 py-3 sm:px-6 sm:py-4">
      <div>
        <h2 className="text-base font-bold tracking-tight text-[#0f172a]">{title}</h2>
        {subtitle && <p className="mt-1 text-xs leading-5 text-[#64748b]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// Escape both HTML markup and spreadsheet formulas from user-entered names and memos.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const csvCell = (value) => {
  const original = String(value ?? '');
  const safe = /^[\s]*[=+@\-\t\r]/.test(original) ? `'${original}` : original;
  return `"${safe.replace(/"/g, '""')}"`;
};

const fileSlug = (value) =>
  (String(value || 'room').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'room');


function ThemeSelector({ theme, setTheme, resolvedTheme }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white p-1" role="group" aria-label="Appearance">
      {[
        { value: 'light', label: 'Light theme', Icon: Sun },
        { value: 'dark', label: 'Dark theme', Icon: Moon },
        { value: 'system', label: 'Use system theme', Icon: Monitor },
      ].map(({ value, label, Icon }) => (
        <button key={value} type="button" onClick={() => setTheme(value)}
          aria-label={label} aria-pressed={theme === value} title={label}
          className={`rounded-md p-1.5 transition ${theme === value ? 'bg-[#0f766e] text-white' : 'text-[#64748b] hover:bg-[#f1f5f9]'}`}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

export default function Room() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { roomId } = useParams();
  const formRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const formatAmount = (value) => formatCurrency(value, room?.currency || 'PHP');
  const [currentUser, setCurrentUser] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [copied, setCopied] = useState(false);
  const [settlingKey, setSettlingKey] = useState(null);
  const [settlementExpenseId, setSettlementExpenseId] = useState(null);
  const [selectedRepayments, setSelectedRepayments] = useState([]);
  const [editingColorMember, setEditingColorMember] = useState(null);
  const [customColor, setCustomColor] = useState(MEMBER_PALETTE[0].hex);
  const [localMemberColors, setLocalMemberColors] = useState({});
  const [colorNotice, setColorNotice] = useState('');
  const colorCacheKey = `who2pay:member-colors:${roomId}`;

  const readCachedColors = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem(colorCacheKey) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  };

  const cacheColors = (next) => {
    setLocalMemberColors(next);
    try { window.localStorage.setItem(colorCacheKey, JSON.stringify(next)); }
    catch { setColorNotice('Browser storage is unavailable. Color changes may not survive a refresh.'); }
  };

  const [viewingSplitExpenseId, setViewingSplitExpenseId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [payerMode, setPayerMode] = useState('single');
  const [paidBy, setPaidBy] = useState('');
  const [payerShares, setPayerShares] = useState({});
  const [splitWith, setSplitWith] = useState([]);
  const [splitMethod, setSplitMethod] = useState('equal');
  const [customShares, setCustomShares] = useState({});
  const [lineItems, setLineItems] = useState([{ id: 'first', desc: '', amount: '', members: [] }]);
  const [datetime, setDatetime] = useState(getNowDatetime);

  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('EXPENSE');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importSaving, setImportSaving] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    setRoom(null);
    setLocalMemberColors(readCachedColors());

    const loadRoom = async () => {
      try {
        const data = await getRoomData(roomId);
        if (!active) return;
        if (!data) {
          setLoadError('This room could not be found. Check the link and try again.');
        } else {
          setRoom(data);
          // Keep a local fallback when older storage schemas omit memberColors.
          if (data.memberColors && Object.keys(data.memberColors).length) {
            const merged = { ...readCachedColors(), ...data.memberColors };
            cacheColors(merged);
          }
          const savedUser = sessionStorage.getItem(`session_${roomId}`);
          const matchingUser = (data.members || []).find((name) => name === savedUser);
          if (matchingUser) {
            setCurrentUser(matchingUser);
            setPaidBy(matchingUser);
            setSplitWith(data.members || []);
          } else {
            setCurrentUser('');
          }
        }
      } catch (error) {
        console.error('Could not load room:', error);
        if (active) setLoadError('Unable to load this room right now. Please refresh and try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadRoom();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}`,
      }, (payload) => {
        if (active && payload.new) {
          const updatedRoom = normalizeRoomData(payload.new);
          setRoom(updatedRoom);
          if (updatedRoom.memberColors && Object.keys(updatedRoom.memberColors).length) {
            cacheColors({ ...readCachedColors(), ...updatedRoom.memberColors });
          }
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const save = async (nextRoom) => {
    const previous = room;
    setRoom(nextRoom);
    setSaveError('');
    try {
      await saveRoomData(roomId, nextRoom);
      return true;
    } catch (error) {
      console.error('Room update failed:', error);
      setSaveError('Your changes could not be saved. Please try again.');
      setRoom(previous);
      return false;
    }
  };

  const selectUser = (name, members) => {
    setCurrentUser(name);
    setPaidBy(name);
    setSplitWith(members);
    sessionStorage.setItem(`session_${roomId}`, name);
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    if (!nameInput.trim() || !room) return;
    const requestedName = nameInput.trim();
    const existingName = (room.members || []).find((name) => name.toLowerCase() === requestedName.toLowerCase());
    const name = existingName || requestedName;
    const members = existingName ? room.members : [...(room.members || []), name];
    if (!existingName && !(await save({ ...room, members }))) return;
    selectUser(name, members);
  };

  const handleSwitchUser = () => {
    sessionStorage.removeItem(`session_${roomId}`);
    setCurrentUser('');
    setEditingColorMember(null);
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    const name = newMemberName.trim();
    if (!name || !room) return;
    if ((room.members || []).some((member) => member.toLowerCase() === name.toLowerCase())) {
      window.alert('A member with this name already exists.');
      return;
    }
    if (await save({ ...room, members: [...room.members, name] })) {
      setSplitWith((previous) => [...previous, name]);
      setNewMemberName('');
    }
  };

  const handleRemoveMember = async (name) => {
    if (!window.confirm(`Remove "${name}" from this group? Existing transactions will be kept.`)) return;
    const members = room.members.filter((member) => member !== name);
    const colors = { ...(room.memberColors || {}) };
    delete colors[name];
    const cached = { ...localMemberColors };
    delete cached[name];
    cacheColors(cached);
    if (!(await save({ ...room, members, memberColors: colors }))) return;
    setSplitWith((previous) => previous.filter((member) => member !== name));
    setPayerShares((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
    if (editingColorMember === name) setEditingColorMember(null);
    if (currentUser === name) handleSwitchUser();
  };

  const saveMemberColor = async (name, hex) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    // Update visible color immediately and retain it in this browser even when
    // the backend's rooms schema doesn't yet store the memberColors field.
    const nextColors = { ...localMemberColors, ...room.memberColors, [name]: hex };
    cacheColors(nextColors);
    setColorNotice('Color applied. For cross-device sharing, your storage utility must persist memberColors.');
    try {
      await saveRoomData(roomId, { ...room, memberColors: nextColors });
      setRoom(previous => ({ ...previous, memberColors: nextColors }));
    } catch (error) {
      console.warn('Member colors saved to this browser only:', error);
      setColorNotice('Color saved in this browser only; the room database did not accept the update.');
    }
  };

  const resetMemberColor = async (name) => {
    const nextColors = { ...localMemberColors, ...room.memberColors };
    delete nextColors[name];
    cacheColors(nextColors);
    setRoom(previous => ({ ...previous, memberColors: nextColors }));
    try { await saveRoomData(roomId, { ...room, memberColors: nextColors }); }
    catch (error) {
      console.warn('Member color reset saved to this browser only:', error);
      setColorNotice('Default color restored in this browser only.');
    }
  };

  const toggleColorEditor = (name) => {
    setEditingColorMember((previous) => previous === name ? null : name);
    setCustomColor(memberColor(name, { ...(room.memberColors || {}), ...localMemberColors }));
  };

  const multiplePayersTotal = Object.values(payerShares).reduce(
    (total, value) => total + (evaluateAmount(value) || 0), 0
  );

  const handleStartEdit = (expense) => {
    if ((room.expenses || []).some((entry) => entry.isSettlement && String(entry.sourceExpenseId) === String(expense.id))) {
      window.alert('Remove the linked settlement records before editing this expense.');
      return;
    }
    setEditingExpenseId(expense.id);
    setDesc(expense.desc || '');
    setDatetime(expense.datetime || getNowDatetime());
    setSplitWith(expense.splitWith || room.members);
    setSplitMethod(expense.splitMethod || (expense.splitShares ? 'custom' : 'equal'));
    setCustomShares(Object.fromEntries(Object.entries(expense.splitShares || {}).map(([k,v]) => [k, String(v)])));
    setLineItems(expense.items?.length ? expense.items.map((item, i) => ({...item, id: item.id || `line-${i}`})) : [{ id: 'first', desc: '', amount: '', members: [] }]);
    const payers = getPayers(expense);
    if (payers.length > 1) {
      setPayerMode('multiple');
      setPayerShares(Object.fromEntries(payers.map((payer) => [payer.member, String(payer.amount)])));
      setAmount('');
    } else {
      setPayerMode('single');
      setAmount(String(expense.amount));
      setPaidBy(payers[0]?.member || currentUser || room.members[0] || '');
      setPayerShares({});
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCancelEdit = () => {
    setEditingExpenseId(null);
    setDesc('');
    setAmount('');
    setPayerShares({});
    setPayerMode('single');
    setPaidBy(currentUser || room?.members?.[0] || '');
    setSplitWith(room?.members || []);
    setSplitMethod('equal');
    setCustomShares({});
    setLineItems([{ id: 'first', desc: '', amount: '', members: [] }]);
    setDatetime(getNowDatetime());
  };

  const handleSubmitExpense = async (event) => {
    event.preventDefault();
    if (!room || (splitMethod !== 'items' && !splitWith.length)) {
      window.alert('Choose at least one member to split with.');
      return;
    }

    let finalPayers = [];
    if (payerMode === 'single') {
      const parsed = evaluateAmount(amount);
      if (!Number.isFinite(parsed) || parsed <= 0 || !paidBy) {
        window.alert('Enter a valid amount and payer.');
        return;
      }
      finalPayers = [{ member: paidBy, amount: parsed }];
    } else {
      if (Object.values(payerShares).some((value) => String(value).trim() && evaluateAmount(value) === null)) {
        window.alert('Fix the invalid payer calculation before saving.');
        return;
      }
      finalPayers = Object.entries(payerShares)
        .map(([member, value]) => ({ member, amount: evaluateAmount(value) || 0 }))
        .filter(({ member, amount: paid }) => room.members.includes(member) && paid > 0);
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
        savedItems = lineItems.map(({ desc, amount, members }) => ({ desc, amount: evaluateAmount(String(amount)), members }));
      }
    } catch (error) { window.alert(error.message); return; }
    const primaryPaidBy = finalPayers.length === 1 ? finalPayers[0].member : `${finalPayers.length} payers`;
    const payload = {
      desc: desc.trim() || 'General Expense', amount: finalAmount, paidBy: primaryPaidBy,
      payers: finalPayers, splitWith: finalMembers, splitMethod,
      ...(finalSplitShares ? { splitShares: finalSplitShares } : { splitShares: null }),
      items: savedItems || [], datetime: datetime || getNowDatetime(),
      isSettlement: false,
    };

    if (editingExpenseId !== null) {
      const expenses = room.expenses.map((expense) =>
        expense.id === editingExpenseId ? { ...expense, ...payload } : expense
      );
      if (await save({ ...room, expenses })) handleCancelEdit();
    } else {
      const expense = { id: Date.now(), ...payload };
      if (await save({ ...room, expenses: [expense, ...(room.expenses || [])] })) {
        setDesc('');
        setAmount('');
        setPayerShares({});
        setSplitMethod('equal'); setCustomShares({});
        setLineItems([{ id: 'first', desc: '', amount: '', members: [] }]);
        setDatetime(getNowDatetime());
      }
    }
  };

  // Rebuild the list from saved settlements, rather than storing checkbox state
  // in the database. This also supports older linked records without an index.
  const getExpenseRepayments = (expense, entries = room?.expenses || []) => {
    const transfers = transfersForExpense(expense);
    const recorded = entries.filter((entry) =>
      entry.isSettlement && String(entry.sourceExpenseId) === String(expense.id)
    );
    const usedLegacy = new Set();
    return transfers.map((transfer, index) => {
      const exact = recorded.find((entry) => Number(entry.sourceTransferIndex) === index);
      let matched = exact;
      if (!matched) {
        const legacyIndex = recorded.findIndex((entry, i) =>
          entry.sourceTransferIndex == null && !usedLegacy.has(i) &&
          (entry.paidBy === transfer.from || entry.payers?.[0]?.member === transfer.from) &&
          entry.splitWith?.includes(transfer.to) &&
          Math.abs(Number(entry.amount) - transfer.amount) < 0.005
        );
        if (legacyIndex !== -1) {
          usedLegacy.add(legacyIndex);
          matched = recorded[legacyIndex];
        }
      }
      return { ...transfer, index, paid: Boolean(matched) };
    });
  };

  const openExpenseSettlement = (expense) => {
    if (settlingKey !== null) return;
    setSettlementExpenseId(expense.id);
    setSelectedRepayments([]);
  };

  const handleSettleExpense = async () => {
    const expense = (room?.expenses || []).find((item) =>
      String(item.id) === String(settlementExpenseId) && !item.isSettlement
    );
    if (!expense || settlingKey !== null) return;
    const repayments = getExpenseRepayments(expense);
    const selected = repayments.filter((transfer) =>
      !transfer.paid && selectedRepayments.includes(transfer.index)
    );
    if (!selected.length) return;
    if (!window.confirm(
      `Record ${selected.length} completed payment(s) for "${expense.desc}"?\n\n` +
      selected.map(({ from, to, amount }) => `${from} → ${to}: ${formatAmount(amount)}`).join('\n') +
      '\n\nOnly confirm payments that have actually occurred. No money is transferred.'
    )) return;
    setSettlingKey(`expense:${expense.id}`);
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = getNowDatetime();
    const settlementEntries = selected.map(({ from, to, amount, index }) => ({
      id: `${batchId}-${index}`,
      desc: `Settlement for ${expense.desc}: ${from} → ${to}`,
      amount,
      paidBy: from,
      payers: [{ member: from, amount }],
      splitWith: [to],
      datetime: timestamp,
      isSettlement: true,
      sourceExpenseId: expense.id,
      sourceTransferIndex: index,
      settlementBatchId: batchId,
    }));
    try {
      if (await save({ ...room, expenses: [...settlementEntries, ...(room.expenses || [])] })) {
        setSettlementExpenseId(null);
        setSelectedRepayments([]);
      }
    } finally {
      setSettlingKey(null);
    }
  };

  const handleRemoveExpense = async (id) => {
    if ((room.expenses || []).some((entry) => entry.isSettlement && String(entry.sourceExpenseId) === String(id))) {
      window.alert('Remove the linked settlement records before deleting this expense.');
      return;
    }
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    const expenses = (room.expenses || []).filter((expense) => expense.id !== id);
    if (await save({ ...room, expenses }) && editingExpenseId === id) handleCancelEdit();
  };

  const handleSettle = async (from, to, amount) => {
    // Any room member may record a completed transfer on behalf of another pair.
    // Always confirm the named payer and recipient before changing group balances.
    if (settlingKey !== null || !room?.members?.includes(currentUser)) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0 || from === to ||
        !room.members.includes(from) || !room.members.includes(to)) return;
    const participant = from === currentUser || to === currentUser;
    const confirmation = participant
      ? `Record ${from} paying ${formatAmount(parsed)} to ${to}? Only confirm if the money has actually changed hands. This does not transfer money.`
      : `Record a payment between OTHER members?\n\n${from} pays ${formatAmount(parsed)} to ${to}.\n\nOnly confirm if they have already completed this payment. This will change everyone's shared balances but will NOT transfer money.`;
    if (!window.confirm(confirmation)) return;
    const key = `${from}:${to}:${parsed}`;
    setSettlingKey(key);
    const expense = {
      id: Date.now(),
      desc: `Settlement: ${from} → ${to}`,
      amount: parsed,
      paidBy: from,
      payers: [{ member: from, amount: parsed }],
      splitWith: [to],
      datetime: getNowDatetime(),
      isSettlement: true,
    };
    try {
      await save({ ...room, expenses: [expense, ...(room.expenses || [])] });
    } finally {
      setSettlingKey(null);
    }
  };

  const toggleSplitMember = (member) => setSplitWith((previous) =>
    previous.includes(member) ? previous.filter((name) => name !== member) : [...previous, member]
  );

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      window.alert('Could not copy the link. Please copy it from your browser address bar.');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setMemberFilter('ALL');
    setTypeFilter('EXPENSE');
    setStartDate('');
    setEndDate('');
  };

  const hasFilters = Boolean(searchQuery || startDate || endDate || memberFilter !== 'ALL' || typeFilter !== 'EXPENSE');
  const colors = { ...(room?.memberColors || {}), ...localMemberColors };
  const expenses = room?.expenses || [];
  const filteredExpenses = expenses.filter((expense) => {
    const payers = getPayers(expense).map((payer) => payer.member);
    const splitMembers = expense.splitWith || [];
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [expense.desc || '', ...payers, ...splitMembers]
      .some((value) => String(value).toLowerCase().includes(query));
    const matchesMember = memberFilter === 'ALL' || payers.includes(memberFilter) || splitMembers.includes(memberFilter);
    const matchesType = typeFilter === 'ALL' || (typeFilter === 'SETTLEMENT' ? expense.isSettlement : !expense.isSettlement);
    const date = expense.datetime?.slice(0, 10) || '';
    return matchesSearch && matchesMember && matchesType &&
      (!startDate || (date && date >= startDate)) && (!endDate || (date && date <= endDate));
  });

  const changeCurrency = async (nextCurrency) => {
    if (!CURRENCIES.some(({ code }) => code === nextCurrency) || nextCurrency === room.currency) return;
    setSavingCurrency(true);
    try {
      await saveRoomData(roomId, { ...room, currency: nextCurrency });
      setRoom((previous) => previous ? { ...previous, currency: nextCurrency } : previous);
      setSaveError('');
    } catch (error) {
      console.error('Could not save currency:', error);
      setSaveError('Could not save the currency. Make sure the currency migration has been applied in Supabase.');
    } finally {
      setSavingCurrency(false);
    }
  };

  const importPreview = parseImportedTransactions(importText, room?.members || []);
  const handleImportTransactions = async () => {
    if (!room || importSaving || !importPreview.transactions.length || importPreview.issues.length) return;
    setImportSaving(true);
    setImportMessage('');
    const start = Date.now();
    // Keep every row from this import unique, including on very fast repeated submissions.
    const additions = importPreview.transactions.map((transaction, index) => ({
      ...transaction,
      id: `${start}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      datetime: getNowDatetime(),
    }));
    const updatedRoom = {
      ...room,
      members: [...room.members, ...importPreview.newMembers.filter((member) => !room.members.some((existing) => existing.toLowerCase() === member.toLowerCase()))],
      expenses: [...additions, ...(room.expenses || [])],
    };
    try {
      await saveRoomData(roomId, updatedRoom);
      setRoom(updatedRoom);
      setImportMessage(`Imported ${additions.length} transaction(s).`);
      setImportText('');
      setImportOpen(false);
    } catch (error) {
      console.error('Import failed:', error);
      setImportMessage('Could not save the import to Supabase. No rows were intentionally added locally.');
    } finally { setImportSaving(false); }
  };

  const handleExportCsv = () => {
    if (!filteredExpenses.length) return;
    const rows = [TABLE_HEADERS, ...filteredExpenses.map(tableRowForTransaction)];
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileSlug(room.name)}-transactions.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Dependency-free PDF export using the browser's Save as PDF print destination.
  // The popup is opened synchronously from the click to avoid popup blocking.
  const handleExportPdf = () => {
    if (!filteredExpenses.length) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      window.alert('Please allow pop-ups to open the PDF print view.');
      return;
    }
    const rows = filteredExpenses.map((expense) =>
      `<tr>${tableRowForTransaction(expense).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
    ).join('');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
      <title>${escapeHtml(room.name)} – Transactions</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 16px; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        .meta { font-size: 12px; color: #64748b; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
        th { text-align: left; background: #f1f5f9; color: #334155; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 6px; vertical-align: top; overflow-wrap: anywhere; }
        tr { break-inside: avoid; }
        th:nth-child(1) { width: 35%; } th:nth-child(2) { width: 15%; }
        th:nth-child(3) { width: 20%; } th:nth-child(4) { width: 30%; }
        @media screen { body { max-width: 1100px; margin: auto; } }
      </style></head><body>
      <h1>${escapeHtml(room.name)} — Transaction report</h1>
      <p class="meta">${filteredExpenses.length} transaction(s) · Generated ${escapeHtml(new Date().toLocaleString())} · Current table filters applied · Currency: ${escapeHtml(room.currency || 'PHP')} (no exchange conversion)</p>
      <table><thead><tr>${TABLE_HEADERS.map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
    }, { once: true });
    printWindow.document.close();
  };

  if (isLoading || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f3] p-6">
        <div className={`${cardClass} w-full max-w-md p-8 text-center`}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#f0fdfa] text-[#0f766e]">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold">{isLoading ? 'Opening your room…' : 'Room unavailable'}</h1>
          <p className="mt-2 text-sm text-[#64748b]">{isLoading ? 'Loading your shared expenses.' : loadError}</p>
          {!isLoading && <Link to="/" className={`${primaryButton} mt-5`}>Back to home</Link>}
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f7f6f3] font-sans text-[#0f172a]">
        <header className="border-b border-[#e6e3dc] bg-white px-6 py-4">
          <div className="flex justify-end"><ThemeSelector theme={theme} setTheme={setTheme} resolvedTheme={resolvedTheme} /></div>
          <Link to="/" className="mx-auto flex max-w-5xl items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-white"><Wallet className="h-5 w-5" /></span>
            Who2Pay<span className="text-[#0f766e]">.</span>
          </Link>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 items-center px-5 py-12">
          <section className={`${cardClass} w-full p-6 sm:p-8`}>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#f0fdfa] text-[#0f766e]"><Users className="h-6 w-6" /></div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0f766e]">Shared room</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight">{room.name}</h1>
            <p className="mt-2 text-sm leading-6 text-[#64748b]">Choose your name or add yourself to start splitting expenses.</p>
            {!!room.members?.length && (
              <div className="mt-7">
                <h2 className="mb-3 text-sm font-semibold text-[#334155]">Continue as a member</h2>
                <div className="flex flex-wrap gap-2">
                  {room.members.map((name) => (
                    <button key={name} type="button" onClick={() => selectUser(name, room.members)}
                      className="rounded-lg border border-[#e6e3dc] bg-white px-2 py-1.5 transition hover:border-[#0f766e] hover:bg-[#f0fdfa]">
                      <MemberTag name={name} colors={colors} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={handleJoin} className="mt-7 space-y-4 border-t border-[#e6e3dc] pt-6">
              <div>
                <label htmlFor="join-name" className="mb-2 block text-sm font-semibold text-[#334155]">{room.members?.length ? 'Or add a new name' : 'Your name'}</label>
                <input id="join-name" type="text" required maxLength={60} value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)} placeholder="Enter your name" className={fieldClass} />
              </div>
              {saveError && <p role="alert" className="text-sm text-[#b91c1c]">{saveError}</p>}
              <button type="submit" className={`${primaryButton} w-full`}>Join room <ArrowRight className="h-4 w-4" /></button>
              <p className="text-center text-xs text-[#64748b]">No account needed. Anyone with this link can edit the room.</p>
            </form>
          </section>
        </main>
        <footer className="px-5 py-5 text-center text-xs text-[#64748b]">Who2Pay · Achilles Fayloga</footer>
      </div>
    );
  }

  const { balances, totalPaid, totalShare, settlements } = calculateFinancials(room.members || [], expenses);
  const totalExpenses = expenses.filter((expense) => !expense.isSettlement)
    .reduce((total, expense) => total + (Number(expense.amount) || 0), 0);
  const mySettlements = settlements.filter((entry) => entry.from === currentUser);
  const pendingSettlementTotal = mySettlements.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const receivableSettlements = settlements.filter((entry) => entry.to === currentUser);
  const receivableTotal = receivableSettlements.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  // Expense share per person, excluding settlement transfers. Mirrors the
  // equal-split allocation in the room's financial calculation.
  const individualExpenses = (room.members || []).map((name) => ({
    name,
    share: expenses.reduce((sum, expense) => {
      if (expense.isSettlement) return sum;
      return sum + (Number(getExpenseShares(expense)[name]) || 0);
    }, 0),
  }));
  const relevantSettlements = settlements.filter((entry) =>
    entry.from === currentUser || entry.to === currentUser
  );

  const settleAction = (suggestion, label = 'Settle') => {
    const key = `${suggestion.from}:${suggestion.to}:${Number(suggestion.amount)}`;
    const isReceiving = suggestion.to === currentUser;
    return (
      <button type="button" disabled={settlingKey !== null}
        onClick={() => handleSettle(suggestion.from, suggestion.to, suggestion.amount)}
        className={`${primaryButton} !px-3 !py-2 !text-xs`}
        aria-label={isReceiving
          ? `Confirm receipt of ${formatAmount(suggestion.amount)} from ${suggestion.from}`
          : `Record ${suggestion.from} paying ${formatAmount(suggestion.amount)} to ${suggestion.to}`} >
        {settlingKey === key ? 'Saving…' : label}
      </button>
    );
  };

  const actionsFor = (expense) => (
    <div className="flex items-center gap-0.5 sm:gap-1">
      {!expense.isSettlement && (() => {
        const repayments = getExpenseRepayments(expense);
        const paidCount = repayments.filter((entry) => entry.paid).length;
        const complete = repayments.length > 0 && paidCount === repayments.length;
        return (
          <button type="button" onClick={() => openExpenseSettlement(expense)}
            disabled={settlingKey !== null || !repayments.length}
            title={!repayments.length ? 'No repayments needed' : 'Review member payments'}
            className={`rounded-md border px-1.5 py-1.5 text-[11px] font-semibold transition sm:px-2 sm:text-xs ${complete
              ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'
              : 'border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e] hover:bg-[#ccfbf1] disabled:opacity-50'}`}>
            {complete ? 'Settled' : paidCount ? `Settle (${paidCount}/${repayments.length})` : 'Settle'}
          </button>
        );
      })()}
      {!expense.isSettlement && (
        <button type="button" onClick={() => handleStartEdit(expense)} disabled={getExpenseRepayments(expense).some((item) => item.paid)}
          title={getExpenseRepayments(expense).some((item) => item.paid) ? "Remove linked repayments before editing" : "Edit transaction"}
          aria-label={`Edit ${expense.desc}`} className="rounded-lg p-1.5 text-[#64748b] transition hover:bg-[#f0fdfa] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={() => handleRemoveExpense(expense.id)} title="Delete transaction"
        aria-label={`Delete ${expense.desc}`} className="rounded-lg p-1.5 text-[#64748b] transition hover:bg-[#fff1f2] hover:text-[#be123c]">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f3] font-sans text-[#0f172a] selection:bg-[#ccfbf1]">
      <header className="sticky top-0 z-20 border-b border-[#e6e3dc] bg-white">
        <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" aria-label="Who2Pay home" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 bg-[#0f766e] text-white">
              <Wallet className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold sm:text-base">{room.name}</h1>
              <p className="text-xs text-[#64748b]">Viewing as <span className="font-semibold text-[#334155]">{currentUser}</span>
                <button type="button" onClick={handleSwitchUser} className="ml-2 font-semibold text-[#0f766e] hover:underline">Switch</button>
              </p>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
            <label htmlFor="room-currency" className="sr-only">Room currency</label>
            <select id="room-currency" value={room.currency || 'PHP'}
              onChange={(event) => changeCurrency(event.target.value)} disabled={savingCurrency}
              title="Currency for this room (changes the displayed unit, not historical amounts)"
              className="min-w-0 max-w-[146px] rounded-lg border border-[#cbd5e1] bg-white px-1.5 py-2 text-xs font-medium sm:max-w-none sm:px-2 sm:text-sm text-[#334155] focus:border-[#0f766e] focus:outline-none disabled:opacity-50">
              {CURRENCIES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
            </select>
            <ThemeSelector theme={theme} setTheme={setTheme} resolvedTheme={resolvedTheme} />
            <button type="button" onClick={copyRoomLink} className={secondaryButton}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>
            <Link to="/" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#334155]">Exit</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-8">
        {saveError && (
          <div role="alert" className="mb-5 rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">{saveError}</div>
        )}
        <div className="mb-3 sm:mb-6">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Overview</h2>
          <p className="mt-1 text-sm text-[#77756e]">{room.name} · {room.members.length} members · {room.currency || 'PHP'} (no currency conversion)</p>
        </div>
        <div className="mb-4 grid grid-cols-1 items-start gap-3 sm:mb-7 sm:grid-cols-2 sm:gap-4">
          <section className="rounded-lg border border-[#247367] border-l-[5px] bg-[#f2f8f5] px-3 py-3 sm:px-5 sm:py-5" aria-label="Group and individual expenses">
            <h3 className="text-sm font-medium text-[#315d53]">Total group expenses</h3>
            <p className="mt-1 text-2xl font-semibold sm:mt-2 sm:text-3xl tracking-tight text-[#173f37]">{formatAmount(totalExpenses)}</p>
            <p className="mt-2 text-xs text-[#627c74]">Expenses only · excludes repayments</p>
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
              <p className="mt-3 text-xs text-[#627c74]">Each member’s share of group expenses, not the amount they paid.</p>
            </div>
          </section>
          <section className="rounded-lg border border-[#b8793d] border-l-[5px] bg-[#fff7ed] px-3 py-3 sm:px-5 sm:py-5" aria-label="Your pending settlements">
            <h3 className="text-sm font-medium text-[#905a28]">Your pending settlements</h3>
            <p className="mt-2 text-sm text-[#75431e]">
              <span className="font-semibold">To pay: {formatAmount(pendingSettlementTotal)}</span>
              <span className="mx-2 text-[#b8793d]">·</span>
              <span className="font-semibold">To receive: {formatAmount(receivableTotal)}</span>
            </p>
            <p className="mt-2 text-xs text-[#9b744f]">Suggested transfers involving you</p>
            {relevantSettlements.length ? (
              <div className="mt-3 space-y-2 border-t border-[#ead4bb] pt-2 sm:mt-4 sm:pt-3">
                {relevantSettlements.map((suggestion, index) => {
                  const incoming = suggestion.to === currentUser;
                  return (
                    <div key={`${suggestion.from}:${suggestion.to}:${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#ead4bb] bg-white px-2.5 py-2 sm:px-3 sm:py-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#905a28]">{incoming ? 'To receive from' : 'To pay'}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <MemberTag name={incoming ? suggestion.from : suggestion.to} colors={colors} small />
                          <span className="text-sm font-semibold tabular-nums text-[#75431e]">{formatAmount(suggestion.amount)}</span>
                        </div>
                      </div>
                      {settleAction(suggestion, incoming ? 'Received' : 'Settle')}
                    </div>
                  );
                })}
              </div>
            ) : <p className="mt-4 border-t border-[#ead4bb] pt-3 text-sm text-[#905a28]">You’re all settled up.</p>}
          </section>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-6">
          <div className="min-w-0 space-y-4 sm:space-y-6">
            <section ref={formRef} className={`${cardClass} scroll-mt-24 ${editingExpenseId !== null ? 'ring-2 ring-[#99f6e4]' : ''}`}>
              <CardHeading
                title={editingExpenseId !== null ? 'Edit transaction' : 'Add an expense'}
                subtitle="Record who paid and who should share the cost."
                right={<div className="flex rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-1" aria-label="Payer mode">
                  {[
                    { id: 'single', label: 'One payer' },
                    { id: 'multiple', label: 'Multiple' },
                  ].map((option) => (
                    <button key={option.id} type="button" onClick={() => setPayerMode(option.id)}
                      aria-pressed={payerMode === option.id}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${payerMode === option.id ? 'bg-white text-[#0f766e] shadow-sm' : 'text-[#64748b] hover:text-[#334155]'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>}
              />
              <form onSubmit={handleSubmitExpense} className="space-y-3 p-3 sm:space-y-5 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className={payerMode === 'multiple' ? 'sm:col-span-2' : ''}>
                    <label htmlFor="description" className="mb-2 block text-sm font-semibold text-[#334155]">Description</label>
                    <input id="description" type="text" required maxLength={150} placeholder="e.g. Dinner, Groceries" value={desc}
                      onChange={(event) => setDesc(event.target.value)} className={fieldClass} />
                  </div>
                  {payerMode === 'single' && (
                    <div>
                      <label htmlFor="amount" className="mb-2 block text-sm font-semibold text-[#334155]">Amount ({room?.currency || 'PHP'})</label>
                      <input id="amount" type="text" inputMode="decimal" required placeholder="e.g. 1200 + 450 / 3" value={amount}
                        onChange={(event) => setAmount(event.target.value)} aria-describedby="amount-help" className={fieldClass} />
                      <p id="amount-help" className="mt-1 text-xs text-[#64748b]">Use +, −, × (*), ÷ (/) and parentheses. {amount.trim() && (evaluateAmount(amount) === null ? <span className="text-[#be123c]">Check expression</span> : <span className="font-semibold text-[#0f766e]">= {formatAmount(evaluateAmount(amount))}</span>)}</p>
                    </div>
                  )}
                </div>
                {payerMode === 'single' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="paid-by" className="mb-2 block text-sm font-semibold text-[#334155]">Paid by</label>
                      <select id="paid-by" value={paidBy} onChange={(event) => setPaidBy(event.target.value)} className={fieldClass}>
                        {room.members.map((name) => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="datetime" className="mb-2 block text-sm font-semibold text-[#334155]">Date and time</label>
                      <DateTimeFields idBase="expense" value={datetime} onChange={setDatetime} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#334155]">How much did each person pay?</p>
                      <span className="text-sm font-bold text-[#0f766e]">Total: {formatAmount(multiplePayersTotal)}</span>
                    </div>
                    <p className="text-xs text-[#64748b]">You can enter calculations such as 300/2 in each payer field.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {room.members.map((name) => (
                        <label key={name} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#e6e3dc] bg-white p-2.5">
                          <MemberTag name={name} colors={colors} small />
                          <input type="text" inputMode="decimal" placeholder="0 or 100+50" value={payerShares[name] || ''}
                            onChange={(event) => setPayerShares((previous) => ({ ...previous, [name]: event.target.value }))}
                            aria-label={`Amount or calculation paid by ${name}`}
                            className="w-24 shrink-0 rounded-md border border-[#cbd5e1] px-2 py-1.5 text-right text-sm outline-none focus:border-[#0f766e]" />
                        </label>
                      ))}
                    </div>
                    <div>
                      <label htmlFor="multi-datetime" className="mb-2 block text-sm font-semibold text-[#334155]">Date and time</label>
                      <DateTimeFields idBase="multi-expense" value={datetime} onChange={setDatetime} />
                    </div>
                  </div>
                )}
                <div className="space-y-3 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3 sm:p-4">
                  <label className="block text-sm font-semibold text-[#334155]" htmlFor="split-method">Split method</label>
                  <select id="split-method" value={splitMethod} onChange={(event) => setSplitMethod(event.target.value)} className={fieldClass}>
                    <option value="equal">Equal split</option>
                    <option value="custom">Custom amounts</option>
                    <option value="items">Itemized orders</option>
                  </select>
                  {splitMethod === 'custom' && <div className="space-y-2">
                    <p className="text-xs text-[#64748b]">Enter each member's total share. Leave members blank to use Split remaining equally.</p>
                    {splitWith.map((name) => <label key={name} className="flex items-center justify-between gap-2 text-sm">
                      <MemberTag name={name} colors={colors} small />
                      <input type="text" inputMode="decimal" placeholder="0.00 or 200+50" value={customShares[name] ?? ''}
                        onChange={(event) => setCustomShares(prev => ({ ...prev, [name]: event.target.value }))}
                        className="w-36 rounded-md border border-[#cbd5e1] px-2 py-2 text-right text-sm" />
                    </label>)}
                    <button type="button" className={secondaryButton} onClick={() => {
                      try {
                        const total = payerMode === 'single' ? evaluateAmount(amount) : multiplePayersTotal;
                        setCustomShares(fillRemainingEqually(total, splitWith, customShares, evaluateAmount));
                      } catch (error) { window.alert(error.message); }
                    }}>Split remaining equally</button>
                    <p className="text-xs text-[#64748b]">Assigned: {formatAmount(splitWith.reduce((sum, name) => sum + (evaluateAmount(customShares[name] || '0') || 0), 0))}</p>
                  </div>}
                  {splitMethod === 'items' && <div className="space-y-3">
                    <p className="text-xs text-[#64748b]">Add each order and select its consumers. An item can be shared by several members.</p>
                    {lineItems.map((item, index) => <div key={item.id} className="rounded-md border border-[#e6e3dc] bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between"><strong className="text-xs">Item {index + 1}</strong>
                        <button type="button" aria-label={`Remove item ${index + 1}`} onClick={() => setLineItems(prev => prev.filter(x => x.id !== item.id))} className="text-[#64748b]"><Trash2 className="h-4 w-4" /></button></div>
                      <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                        <input aria-label={`Item ${index + 1} description`} placeholder="e.g. Chicken meal" className={fieldClass} value={item.desc}
                          onChange={event => setLineItems(prev => prev.map(x => x.id === item.id ? {...x, desc: event.target.value} : x))} />
                        <input aria-label={`Item ${index + 1} amount`} placeholder="Price" inputMode="decimal" className={fieldClass} value={item.amount}
                          onChange={event => setLineItems(prev => prev.map(x => x.id === item.id ? {...x, amount: event.target.value} : x))} />
                      </div>
                      <div className="flex flex-wrap gap-1.5">{room.members.map(name => <button key={name} type="button"
                        aria-pressed={item.members.includes(name)} onClick={() => setLineItems(prev => prev.map(x => x.id === item.id ? {...x, members: x.members.includes(name) ? x.members.filter(n => n !== name) : [...x.members, name]} : x))}
                        className={`rounded-md border px-2 py-1 text-xs ${item.members.includes(name) ? 'border-[#0f766e] bg-[#f0fdfa] text-[#0f766e]' : 'border-[#e6e3dc] text-[#64748b]'}`}>{name}</button>)}</div>
                      <button type="button" className="text-xs text-[#0f766e] underline" onClick={() => setLineItems(prev => prev.map(x => x.id === item.id ? {...x, members: [...room.members]} : x))}>Everyone</button>
                    </div>)}
                    <button type="button" className={secondaryButton} onClick={() => setLineItems(prev => [...prev, {id: `item-${Date.now()}-${prev.length}`, desc:'', amount:'', members:[]}])}><Plus className="h-4 w-4" /> Add item</button>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-[#64748b]">Item total: {formatAmount(lineItems.reduce((sum, item) => sum + (evaluateAmount(String(item.amount)) || 0), 0))}. This must match the amount paid.</p>
                      {payerMode === 'single' && <button type="button" className={secondaryButton} onClick={() => {
                        try { const result = itemizedShares(lineItems, evaluateAmount); setAmount(String(result.total.toFixed(2))); }
                        catch (error) { window.alert(error.message); }
                      }}>Use item total as amount</button>}
                    </div>
                  </div>}
                </div>
                {splitMethod !== 'items' && <fieldset>
                  <legend className="mb-2 text-sm font-semibold text-[#334155]">Split between <span className="font-normal text-[#64748b]">({splitWith.length} selected)</span></legend>
                  <div className="flex flex-wrap gap-2">
                    {room.members.map((name) => {
                      const selected = splitWith.includes(name);
                      return (
                        <button key={name} type="button" aria-pressed={selected} onClick={() => toggleSplitMember(name)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition ${selected ? 'border-[#0f766e] bg-[#f0fdfa] font-semibold text-[#0f766e]' : 'border-[#e6e3dc] text-[#64748b] hover:border-[#94a3b8]'}`}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: memberColor(name, colors) }} />
                          {name} {selected && <Check className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>}
                <div className="flex flex-wrap gap-2 border-t border-[#e6e3dc] pt-5">
                  <button type="submit" className={`${primaryButton} flex-1 sm:flex-none`}>
                    {editingExpenseId !== null ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingExpenseId !== null ? 'Save changes' : 'Add expense'}
                  </button>
                  {editingExpenseId !== null && <button type="button" onClick={handleCancelEdit} className={secondaryButton}>Cancel</button>}
                </div>
              </form>
            </section>

            <section className={cardClass}>
              <CardHeading
                title={`Transactions (${filteredExpenses.length})`}
                subtitle="Search, filter, and export your transaction history. Exports use the current filters."
                right={<div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setImportOpen((open) => !open); setImportMessage(''); }} className={secondaryButton} aria-expanded={importOpen}>
                    <ClipboardPaste className="h-4 w-4" /> Import table
                  </button>
                  <button type="button" onClick={handleExportCsv} disabled={!filteredExpenses.length} className={secondaryButton} title="Download a CSV of filtered transactions">
                    <FileSpreadsheet className="h-4 w-4" /> CSV
                  </button>
                  <button type="button" onClick={handleExportPdf} disabled={!filteredExpenses.length} className={secondaryButton} title="Open a print view and select Save as PDF">
                    <FileText className="h-4 w-4" /> PDF
                  </button>
                </div>}
              />
              {importOpen && (
                <div className="space-y-3 border-b border-[#e6e3dc] bg-[#faf9f6] px-3 py-3 sm:px-6 sm:py-5">
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f172a]">Import transactions from a table</h3>
                    <p className="mt-1 text-xs text-[#64748b]">Paste four columns: Description | Amount | Paid By | Split Between. Supports spreadsheet cells, CSV, or Markdown tables. Each imported transaction uses the import date.</p>
                  </div>
                  <textarea rows={7} value={importText} onChange={(event) => setImportText(event.target.value)} className={`${fieldClass} font-mono text-xs`} placeholder={'Description\tAmount\tPaid By\tSplit Between\nTeam lunch\t1200.00\tAlex\tAlex, Jamie, Sam\nTaxi fare\t450.00\tSam\tAlex, Sam'} aria-label="Paste transaction table" />
                  {importText.trim() && (
                    <div className="space-y-2 text-xs">
                      <p className="font-semibold text-[#334155]">Preview: {importPreview.transactions.length} valid of {importPreview.rowCount} rows</p>
                      {importPreview.newMembers.length > 0 && <p className="text-[#92400e]">New room members to add: {importPreview.newMembers.join(', ')}</p>}
                      {importPreview.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-[#b91c1c]">{importPreview.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
                      {importPreview.transactions.length > 0 && (
                        <div className="max-h-52 overflow-auto rounded-md border border-[#dedbd4] bg-white">
                          <table className="min-w-[550px] w-full text-left text-xs"><thead><tr>{TABLE_HEADERS.map((heading) => <th key={heading} className="border-b border-[#dedbd4] p-2">{heading}</th>)}</tr></thead>
                            <tbody>{importPreview.transactions.slice(0, 10).map((entry, index) => <tr key={index} className="border-t border-[#eeeeea]">{tableRowForTransaction(entry).map((cell, col) => <td key={col} className="p-2">{cell}</td>)}</tr>)}</tbody>
                          </table>
                          {importPreview.transactions.length > 10 && <p className="p-2 text-[#64748b]">Showing the first 10 rows.</p>}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={handleImportTransactions} disabled={importSaving || !importPreview.transactions.length || Boolean(importPreview.issues.length)} className={primaryButton}>{importSaving ? 'Importing…' : `Import ${importPreview.transactions.length} transactions`}</button>
                    <button type="button" onClick={() => setImportOpen(false)} className={secondaryButton}>Cancel</button>
                  </div>
                </div>
              )}
              {importMessage && <p role="status" className="border-b border-[#e6e3dc] px-5 py-3 text-sm text-[#0f766e]">{importMessage}</p>}
              <div className="border-b border-[#e6e3dc] px-3 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                    <input type="search" aria-label="Search transactions" placeholder="Search transactions" value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)} className={`${fieldClass} pl-9`} />
                  </div>
                  <button type="button" aria-label="Toggle transaction filters" title="Filters"
                    aria-expanded={filtersOpen} aria-controls="transaction-filters"
                    onClick={() => setFiltersOpen((open) => !open)}
                    className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${filtersOpen || hasFilters ? 'border-[#0f766e] bg-[#f0fdfa] text-[#0f766e]' : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'}`}>
                    <SlidersHorizontal className="h-4 w-4" />
                    {hasFilters && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#0f766e]" />}
                  </button>
                </div>
                {filtersOpen && (
                  <div id="transaction-filters" className="mt-3 space-y-3 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3">
                    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                      <select aria-label="Filter by member" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} className={fieldClass}>
                        <option value="ALL">All members</option>
                        {room.members.map((name) => <option key={name} value={name}>{name}</option>)}
                      </select>
                      <select aria-label="Filter by transaction type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={fieldClass}>
                        <option value="ALL">All transactions</option>
                        <option value="EXPENSE">Expenses only</option>
                        <option value="SETTLEMENT">Settlements only</option>
                      </select>
                      <label className="min-w-0 text-xs text-[#64748b]">From
                        <input type="date" aria-label="Start date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={`${fieldClass} mt-1 block max-w-full `} />
                      </label>
                      <label className="min-w-0 text-xs text-[#64748b]">To
                        <input type="date" aria-label="End date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={`${fieldClass} mt-1 block max-w-full `} />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={clearFilters} disabled={!hasFilters} className="text-xs font-semibold text-[#0f766e] hover:underline disabled:opacity-40">Reset to expenses only</button>
                      <button type="button" onClick={() => setFiltersOpen(false)} className="text-xs font-medium text-[#475569] hover:underline">Done</button>
                    </div>
                  </div>
                )}
              </div>

              {!filteredExpenses.length ? (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#94a3b8]"><Download className="h-5 w-5" /></div>
                  <p className="text-sm font-semibold">No transactions found</p>
                  <p className="mt-1 text-sm text-[#64748b]">{hasFilters ? 'Try adjusting your filters.' : 'Add an expense to get started.'}</p>
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[700px] text-left text-xs">
                      <thead className="bg-[#faf9f6] text-[#64748b]">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Transaction</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Paid by</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Split between</th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className={`align-top transition ${expense.isSettlement ? 'bg-[#eef6f9] hover:bg-[#e4f0f5]' : 'bg-white hover:bg-[#faf9f6]'} ${editingExpenseId === expense.id ? 'ring-1 ring-inset ring-[#0f766e]' : ''}`}>
                            <td className="whitespace-nowrap px-4 py-4 text-[#64748b]">{formatDate(expense.datetime)}</td>
                            <td className="max-w-[180px] px-4 py-4">
                              <div className="break-words font-semibold text-[#0f172a]">{expense.desc}</div>
                            </td>
                            <td className="max-w-[150px] px-4 py-4">
                              <div className="flex flex-wrap gap-1">
                                {getPayers(expense).map((payer, index) => <MemberTag key={`${payer.member}-${index}`} name={payer.member} colors={colors} small />)}
                              </div>
                            </td>
                            <td className="max-w-[170px] px-4 py-4">
                              <div className="flex flex-wrap gap-1">
                                {(expense.splitWith || []).map((name) => <MemberTag key={name} name={name} colors={colors} small />)}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-right font-bold text-[#0f172a]">{formatAmount(expense.amount)}</td>
                            <td className="px-3 py-3"><div className="flex justify-end">{actionsFor(expense)}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="divide-y divide-[#e2e8f0] md:hidden">
                    {filteredExpenses.map((expense) => (
                      <article key={expense.id} className={`px-3 py-3 ${expense.isSettlement ? 'bg-[#eef6f9] border-l-[3px] border-[#3e8da6]' : 'bg-white border-l-[3px] border-transparent'} ${editingExpenseId === expense.id ? 'ring-1 ring-inset ring-[#0f766e]' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-semibold leading-5">{expense.desc}</p>
                            <p className="mt-0.5 text-[11px] text-[#64748b]">{formatDate(expense.datetime)}</p>
                          </div>
                          <span className="shrink-0 text-sm font-bold tabular-nums">{formatAmount(expense.amount)}</span>
                        </div>
                        <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-[#64748b]">
                            <span className="shrink-0">Paid by</span>
                            <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
                              {getPayers(expense).map((payer, index) => <MemberTag key={`${payer.member}-${index}`} name={payer.member} colors={colors} small />)}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {!expense.isSettlement && (
                              <button type="button" onClick={() => setViewingSplitExpenseId(expense.id)}
                                aria-label={`View split details for ${expense.desc}`} title="View split details"
                                className="rounded-md p-1.5 text-[#475569] transition hover:bg-[#e2e8f0] hover:text-[#0f766e]">
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                            {actionsFor(expense)}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>

          <aside className="min-w-0 space-y-4 sm:space-y-6">
            <section className={cardClass}>
              <CardHeading title="Balances" subtitle="Positive means they should receive money; negative means they owe. Any member can record a completed payment." />
              <div className="space-y-2 p-3 sm:space-y-3 sm:p-6">
                {room.members.map((name) => {
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
                        <div key={`${item.from}:${item.to}:${index}`} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d5e3de] bg-white px-3 py-2">
                          <span className="text-xs text-[#475569]">
                            <strong className="text-[#0f172a]">{item.from}</strong> pays <strong className="text-[#0f172a]">{item.to}</strong>
                            <strong className="ml-2 text-[#0f172a]">{formatAmount(item.amount)}</strong>
                          </span>
                          {settleAction(item, item.to === currentUser ? 'Received' : 'Settle')}
                        </div>
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
              <CardHeading title={`Members (${room.members.length})`} subtitle="Assign colors to recognize people across the room." />
              <div className="p-3 sm:p-6">
                {colorNotice && <p role="status" className="mb-3 rounded-md border border-[#e4dccb] bg-[#faf7ef] px-3 py-2 text-xs text-[#6b5e45]">{colorNotice}</p>}
                <form onSubmit={handleAddMember} className="mb-4 flex gap-2">
                  <input type="text" maxLength={60} aria-label="New member name" placeholder="Add a member" value={newMemberName}
                    onChange={(event) => setNewMemberName(event.target.value)} className={`${fieldClass} flex-1`} />
                  <button type="submit" className={primaryButton} aria-label="Add member"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add</span></button>
                </form>
                <div className="divide-y divide-[#e2e8f0]">
                  {room.members.map((name) => (
                    <div key={name} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <MemberTag name={name} colors={colors} />
                          {name === currentUser && <span className="text-xs text-[#64748b]">You</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => toggleColorEditor(name)}
                            aria-expanded={editingColorMember === name}
                            aria-label={`Change color for ${name}`} title={`Change color for ${name}`}
                            className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold text-[#0f766e] transition hover:bg-[#f0fdfa]">
                            <span className="h-3.5 w-3.5 rounded-full border border-white" style={{ backgroundColor: memberColor(name, colors) }} /> Color
                          </button>
                          {room.members.length > 1 && (
                            <button type="button" onClick={() => handleRemoveMember(name)} aria-label={`Remove ${name}`}
                              title={`Remove ${name}`} className="rounded-lg p-2 text-[#94a3b8] transition hover:bg-[#fff1f2] hover:text-[#be123c]">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      {editingColorMember === name && (
                        <div className="mt-3 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3">
                          <p className="mb-2 text-xs font-semibold text-[#475569]">Choose a color for {name}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {MEMBER_PALETTE.map(({ label, hex }) => (
                              <button key={hex} type="button" onClick={() => saveMemberColor(name, hex)}
                                title={label} aria-label={`${label} for ${name}`}
                                aria-pressed={memberColor(name, colors).toLowerCase() === hex.toLowerCase()}
                                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] ${memberColor(name, colors).toLowerCase() === hex.toLowerCase() ? 'border-[#0f172a]' : 'border-white'}`}
                                style={{ backgroundColor: hex }}>
                                {memberColor(name, colors).toLowerCase() === hex.toLowerCase() && <Check className="h-4 w-4 text-white" />}
                              </button>
                            ))}
                            <label title="Custom color" className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-[#cbd5e1] bg-white text-[#334155] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#0f766e]">
                              <span aria-hidden="true" className="text-lg font-medium">+</span>
                              <input type="color" value={customColor} aria-label={`Custom color for ${name}`}
                                onChange={(event) => setCustomColor(event.target.value)}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                            </label>
                            <button type="button" className={`${secondaryButton} !px-2.5 !py-1.5 !text-xs`} onClick={() => saveMemberColor(name, customColor)}>Apply custom</button>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button type="button" className="px-2 py-1.5 text-xs font-semibold text-[#64748b] hover:underline" onClick={() => resetMemberColor(name)}>Reset</button>
                            <button type="button" aria-label="Close color picker" onClick={() => setEditingColorMember(null)} className="ml-auto p-1 text-[#64748b] hover:text-[#0f172a]"><X className="h-4 w-4" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </aside>
        </div>
      </main>


      {viewingSplitExpenseId !== null && (() => {
        const expense = expenses.find((entry) => String(entry.id) === String(viewingSplitExpenseId));
        if (!expense || expense.isSettlement) return null;
        const participants = expense.splitWith || [];
        const shares = getExpenseShares(expense);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/50 p-0 sm:items-center sm:p-4"
            role="presentation" onMouseDown={(event) => {
              if (event.target === event.currentTarget) setViewingSplitExpenseId(null);
            }}>
            <div role="dialog" aria-modal="true" aria-labelledby="split-detail-title"
              className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-w-md sm:rounded-xl sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="split-detail-title" className="text-base font-bold">Split details</h2>
                  <p className="mt-1 break-words text-sm text-[#64748b]">{expense.desc}</p>
                </div>
                <button type="button" onClick={() => setViewingSplitExpenseId(null)}
                  aria-label="Close split details" className="rounded-md p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 flex justify-between border-b border-[#e2e8f0] pb-3 text-sm">
                <span className="text-[#64748b]">Total expense</span>
                <strong>{formatAmount(expense.amount)}</strong>
              </div>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#64748b]">Paid by</h3>
              <div className="mt-2 space-y-2">
                {getPayers(expense).map((payer, index) => (
                  <div key={`${payer.member}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <MemberTag name={payer.member} colors={colors} small />
                    <span className="font-medium">{formatAmount(payer.amount)}</span>
                  </div>
                ))}
              </div>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-[#64748b]">Split between</h3>
              <div className="mt-2 space-y-2">
                {participants.map((name) => (
                  <div key={name} className="flex items-center justify-between gap-3 text-sm">
                    <MemberTag name={name} colors={colors} small />
                    <span className="font-medium">{formatAmount(shares[name] || 0)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[#64748b]">Shares are allocated to cents. This view does not record payments.</p>
              <button type="button" onClick={() => setViewingSplitExpenseId(null)} className={`${secondaryButton} mt-4 w-full justify-center`}>Close</button>
            </div>
          </div>
        );
      })()}

      {settlementExpenseId !== null && (() => {
        const expense = expenses.find((entry) => String(entry.id) === String(settlementExpenseId));
        if (!expense) return null;
        const repayments = getExpenseRepayments(expense);
        const remaining = repayments.filter((entry) => !entry.paid);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/50 p-0 sm:items-center sm:p-4"
            role="presentation" onMouseDown={(event) => {
              if (event.target === event.currentTarget && settlingKey === null) setSettlementExpenseId(null);
            }}>
            <div role="dialog" aria-modal="true" aria-labelledby="expense-payment-title"
              className="w-full max-w-lg rounded-t-xl bg-white p-4 shadow-xl sm:rounded-xl sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="expense-payment-title" className="text-base font-bold text-[#0f172a]">Record transaction payments</h2>
                  <p className="mt-1 break-words text-sm text-[#64748b]">{expense.desc}</p>
                </div>
                <button type="button" onClick={() => setSettlementExpenseId(null)} disabled={settlingKey !== null}
                  aria-label="Close payment checklist" className="rounded-md p-1.5 text-[#64748b] hover:bg-[#f1f5f9]"><X className="h-5 w-5" /></button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#64748b]">Select the members whose repayments have actually been received. Only checked payments will be logged. The boxes are unchecked by default.</p>
              <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto">
                {repayments.map((entry) => (
                  <label key={entry.index}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${entry.paid ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-white'}`}>
                    <input type="checkbox" checked={entry.paid || selectedRepayments.includes(entry.index)}
                      disabled={entry.paid || settlingKey !== null}
                      onChange={(event) => setSelectedRepayments((previous) => event.target.checked
                        ? [...previous, entry.index] : previous.filter((index) => index !== entry.index))}
                      className="h-4 w-4 shrink-0 accent-[#0f766e]" />
                    <span className="min-w-0 flex-1 text-sm text-[#334155]">
                      <strong>{entry.from}</strong> pays <strong>{entry.to}</strong>
                      {entry.paid && <span className="ml-2 text-xs font-semibold text-[#15803d]">Recorded</span>}
                    </span>
                    <strong className="shrink-0 text-sm text-[#0f172a]">{formatAmount(entry.amount)}</strong>
                  </label>
                ))}
              </div>
              {!remaining.length && <p className="mt-3 text-sm font-medium text-[#15803d]">All repayments for this expense have been recorded.</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={settlingKey !== null} onClick={() => setSettlementExpenseId(null)} className={secondaryButton}>Close</button>
                {remaining.length > 0 && (
                  <button type="button" onClick={handleSettleExpense}
                    disabled={settlingKey !== null || !selectedRepayments.some((index) => remaining.some((entry) => entry.index === index))}
                    className={primaryButton}>
                    {settlingKey !== null ? 'Saving…' : `Record ${selectedRepayments.filter((index) => remaining.some((entry) => entry.index === index)).length} payment(s)`}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <footer className="mt-10 border-t border-[#e6e3dc] bg-white px-5 py-5 text-center text-xs text-[#64748b]">
        Who2Pay · Expense tracker and splitter · Achilles Fayloga
      </footer>
    </div>
  );
}
