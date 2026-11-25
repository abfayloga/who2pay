import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Undo2, Users, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import BalancesSidebar, { GroupSummary } from '../components/BalancesSidebar';
import ActivityLogModal from '../components/ActivityLogModal';
import ExpenseForm from '../components/ExpenseForm';
import RoomHeader from '../components/RoomHeader';
import SettlementModal from '../components/SettlementModal';
import TransactionList from '../components/TransactionList';
import { ThemeSelector } from '../components/roomUi';
import { MemberTag } from '../components/roomUi';
import { useTheme } from '../hooks/useTheme';
import { CURRENCIES, formatCurrency } from '../utils/currency';
import { todayIsoDate } from '../utils/formatDate';
import { calculateFinancials } from '../utils/settlement';
import { getRoomData, normalizeRoomData, saveRoomData } from '../utils/storage';
import { supabase } from '../utils/supabase';
import { cardClass, fieldClass, primaryButton } from '../utils/uiClasses';

function readColorCache(roomId) {
  try {
    const value = JSON.parse(window.localStorage.getItem(`who2pay:member-colors:${roomId}`) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export default function Room() {
  const { theme, setTheme } = useTheme();
  const { roomId } = useParams();
  const formRef = useRef(null);
  const roomRef = useRef(null);
  const undoTimerRef = useRef(null);

  const [room, setRoom] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [settlingKey, setSettlingKey] = useState(null);
  const [localMemberColors, setLocalMemberColors] = useState({});
  const [colorNotice, setColorNotice] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [transferDraft, setTransferDraft] = useState(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [undoToast, setUndoToast] = useState(null);

  const colorCacheKey = `who2pay:member-colors:${roomId}`;

  useEffect(() => () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
  }, []);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  const withActivity = (nextRoom, action, description) => ({
    ...nextRoom,
    activity: [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      actor: currentUser,
      action,
      description,
      datetime: new Date().toISOString(),
    }, ...(nextRoom.activity || [])].slice(0, 100),
  });

  const clearUndoToast = () => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoToast(null);
  };

  const handleSavePaymentDetails = async (name, paymentDetails) => {
    const currentRoom = roomRef.current;
    if (!currentRoom?.members?.includes(name)) return false;
    const memberPaymentDetails = { ...(currentRoom.memberPaymentDetails || {}) };
    if (paymentDetails.trim()) memberPaymentDetails[name] = paymentDetails.trim();
    else delete memberPaymentDetails[name];
    return save({ ...currentRoom, memberPaymentDetails });
  };

  const showUndoToast = (message, undo) => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndoToast({ message, undo, isUndoing: false });
    undoTimerRef.current = window.setTimeout(() => {
      undoTimerRef.current = null;
      setUndoToast(null);
    }, 8000);
  };

  const handleUndo = async () => {
    if (!undoToast || undoToast.isUndoing) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoToast((current) => current && { ...current, isUndoing: true });
    const restored = await undoToast.undo();
    if (restored) setUndoToast(null);
    else setUndoToast((current) => current && { ...current, isUndoing: false });
  };

  const cacheColors = (next) => {
    setLocalMemberColors(next);
    try {
      window.localStorage.setItem(colorCacheKey, JSON.stringify(next));
    } catch {
      setColorNotice('Browser storage is unavailable. Color changes may not survive a refresh.');
    }
  };

  useEffect(() => {
    let active = true;
    const resetTimer = window.setTimeout(() => {
      if (!active) return;
      setIsLoading(true);
      setLoadError('');
      setRoom(null);
      setLocalMemberColors(readColorCache(roomId));
    }, 0);

    const loadRoom = async () => {
      try {
        const data = await getRoomData(roomId);
        if (!active) return;
        if (!data) {
          setLoadError('This room could not be found. Check the link and try again.');
          return;
        }
        setRoom(data);
        if (data.memberColors && Object.keys(data.memberColors).length) {
          const merged = { ...readColorCache(roomId), ...data.memberColors };
          setLocalMemberColors(merged);
          try { window.localStorage.setItem(`who2pay:member-colors:${roomId}`, JSON.stringify(merged)); }
          catch { setColorNotice('Browser storage is unavailable. Color changes may not survive a refresh.'); }
        }
        const savedUser = sessionStorage.getItem(`session_${roomId}`);
        const matchingUser = (data.members || []).find((name) => name === savedUser);
        if (matchingUser) setCurrentUser(matchingUser);
        else setCurrentUser('');
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
        if (!active || !payload.new) return;
        const updatedRoom = normalizeRoomData(payload.new);
        setRoom(updatedRoom);
        if (updatedRoom.memberColors && Object.keys(updatedRoom.memberColors).length) {
          const merged = { ...readColorCache(roomId), ...updatedRoom.memberColors };
          setLocalMemberColors(merged);
          try { window.localStorage.setItem(`who2pay:member-colors:${roomId}`, JSON.stringify(merged)); }
          catch { setColorNotice('Browser storage is unavailable. Color changes may not survive a refresh.'); }
        }
      })
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(resetTimer);
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const save = async (nextRoom) => {
    const previous = roomRef.current;
    roomRef.current = nextRoom;
    setRoom(nextRoom);
    setSaveError('');
    try {
      await saveRoomData(roomId, nextRoom);
      return true;
    } catch (error) {
      console.error('Room update failed:', error);
      setSaveError('Your changes could not be saved. Please try again.');
      roomRef.current = previous;
      setRoom(previous);
      return false;
    }
  };

  const selectUser = (name) => {
    setCurrentUser(name);
    sessionStorage.setItem(`session_${roomId}`, name);
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    const requestedName = nameInput.trim();
    if (!requestedName || !room) return;
    const existingName = (room.members || []).find((name) => name.toLowerCase() === requestedName.toLowerCase());
    const name = existingName || requestedName;
    const members = existingName ? room.members : [...(room.members || []), name];
    if (!existingName && !(await save({ ...room, members }))) return;
    selectUser(name);
  };

  const handleSwitchUser = () => {
    sessionStorage.removeItem(`session_${roomId}`);
    setCurrentUser('');
    setEditingExpenseId(null);
  };

  const handleAddMember = async (rawName) => {
    const name = rawName.trim();
    if (!name || !room) return false;
    if ((room.members || []).some((member) => member.toLowerCase() === name.toLowerCase())) {
      window.alert('A member with this name already exists.');
      return false;
    }
    return save({ ...room, members: [...room.members, name] });
  };

  const handleRemoveMember = async (name) => {
    if (!window.confirm(`Remove "${name}" from this group? Existing transactions will be kept.`)) return;
    const members = room.members.filter((member) => member !== name);
    const colors = { ...(room.memberColors || {}) };
    const memberPaymentDetails = { ...(room.memberPaymentDetails || {}) };
    delete colors[name];
    delete memberPaymentDetails[name];
    const cached = { ...localMemberColors };
    delete cached[name];
    cacheColors(cached);
    if (!(await save({ ...room, members, memberColors: colors, memberPaymentDetails }))) return;
    if (currentUser === name) handleSwitchUser();
  };

  const saveMemberColor = async (name, hex) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    const nextColors = { ...localMemberColors, ...room.memberColors, [name]: hex };
    cacheColors(nextColors);
    setColorNotice('Color applied. For cross-device sharing, your storage utility must persist memberColors.');
    try {
      await saveRoomData(roomId, { ...room, memberColors: nextColors });
      setRoom((previous) => ({ ...previous, memberColors: nextColors }));
    } catch (error) {
      console.warn('Member colors saved to this browser only:', error);
      setColorNotice('Color saved in this browser only; the room database did not accept the update.');
    }
  };

  const resetMemberColor = async (name) => {
    const nextColors = { ...localMemberColors, ...room.memberColors };
    delete nextColors[name];
    cacheColors(nextColors);
    setRoom((previous) => ({ ...previous, memberColors: nextColors }));
    try {
      await saveRoomData(roomId, { ...room, memberColors: nextColors });
    } catch (error) {
      console.warn('Member color reset saved to this browser only:', error);
      setColorNotice('Default color restored in this browser only.');
    }
  };

  const handleStartEdit = (expense) => {
    const blocked = (room?.expenses || []).some((entry) => entry.isSettlement && String(entry.sourceExpenseId) === String(expense.id));
    if (blocked) {
      window.alert('Remove the linked settlement records before editing this expense.');
      return;
    }
    setEditingExpenseId(expense.id);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSaveExpense = async (payload) => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return false;
    if (editingExpenseId !== null) {
      const expenses = (currentRoom.expenses || []).map((expense) => (
        expense.id === editingExpenseId ? { ...expense, ...payload } : expense
      ));
      const nextRoom = withActivity({ ...currentRoom, expenses }, 'edited', `Edited "${payload.desc}"`);
      const saved = await save(nextRoom);
      if (saved) setEditingExpenseId(null);
      return saved;
    }
    const nextRoom = withActivity({
      ...currentRoom,
      expenses: [{ id: Date.now(), ...payload }, ...(currentRoom.expenses || [])],
    }, 'added', `Added "${payload.desc}"`);
    return save(nextRoom);
  };

  const handleRemoveExpense = async (id) => {
    const currentRoom = roomRef.current;
    if (!currentRoom) return;
    if ((currentRoom.expenses || []).some((entry) => entry.isSettlement && String(entry.sourceExpenseId) === String(id))) {
      window.alert('Remove the linked settlement records before deleting this expense.');
      return;
    }
    if (!window.confirm('Delete this transaction? You can undo this for a short time.')) return;
    const removed = (currentRoom.expenses || []).filter((expense) => expense.id === id);
    const expenses = (currentRoom.expenses || []).filter((expense) => expense.id !== id);
    const nextRoom = withActivity({
      ...currentRoom,
      expenses,
    }, 'deleted', `Deleted "${removed[0]?.desc || 'transaction'}"`);
    if (!(await save(nextRoom))) return;
    if (editingExpenseId === id) setEditingExpenseId(null);
    showUndoToast('Transaction deleted.', async () => {
      const latestRoom = roomRef.current;
      if (!latestRoom || !removed.length) return false;
      const existingIds = new Set((latestRoom.expenses || []).map((expense) => String(expense.id)));
      const restored = removed.filter((expense) => !existingIds.has(String(expense.id)));
      const undoRoom = withActivity({
        ...latestRoom,
        expenses: [...restored, ...(latestRoom.expenses || [])],
      }, 'undo', `Restored "${removed[0].desc || 'transaction'}"`);
      return save(undoRoom);
    });
  };

  const handleRecordPayments = async (expense, selected) => {
    const currentRoom = roomRef.current;
    if (!currentRoom || !selected.length || settlingKey !== null) return false;
    const lines = selected.map(({ from, to, amount }) => `${from} → ${to}: ${formatCurrency(amount, currentRoom.currency)}`).join('\n');
    if (!window.confirm(`Mark ${selected.length} payment(s) as settled for this specific transaction, "${expense.desc}"?\n\n${lines}\n\nThis does not settle other transactions.`)) return false;
    setSettlingKey(`expense:${expense.id}`);
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = todayIsoDate();
    const settlementEntries = selected.map(({ from, to, amount, index }) => ({
      id: `${batchId}-${index}`,
      desc: `Settlement for ${expense.desc}: ${from} → ${to}`,
      amount,
      paidBy: from,
      payers: [{ member: from, amount }],
      splitWith: [to],
      splitShares: { [to]: amount },
      datetime: timestamp,
      isSettlement: true,
      sourceExpenseId: expense.id,
      sourceTransferIndex: index,
      settlementBatchId: batchId,
    }));
    try {
      const nextRoom = withActivity({
        ...currentRoom,
        expenses: [...settlementEntries, ...(currentRoom.expenses || [])],
      }, 'settled', `Settled "${expense.desc}"`);
      const saved = await save(nextRoom);
      if (saved) {
        const settlementIds = new Set(settlementEntries.map((entry) => String(entry.id)));
        showUndoToast(`Settled "${expense.desc}".`, async () => {
          const latestRoom = roomRef.current;
          if (!latestRoom) return false;
          const undoRoom = withActivity({
            ...latestRoom,
            expenses: (latestRoom.expenses || []).filter((entry) => !settlementIds.has(String(entry.id))),
          }, 'undo', `Undid settlement for "${expense.desc}"`);
          return save(undoRoom);
        });
      }
      return saved;
    } finally {
      setSettlingKey(null);
    }
  };

  const handleUndoPayments = async (expense) => {
    const currentRoom = roomRef.current;
    if (!currentRoom || settlingKey !== null) return;
    if (!window.confirm(`Undo settlement for "${expense.desc}"?`)) return;
    const linkedIds = new Set((currentRoom.expenses || [])
      .filter((entry) => entry.isSettlement && String(entry.sourceExpenseId) === String(expense.id))
      .map((entry) => String(entry.id)));
    if (!linkedIds.size) return;
    setSettlingKey(`undo:${expense.id}`);
    try {
      const nextRoom = withActivity({
        ...currentRoom,
        expenses: (currentRoom.expenses || []).filter((entry) => !linkedIds.has(String(entry.id))),
      }, 'unsettled', `Undid settlement for "${expense.desc}"`);
      await save(nextRoom);
    } finally {
      setSettlingKey(null);
    }
  };

  const openTransfer = (preset = {}) => {
    if (settlingKey !== null || !room) return;
    const members = room.members || [];
    const from = members.includes(preset.from) ? preset.from : (members.includes(currentUser) ? currentUser : (members[0] || ''));
    let to = members.includes(preset.to) ? preset.to : '';
    if (to === from) to = '';
    const numeric = Number(preset.amount);
    setTransferDraft({
      from,
      to,
      amount: Number.isFinite(numeric) && numeric > 0 ? numeric.toFixed(2) : '',
      note: '',
      date: todayIsoDate(),
    });
  };

  const handleRecordTransfer = async ({ from, to, amount, note, date }) => {
    const currentRoom = roomRef.current;
    if (settlingKey !== null || !currentRoom?.members?.includes(currentUser)) return;
    const rounded = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(rounded) || rounded <= 0 || from === to || !room.members.includes(from) || !room.members.includes(to)) {
      window.alert('Choose two different members and an amount greater than 0.');
      return;
    }
    const formatted = formatCurrency(rounded, currentRoom.currency);
    const confirmation = from === currentUser || to === currentUser
      ? `Record ${from} paying ${formatted} to ${to}? This updates shared balances only.`
      : `Record ${from} paying ${formatted} to ${to}? This updates shared balances for other members only.`;
    if (!window.confirm(confirmation)) return;
    setSettlingKey('transfer');
    const entry = {
      id: Date.now(),
      desc: note || `Settlement: ${from} → ${to}`,
      amount: rounded,
      paidBy: from,
      payers: [{ member: from, amount: rounded }],
      splitWith: [to],
      splitShares: { [to]: rounded },
      datetime: date || todayIsoDate(),
      isSettlement: true,
    };
    try {
      const nextRoom = withActivity({
        ...currentRoom,
        expenses: [entry, ...(currentRoom.expenses || [])],
      }, 'settled', `Recorded transfer: ${from} → ${to}`);
      if (await save(nextRoom)) {
        setTransferDraft(null);
        showUndoToast('Transfer recorded.', async () => {
          const latestRoom = roomRef.current;
          if (!latestRoom) return false;
          const undoRoom = withActivity({
            ...latestRoom,
            expenses: (latestRoom.expenses || []).filter((expense) => String(expense.id) !== String(entry.id)),
          }, 'undo', `Undid transfer: ${from} → ${to}`);
          return save(undoRoom);
        });
      }
    } finally {
      setSettlingKey(null);
    }
  };

  const copyRoomLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert('Could not copy the link. Please copy it from your browser address bar.');
    }
  };

  const changeCurrency = async (nextCurrency) => {
    if (!room || !CURRENCIES.some(({ code }) => code === nextCurrency) || nextCurrency === room.currency) return;
    setSavingCurrency(true);
    try {
      await saveRoomData(roomId, { ...room, currency: nextCurrency });
      setRoom((previous) => (previous ? { ...previous, currency: nextCurrency } : previous));
      setSaveError('');
    } catch (error) {
      console.error('Could not save currency:', error);
      setSaveError('Could not save the currency. Make sure the currency migration has been applied in Supabase.');
    } finally {
      setSavingCurrency(false);
    }
  };

  const importTransactions = async (transactions, newMembers) => {
    if (!room || !transactions.length) return false;
    const start = Date.now();
    const additions = transactions.map((transaction, index) => ({
      ...transaction,
      id: `${start}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      datetime: todayIsoDate(),
    }));
    const updatedRoom = withActivity({
      ...room,
      members: [
        ...room.members,
        ...newMembers.filter((member) => !room.members.some((existing) => existing.toLowerCase() === member.toLowerCase())),
      ],
      expenses: [...additions, ...(room.expenses || [])],
    }, 'added', `Imported ${additions.length} transactions`);
    try {
      await saveRoomData(roomId, updatedRoom);
      setRoom(updatedRoom);
      setSaveError('');
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  };

  const roomExpenses = room?.expenses;
  const roomMembers = room?.members;
  const expenses = useMemo(() => roomExpenses || [], [roomExpenses]);
  const members = useMemo(() => roomMembers || [], [roomMembers]);
  const colors = { ...(room?.memberColors || {}), ...localMemberColors };
  const formatAmount = (value) => formatCurrency(value, room?.currency || 'PHP');
  const financials = useMemo(() => calculateFinancials(members, expenses), [members, expenses]);
  const editingExpense = editingExpenseId == null
    ? null
    : expenses.find((expense) => expense.id === editingExpenseId) || null;

  if (isLoading || !room) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f3] p-6">
        <div className={`${cardClass} w-full max-w-md p-8 text-center`}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[#f0fdfa] text-[#0f766e]">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold">{isLoading ? 'Opening your room…' : 'Room unavailable'}</h1>
          {!isLoading && <p className="mt-2 text-sm text-[#64748b]">{loadError}</p>}
          {!isLoading && <Link to="/" className={`${primaryButton} mt-5`}>Back to home</Link>}
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f7f6f3] font-sans text-[#0f172a]">
        <header className="border-b border-[#e6e3dc] bg-white px-6 py-4">
          <div className="flex justify-end"><ThemeSelector theme={theme} setTheme={setTheme} /></div>
          <Link to="/" className="mx-auto flex max-w-5xl items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-white"><Wallet className="h-5 w-5" /></span>
            Who2Pay<span className="text-[#0f766e]">.</span>
          </Link>
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 items-center px-5 py-12">
          <section className={`${cardClass} w-full p-6 sm:p-8`}>
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#f0fdfa] text-[#0f766e]"><Users className="h-6 w-6" /></div>
            <h1 className="break-words text-2xl font-bold tracking-tight">{room.name}</h1>
            {!!members.length && (
              <div className="mt-7">
                <h2 className="mb-3 text-sm font-semibold text-[#334155]">Continue as a member</h2>
                <div className="flex flex-wrap gap-2">
                  {members.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectUser(name)}
                      className="rounded-lg border border-[#e6e3dc] bg-white px-2 py-1.5 transition hover:border-[#0f766e] hover:bg-[#f0fdfa]"
                    >
                      <MemberTag name={name} colors={colors} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <form onSubmit={handleJoin} className="mt-7 space-y-4 border-t border-[#e6e3dc] pt-6">
              <div>
                <label htmlFor="join-name" className="mb-2 block text-sm font-semibold text-[#334155]">{members.length ? 'Or add a new name' : 'Your name'}</label>
                <input
                  id="join-name"
                  type="text"
                  required
                  maxLength={60}
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  placeholder="Enter your name"
                  className={fieldClass}
                />
              </div>
              {saveError && <p role="alert" className="text-sm text-[#b91c1c]">{saveError}</p>}
              <button type="submit" className={`${primaryButton} w-full`}>Join room <ArrowRight className="h-4 w-4" /></button>
            </form>
          </section>
        </main>
        <footer className="px-5 py-5 text-center text-xs text-[#64748b]">Who2Pay · Achilles Fayloga</footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f3] font-sans text-[#0f172a] selection:bg-[#ccfbf1]">
      <RoomHeader
        roomName={room.name}
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        currency={room.currency || 'PHP'}
        savingCurrency={savingCurrency}
        onCurrencyChange={changeCurrency}
        copied={copied}
        onCopyLink={copyRoomLink}
        theme={theme}
        setTheme={setTheme}
        onOpenActivity={() => setActivityOpen(true)}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-3 sm:px-6 sm:py-5">
        {saveError && (
          <div role="alert" className="mb-5 rounded-lg border border-[#fecaca] bg-[#fff1f2] px-4 py-3 text-sm text-[#b91c1c]">{saveError}</div>
        )}
        <GroupSummary
          roomName={room.name}
          currency={room.currency || 'PHP'}
          members={members}
          expenses={expenses}
          colors={colors}
          currentUser={currentUser}
          settlements={financials.settlements}
          formatAmount={formatAmount}
          onOpenTransfer={openTransfer}
          transferLocked={settlingKey !== null}
        />
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:gap-4">
          <div className="min-w-0 space-y-3 sm:space-y-4">
            <ExpenseForm
              key={editingExpenseId ?? 'new'}
              ref={formRef}
              expense={editingExpense}
              members={members}
              colors={colors}
              currentUser={currentUser}
              currency={room.currency || 'PHP'}
              formatAmount={formatAmount}
              onCancel={() => setEditingExpenseId(null)}
              onSave={handleSaveExpense}
            />
            <TransactionList
              roomName={room.name}
              currency={room.currency || 'PHP'}
              members={members}
              expenses={expenses}
              colors={colors}
              editingExpenseId={editingExpenseId}
              formatAmount={formatAmount}
              settlingKey={settlingKey}
              onEdit={handleStartEdit}
              onDelete={handleRemoveExpense}
              onImport={importTransactions}
              onRecordPayments={handleRecordPayments}
              onUndoPayments={handleUndoPayments}
            />
          </div>
          <BalancesSidebar
            members={members}
            colors={colors}
            balances={financials.balances}
            totalPaid={financials.totalPaid}
            totalShare={financials.totalShare}
            totalSettled={financials.totalSettled}
            settlements={financials.settlements}
            currentUser={currentUser}
            formatAmount={formatAmount}
            onOpenTransfer={openTransfer}
            transferLocked={settlingKey !== null}
            onAddMember={handleAddMember}
            onRemoveMember={handleRemoveMember}
            onSaveColor={saveMemberColor}
            onResetColor={resetMemberColor}
            memberPaymentDetails={room.memberPaymentDetails || {}}
            onSavePaymentDetails={handleSavePaymentDetails}
            colorNotice={colorNotice}
          />
        </div>
      </main>
      <SettlementModal
        draft={transferDraft}
        members={members}
        formatAmount={formatAmount}
        memberPaymentDetails={room.memberPaymentDetails || {}}
        saving={settlingKey === 'transfer'}
        onChange={setTransferDraft}
        onClose={() => { if (settlingKey !== 'transfer') setTransferDraft(null); }}
        onSubmit={handleRecordTransfer}
      />
      {activityOpen && (
        <ActivityLogModal activity={room.activity || []} onClose={() => setActivityOpen(false)} />
      )}
      {undoToast && (
        <div className="fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center justify-between gap-3 rounded-lg bg-[#0f172a] px-4 py-3 text-sm text-white shadow-xl" role="status">
          <span className="min-w-0 flex-1 truncate">{undoToast.message}</span>
          <button type="button" onClick={handleUndo} disabled={undoToast.isUndoing} className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#99f6e4] hover:underline disabled:opacity-50">
            <Undo2 className="h-4 w-4" /> {undoToast.isUndoing ? 'Undoing…' : 'Undo'}
          </button>
          <button type="button" onClick={clearUndoToast} aria-label="Dismiss undo message" className="shrink-0 rounded px-1 text-white/70 hover:bg-white/10 hover:text-white">×</button>
        </div>
      )}
      <footer className="mt-10 border-t border-[#e6e3dc] bg-white px-5 py-5 text-center text-xs text-[#64748b]">
        Who2Pay · Achilles Fayloga
      </footer>
    </div>
  );
}
