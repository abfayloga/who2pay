import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRoomData, saveRoomData } from '../utils/storage';
import { calculateFinancials } from '../utils/settlement';
import { supabase } from '../utils/supabase';
import {
  Copy,
  Check,
  ArrowRight,
  Trash2,
  Pencil,
  Calendar,
  Users,
  User,
  X,
} from 'lucide-react';

const getMemberTagColor = (name) => {
  const tagStyles = [
    'bg-[#412D15]/20 text-[#1F150C] border-[#412D15]/40',
    'bg-[#73532c]/20 text-[#1F150C] border-[#73532c]/40',
    'bg-[#8c6d3f]/20 text-[#1F150C] border-[#8c6d3f]/40',
    'bg-[#5c401f]/20 text-[#1F150C] border-[#5c401f]/40',
    'bg-[#3b2b19]/20 text-[#1F150C] border-[#3b2b19]/40',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return tagStyles[Math.abs(hash) % tagStyles.length];
};

export default function Room() {
  const { roomId } = useParams();
  const formRef = useRef(null);

  const getNowDatetime = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
  };

  const [room, setRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [copied, setCopied] = useState(false);

  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [payerMode, setPayerMode] = useState('single');
  const [paidBy, setPaidBy] = useState('');
  const [payerShares, setPayerShares] = useState({});
  const [splitWith, setSplitWith] = useState([]);
  const [datetime, setDatetime] = useState(getNowDatetime());

  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const loadRoom = async () => {
      const data = await getRoomData(roomId);
      if (data) {
        setRoom(data);
        const savedUser = sessionStorage.getItem(`session_${roomId}`);
        if (savedUser) {
          setCurrentUser(savedUser);
          setPaidBy(savedUser);
          setSplitWith(data.members || []);
        }
      }
    };

    loadRoom();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new) {
            setRoom(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!nameInput.trim() || !room) return;

    const name = nameInput.trim();
    let updatedMembers = [...room.members];
    if (!updatedMembers.includes(name)) {
      updatedMembers.push(name);
    }

    const updatedRoom = { ...room, members: updatedMembers };
    setRoom(updatedRoom);
    await saveRoomData(roomId, updatedRoom);

    setCurrentUser(name);
    setPaidBy(name);
    setSplitWith(updatedMembers);
    sessionStorage.setItem(`session_${roomId}`, name);
  };

  const handleSwitchUser = () => {
    sessionStorage.removeItem(`session_${roomId}`);
    setCurrentUser('');
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed || !room) return;

    if (room.members.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      alert('A member with this name already exists.');
      return;
    }

    const updatedMembers = [...room.members, trimmed];
    const updatedRoom = { ...room, members: updatedMembers };

    setRoom(updatedRoom);
    await saveRoomData(roomId, updatedRoom);
    setSplitWith((prev) => [...prev, trimmed]);
    setNewMemberName('');
  };

  const handleRemoveMember = async (memberToRemove) => {
    if (!window.confirm(`Remove "${memberToRemove}" from this group?`)) return;

    const updatedMembers = room.members.filter((m) => m !== memberToRemove);
    const updatedRoom = { ...room, members: updatedMembers };

    setRoom(updatedRoom);
    await saveRoomData(roomId, updatedRoom);
    setSplitWith((prev) => prev.filter((m) => m !== memberToRemove));

    setPayerShares((prev) => {
      const updated = { ...prev };
      delete updated[memberToRemove];
      return updated;
    });

    if (currentUser === memberToRemove) {
      handleSwitchUser();
    }
  };

  const handlePayerAmountChange = (member, val) => {
    setPayerShares((prev) => ({
      ...prev,
      [member]: val,
    }));
  };

  const multiplePayersTotal = Object.values(payerShares).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );

  const handleStartEdit = (expense) => {
    setEditingExpenseId(expense.id);
    setDesc(expense.desc);
    setDatetime(expense.datetime || getNowDatetime());
    setSplitWith(expense.splitWith || room.members);

    const isMultiPayer = Array.isArray(expense.payers) && expense.payers.length > 1;

    if (isMultiPayer) {
      setPayerMode('multiple');
      const shares = {};
      expense.payers.forEach((p) => {
        shares[p.member] = p.amount.toString();
      });
      setPayerShares(shares);
      setAmount('');
    } else {
      setPayerMode('single');
      setAmount(expense.amount.toString());
      setPaidBy(expense.payers?.[0]?.member || expense.paidBy || currentUser || room.members[0]);
      setPayerShares({});
    }

    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingExpenseId(null);
    setDesc('');
    setAmount('');
    setPayerShares({});
    setPaidBy(currentUser || room.members[0] || '');
    setSplitWith(room.members);
    setDatetime(getNowDatetime());
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!room || splitWith.length === 0) return;

    let finalAmount = 0;
    let finalPayers = [];
    let primaryPaidBy = '';

    if (payerMode === 'single') {
      finalAmount = parseFloat(amount);
      if (!finalAmount || finalAmount <= 0 || !paidBy) {
        alert('Please specify a valid amount and payer.');
        return;
      }
      primaryPaidBy = paidBy;
      finalPayers = [{ member: paidBy, amount: finalAmount }];
    } else {
      finalPayers = Object.entries(payerShares)
        .map(([member, shareAmt]) => ({
          member,
          amount: parseFloat(shareAmt) || 0,
        }))
        .filter((p) => p.amount > 0);

      finalAmount = finalPayers.reduce((acc, p) => acc + p.amount, 0);

      if (finalAmount <= 0 || finalPayers.length === 0) {
        alert('Please enter a paid amount for at least one member.');
        return;
      }

      primaryPaidBy =
        finalPayers.length === 1
          ? finalPayers[0].member
          : `${finalPayers.length} payers`;
    }

    if (editingExpenseId) {
      const updatedExpenses = room.expenses.map((exp) => {
        if (exp.id === editingExpenseId) {
          return {
            ...exp,
            desc: desc.trim() || 'General Expense',
            amount: finalAmount,
            paidBy: primaryPaidBy,
            payers: finalPayers,
            splitWith,
            datetime: datetime || getNowDatetime(),
          };
        }
        return exp;
      });

      const updatedRoom = { ...room, expenses: updatedExpenses };
      setRoom(updatedRoom);
      await saveRoomData(roomId, updatedRoom);
      handleCancelEdit();
    } else {
      const newExpense = {
        id: Date.now(),
        desc: desc.trim() || 'General Expense',
        amount: finalAmount,
        paidBy: primaryPaidBy,
        payers: finalPayers,
        splitWith,
        datetime: datetime || getNowDatetime(),
        isSettlement: false,
      };

      const updatedRoom = {
        ...room,
        expenses: [newExpense, ...(room.expenses || [])],
      };

      setRoom(updatedRoom);
      await saveRoomData(roomId, updatedRoom);

      setDesc('');
      setAmount('');
      setPayerShares({});
      setDatetime(getNowDatetime());
    }
  };

  const handleRemoveExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    if (editingExpenseId === expenseId) {
      handleCancelEdit();
    }

    const updatedExpenses = room.expenses.filter((exp) => exp.id !== expenseId);
    const updatedRoom = { ...room, expenses: updatedExpenses };

    setRoom(updatedRoom);
    await saveRoomData(roomId, updatedRoom);
  };

  const handleSettle = async (from, to, settleAmount) => {
    const settlementExpense = {
      id: Date.now(),
      desc: `Settlement: ${from} → ${to}`,
      amount: parseFloat(settleAmount),
      paidBy: from,
      payers: [{ member: from, amount: parseFloat(settleAmount) }],
      splitWith: [to],
      datetime: getNowDatetime(),
      isSettlement: true,
    };

    const updatedRoom = {
      ...room,
      expenses: [settlementExpense, ...(room.expenses || [])],
    };

    setRoom(updatedRoom);
    await saveRoomData(roomId, updatedRoom);
  };

  const toggleSplitMember = (member) => {
    if (splitWith.includes(member)) {
      setSplitWith(splitWith.filter((m) => m !== member));
    } else {
      setSplitWith([...splitWith, member]);
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-[#1F150C] bg-[radial-gradient(#412D15_1px,transparent_1px)] [background-size:24px_24px] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 font-mono text-xs text-[#1F150C] uppercase tracking-widest bg-[#E1DCC9] px-5 py-3 border border-[#412D15] shadow-lg">
          <span className="h-2 w-2 rounded-full bg-[#412D15] animate-pulse"></span>
          Loading Ledger...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#1F150C] bg-[radial-gradient(#412D15_1px,transparent_1px)] [background-size:24px_24px] text-[#E1DCC9] flex flex-col justify-between p-6">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md w-full bg-[#E1DCC9] border border-[#412D15] text-[#1F150C] p-8 relative shadow-2xl">
            <span className="absolute -top-1 -left-1 w-2 h-2 bg-[#412D15]"></span>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#412D15]"></span>
            <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#412D15]"></span>
            <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#412D15]"></span>

            <div className="mb-6 pb-4 border-b border-[#412D15]/30">
              <span className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase">Room Session</span>
              <h2 className="text-xl font-bold text-[#1F150C] tracking-tight mt-1">{room.name}</h2>
            </div>

            {room.members && room.members.length > 0 && (
              <div className="mb-6">
                <span className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-2">
                  Select Existing Identity
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {room.members.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setCurrentUser(m);
                        setPaidBy(m);
                        setSplitWith(room.members);
                        sessionStorage.setItem(`session_${roomId}`, m);
                      }}
                      className="px-3 py-1.5 text-xs font-mono border border-[#412D15] bg-[#E1DCC9] text-[#1F150C] hover:bg-[#412D15] hover:text-[#E1DCC9] transition cursor-pointer"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-1">
                  Or Join With New Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter name..."
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/50 text-[#1F150C] placeholder:text-[#412D15]/60"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#412D15] text-[#E1DCC9] py-2.5 text-xs font-mono uppercase tracking-widest font-bold hover:bg-[#1F150C] transition cursor-pointer shadow-md"
              >
                Access Ledger →
              </button>
            </form>
          </div>
        </div>

        <footer className="pt-6 border-t border-dashed border-[#412D15] text-center font-mono text-[11px] text-[#E1DCC9]/70 flex items-center justify-center gap-3">
          <span>Achilles Fayloga</span>
          <span>•</span>
          <span>Warm Earth Minimal Ledger</span>
        </footer>
      </div>
    );
  }

  const { balances, totalPaid, totalShare, settlements } = calculateFinancials(
    room.members || [],
    room.expenses || []
  );

  const filteredExpenses = (room.expenses || []).filter((exp) => {
    const payersList = Array.isArray(exp.payers) && exp.payers.length > 0
      ? exp.payers.map((p) => p.member)
      : [exp.paidBy];

    const matchesSearch =
      exp.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payersList.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase())) ||
      exp.splitWith.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesMember =
      memberFilter === 'ALL' ||
      payersList.includes(memberFilter) ||
      exp.splitWith.includes(memberFilter);

    const matchesType =
      typeFilter === 'ALL' ||
      (typeFilter === 'SETTLEMENT' && exp.isSettlement) ||
      (typeFilter === 'EXPENSE' && !exp.isSettlement);

    const expDate = exp.datetime ? exp.datetime.slice(0, 10) : '';
    const matchesStartDate = !startDate || (expDate && expDate >= startDate);
    const matchesEndDate = !endDate || (expDate && expDate <= endDate);

    return matchesSearch && matchesMember && matchesType && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="min-h-screen bg-[#1F150C] bg-[radial-gradient(#412D15_1px,transparent_1px)] [background-size:24px_24px] text-[#E1DCC9] flex flex-col justify-between selection:bg-[#412D15] selection:text-[#E1DCC9]">
      <div>
        <header className="bg-[#1F150C] border-b border-[#412D15] sticky top-0 z-20 shadow-md">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 bg-[#412D15] border border-[#E1DCC9]/40"></span>
              <div>
                <h1 className="font-bold font-mono text-sm tracking-tight uppercase leading-none text-[#E1DCC9]">
                  {room.name}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-[#E1DCC9]/60 uppercase tracking-wider">User:</span>
                  <span className="text-xs font-mono font-bold text-[#E1DCC9]">{currentUser}</span>
                  <button
                    onClick={handleSwitchUser}
                    className="text-[10px] font-mono text-[#E1DCC9] hover:text-[#E1DCC9]/80 underline uppercase cursor-pointer"
                  >
                    Switch
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyRoomLink}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#412D15] hover:border-[#E1DCC9] text-[11px] font-mono uppercase tracking-wider bg-[#1F150C] text-[#E1DCC9] transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#E1DCC9]" /> : <Copy className="w-3.5 h-3.5 text-[#E1DCC9]/70" />}
                {copied ? 'Copied' : 'Share URL'}
              </button>
              <Link
                to="/"
                className="px-3 py-1.5 border border-transparent text-[#E1DCC9]/70 hover:text-[#E1DCC9] text-[11px] font-mono uppercase tracking-wider"
              >
                Exit
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <div
              ref={formRef}
              className={`bg-[#E1DCC9] border transition-all text-[#1F150C] p-6 relative shadow-xl ${
                editingExpenseId ? 'border-[#1F150C] ring-2 ring-[#412D15]' : 'border-[#412D15]'
              }`}
            >
              <span className="absolute -top-1 -left-1 w-1.5 h-1.5 bg-[#412D15]"></span>
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#412D15]"></span>
              <span className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-[#412D15]"></span>
              <span className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-[#412D15]"></span>

              <div className="flex items-center justify-between pb-4 mb-4 border-b border-dashed border-[#412D15]/40">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${editingExpenseId ? 'bg-rose-700 animate-ping' : 'bg-[#412D15]'}`}></span>
                  <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-[#1F150C]">
                    {editingExpenseId ? 'Modify Transaction Entry' : 'New Transaction Entry'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {editingExpenseId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-2 py-0.5 text-[10px] font-mono uppercase bg-[#1F150C] text-[#E1DCC9] hover:bg-[#412D15] transition cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  )}

                  <div className="flex border border-[#412D15] text-[10px] font-mono uppercase">
                    <button
                      type="button"
                      onClick={() => setPayerMode('single')}
                      className={`flex items-center gap-1 px-2.5 py-1 transition cursor-pointer ${
                        payerMode === 'single'
                          ? 'bg-[#412D15] text-[#E1DCC9] font-bold'
                          : 'bg-[#E1DCC9] text-[#412D15] hover:text-[#1F150C]'
                      }`}
                    >
                      <User className="w-3 h-3" /> Single
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayerMode('multiple')}
                      className={`flex items-center gap-1 px-2.5 py-1 transition border-l border-[#412D15] cursor-pointer ${
                        payerMode === 'multiple'
                          ? 'bg-[#412D15] text-[#E1DCC9] font-bold'
                          : 'bg-[#E1DCC9] text-[#412D15] hover:text-[#1F150C]'
                      }`}
                    >
                      <Users className="w-3 h-3" /> Multiple
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitExpense} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className={payerMode === 'single' ? 'sm:col-span-2' : 'sm:col-span-3'}>
                    <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-1">
                      Description / Memo
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Server Bills, Team Dinner..."
                      value={desc}
                      onChange={(e) => setDesc(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/40 text-[#1F150C] placeholder:text-[#412D15]/60"
                    />
                  </div>

                  {payerMode === 'single' && (
                    <div>
                      <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-1">
                        Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/40 text-[#1F150C] placeholder:text-[#412D15]/60"
                      />
                    </div>
                  )}
                </div>

                {payerMode === 'single' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-1">
                        Paid By
                      </label>
                      <select
                        value={paidBy}
                        onChange={(e) => setPaidBy(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/40 text-[#1F150C]"
                      >
                        {room.members.map((m) => (
                          <option key={m} value={m} className="bg-[#E1DCC9] text-[#1F150C]">
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-1">
                        Timestamp
                      </label>
                      <div className="relative border border-[#412D15] bg-[#E1DCC9]/40 px-2 py-1">
                        <input
                          type="datetime-local"
                          required
                          value={datetime}
                          onChange={(e) => setDatetime(e.target.value)}
                          className="w-full text-xs font-mono bg-transparent outline-none text-[#1F150C] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border border-[#412D15] bg-[#E1DCC9]/60 p-3 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#412D15]/30">
                      <span className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase">
                        Split Payers Breakdown
                      </span>
                      <span className="text-xs font-mono font-bold text-[#1F150C]">
                        Sum: ${multiplePayersTotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                      {room.members.map((member) => (
                        <div key={member} className="flex items-center justify-between gap-2 border border-[#412D15] bg-[#E1DCC9] px-2 py-1">
                          <span className="text-xs font-mono text-[#1F150C] truncate">{member}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={payerShares[member] || ''}
                            onChange={(e) => handlePayerAmountChange(member, e.target.value)}
                            className="w-20 px-1.5 py-0.5 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/30 text-[#1F150C] text-right"
                          />
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-1">
                        Timestamp
                      </label>
                      <div className="relative border border-[#412D15] bg-[#E1DCC9]/40 px-2 py-1">
                        <input
                          type="datetime-local"
                          required
                          value={datetime}
                          onChange={(e) => setDatetime(e.target.value)}
                          className="w-full text-xs font-mono bg-transparent outline-none text-[#1F150C] cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase">
                      Split Between ({splitWith.length})
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {room.members.map((m) => {
                      const active = splitWith.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleSplitMember(m)}
                          className={`px-2.5 py-1 text-xs font-mono border transition cursor-pointer ${
                            active
                              ? `${getMemberTagColor(m)} font-bold shadow-sm ring-1 ring-[#412D15]`
                              : 'bg-[#E1DCC9] text-[#412D15]/70 border-[#412D15]/40 hover:border-[#412D15]'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[#412D15] text-[#E1DCC9] py-2.5 text-xs font-mono uppercase tracking-widest font-bold hover:bg-[#1F150C] transition cursor-pointer shadow-md"
                  >
                    {editingExpenseId ? 'Save Modifications ✓' : 'Commit Transaction +'}
                  </button>
                  {editingExpenseId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="border border-[#412D15] text-[#1F150C] px-4 py-2.5 text-xs font-mono uppercase tracking-widest font-bold hover:bg-[#412D15]/10 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="bg-[#E1DCC9] border border-[#412D15] text-[#1F150C] shadow-xl">
              <div className="p-4 border-b border-[#412D15]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#412D15]"></span>
                    <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-[#1F150C]">
                      Ledger Log ({filteredExpenses.length})
                    </h2>
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-[10px] font-mono uppercase text-[#412D15] hover:text-[#1F150C] flex items-center gap-1 cursor-pointer font-bold"
                    >
                      Reset dates <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1 border-t border-dashed border-[#412D15]/30">
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 px-2 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/40 text-[#1F150C] placeholder:text-[#412D15]/60"
                  />

                  <select
                    value={memberFilter}
                    onChange={(e) => setMemberFilter(e.target.value)}
                    className="h-8 px-2 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/40 text-[#1F150C]"
                  >
                    <option value="ALL">All Participants</option>
                    {room.members.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="h-8 px-2 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/40 text-[#1F150C]"
                  >
                    <option value="ALL">All Types</option>
                    <option value="EXPENSE">Expenses</option>
                    <option value="SETTLEMENT">Settlements</option>
                  </select>

                  <div className="h-8 flex items-center border border-[#412D15] bg-[#E1DCC9]/40 px-2">
                    <span className="text-[9px] font-mono uppercase text-[#412D15] pr-1.5 shrink-0">From</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full min-w-0 text-[11px] font-mono bg-transparent outline-none text-[#1F150C] cursor-pointer"
                    />
                  </div>

                  <div className="h-8 flex items-center border border-[#412D15] bg-[#E1DCC9]/40 px-2">
                    <span className="text-[9px] font-mono uppercase text-[#412D15] pr-1.5 shrink-0">To</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full min-w-0 text-[11px] font-mono bg-transparent outline-none text-[#1F150C] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {filteredExpenses.length === 0 ? (
                <div className="p-8 text-center font-mono text-xs text-[#412D15]">
                  // No matching ledger records.
                </div>
              ) : (
                <div className="divide-y divide-[#412D15]/30">
                  {filteredExpenses.map((exp) => {
                    const isMultiPayer = Array.isArray(exp.payers) && exp.payers.length > 1;
                    const isCurrentlyEditing = editingExpenseId === exp.id;

                    return (
                      <div
                        key={exp.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                          isCurrentlyEditing ? 'bg-[#412D15]/20 border-l-4 border-[#412D15]' : 'hover:bg-[#412D15]/10'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#412D15]"></span>
                            <span className="font-mono text-xs font-bold text-[#1F150C]">{exp.desc}</span>
                            {exp.isSettlement && (
                              <span className="px-1.5 py-0.5 border border-[#412D15] text-[#412D15] text-[9px] font-mono uppercase bg-[#E1DCC9]">
                                Settled
                              </span>
                            )}
                            {isCurrentlyEditing && (
                              <span className="px-1.5 py-0.5 border border-[#1F150C] bg-[#1F150C] text-[#E1DCC9] text-[9px] font-mono uppercase">
                                Editing
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-[#412D15]">
                            {isMultiPayer ? (
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="text-[#412D15]">Paid by:</span>
                                {exp.payers.map((p, idx) => (
                                  <span key={idx} className={`border px-1.5 py-0.5 text-[10px] font-mono ${getMemberTagColor(p.member)}`}>
                                    {p.member} (${Number(p.amount).toFixed(2)})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="flex items-center gap-1">
                                <span>Paid by</span>
                                <span className={`border px-1.5 py-0.5 text-[10px] font-mono ${getMemberTagColor(exp.payers?.[0]?.member || exp.paidBy)}`}>
                                  {exp.payers?.[0]?.member || exp.paidBy}
                                </span>
                              </span>
                            )}

                            <span>•</span>
                            <span className="text-[#412D15]">Split:</span>
                            <div className="inline-flex flex-wrap gap-1 items-center">
                              {exp.splitWith.map((member) => (
                                <span
                                  key={member}
                                  className={`border px-1.5 py-0.5 text-[10px] font-mono ${getMemberTagColor(member)}`}
                                >
                                  {member}
                                </span>
                              ))}
                            </div>
                          </div>

                          <p className="text-[10px] font-mono text-[#412D15] flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#412D15]" />
                            {new Date(exp.datetime).toLocaleString([], {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-dashed border-[#412D15]/30">
                          <span className="font-mono font-bold text-sm text-[#1F150C]">
                            ${Number(exp.amount).toFixed(2)}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            {!exp.isSettlement && (
                              <button
                                onClick={() => handleStartEdit(exp)}
                                className={`p-1 transition cursor-pointer ${
                                  isCurrentlyEditing
                                    ? 'text-[#1F150C] font-bold'
                                    : 'text-[#412D15]/60 hover:text-[#1F150C]'
                                }`}
                                title="Edit transaction"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleRemoveExpense(exp.id)}
                              className="p-1 text-[#412D15]/60 hover:text-[#1F150C] transition cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <div className="bg-[#E1DCC9] border border-[#412D15] text-[#1F150C] p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-[#412D15]/40">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#412D15]"></span>
                  <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-[#1F150C]">
                    Participants ({room.members.length})
                  </h2>
                </div>
              </div>

              <form onSubmit={handleAddMember} className="flex gap-2 mb-3">
                <input
                  type="text"
                  placeholder="New member name..."
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1 px-2.5 py-1 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/40 text-[#1F150C] placeholder:text-[#412D15]/60"
                />
                <button
                  type="submit"
                  className="bg-[#412D15] text-[#E1DCC9] px-3 py-1 text-xs font-mono uppercase tracking-wider font-bold hover:bg-[#1F150C] transition cursor-pointer"
                >
                  Add +
                </button>
              </form>

              <div className="divide-y divide-[#412D15]/30">
                {room.members.map((m) => (
                  <div key={m} className="flex items-center justify-between py-2 text-xs font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className={`border px-1.5 py-0.5 text-[10px] ${getMemberTagColor(m)}`}>{m}</span>
                      {m === currentUser && <span className="text-[#412D15] font-bold text-[10px]">[You]</span>}
                    </span>
                    {room.members.length > 1 && (
                      <button
                        onClick={() => handleRemoveMember(m)}
                        className="text-[#412D15]/60 hover:text-[#1F150C] transition cursor-pointer"
                        title={`Remove ${m}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#E1DCC9] border border-[#412D15] text-[#1F150C] p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-[#412D15]/40">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#412D15]"></span>
                  <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-[#1F150C]">
                    Balances
                  </h2>
                </div>
              </div>

              <div className="space-y-2">
                {room.members.map((m) => {
                  const balance = balances[m] || 0;
                  return (
                    <div key={m} className="p-2.5 border border-[#412D15] bg-[#E1DCC9]/60 font-mono text-xs space-y-1">
                      <div className="flex justify-between items-center">
                        <span className={`border px-1.5 py-0.5 text-[10px] font-mono ${getMemberTagColor(m)}`}>
                          {m}
                        </span>
                        <span
                          className={`font-bold font-mono text-xs ${
                            balance > 0.01
                              ? 'text-emerald-700'
                              : balance < -0.01
                              ? 'text-rose-700'
                              : 'text-stone-500'
                          }`}
                        >
                          {balance > 0.01
                            ? `+$${balance.toFixed(2)}`
                            : balance < -0.01
                            ? `-$${Math.abs(balance).toFixed(2)}`
                            : '$0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] text-[#412D15] border-t border-dashed border-[#412D15]/30 pt-1">
                        <span>Paid: ${(totalPaid[m] || 0).toFixed(2)}</span>
                        <span>Share: ${(totalShare[m] || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[#E1DCC9] border border-[#412D15] text-[#1F150C] p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-dashed border-[#412D15]/40">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#412D15]"></span>
                  <h2 className="text-xs font-mono font-bold tracking-widest uppercase text-[#1F150C]">
                    Settlement Queue
                  </h2>
                </div>
              </div>

              {settlements.length === 0 ? (
                <p className="font-mono text-xs text-[#412D15]">// All obligations settled.</p>
              ) : (
                <div className="space-y-2">
                  {settlements.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 border border-[#412D15] bg-[#E1DCC9]/60 font-mono text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-[#1F150C]">
                          <span className={`border px-1 py-0.5 text-[9px] ${getMemberTagColor(s.from)}`}>{s.from}</span>
                          <ArrowRight className="w-3 h-3 text-[#412D15]" />
                          <span className={`border px-1 py-0.5 text-[9px] ${getMemberTagColor(s.to)}`}>{s.to}</span>
                        </div>
                        <span className="font-bold text-[#1F150C] text-xs mt-0.5 block">${s.amount}</span>
                      </div>

                      <button
                        onClick={() => handleSettle(s.from, s.to, s.amount)}
                        className="border border-[#412D15] bg-[#E1DCC9] px-2.5 py-1 text-[10px] font-mono uppercase text-[#1F150C] hover:bg-[#412D15] hover:text-[#E1DCC9] transition cursor-pointer font-bold shadow-sm"
                      >
                        Settle
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className="mt-12 bg-[#1F150C] border-t border-[#412D15]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-[#E1DCC9]/70">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#412D15]"></span>
            <span className="text-[11px] text-[#E1DCC9]/50">
              Achilles Fayloga
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[#E1DCC9]/50">
            <span>• • •</span>
            <span>Who2Pay: Expense Tracker and Splitter</span>
            <span>• • •</span>
          </div>

          <div className="text-[11px] text-[#E1DCC9]/60">
            <span>Session: {room.name}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}