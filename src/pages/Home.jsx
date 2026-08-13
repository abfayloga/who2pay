import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { saveRoomData } from '../utils/storage';

export default function Home() {
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || isCreating) return;

    setIsCreating(true);
    const roomId = Math.random().toString(36).substring(2, 8);
    const initialData = {
      name: groupName.trim(),
      members: [],
      expenses: [],
    };

    await saveRoomData(roomId, initialData);
    setIsCreating(false);
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="min-h-screen bg-[#1F150C] bg-[radial-gradient(#412D15_1px,transparent_1px)] [background-size:24px_24px] text-[#E1DCC9] flex flex-col justify-between selection:bg-[#412D15] selection:text-[#E1DCC9] p-6">
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="max-w-md w-full bg-[#E1DCC9] border border-[#412D15] text-[#1F150C] p-8 relative shadow-2xl">
          <span className="absolute -top-1 -left-1 w-2 h-2 bg-[#412D15]"></span>
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#412D15]"></span>
          <span className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#412D15]"></span>
          <span className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#412D15]"></span>

          <div className="mb-6 pb-5 border-b border-[#412D15]/30 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-[#412D15] text-[#E1DCC9] mb-3 border border-[#1F150C]">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block">
              Expense Splitting Protocol
            </span>
            <h1 className="text-2xl font-bold font-mono text-[#1F150C] tracking-tight uppercase mt-1">
              When2Split
            </h1>
            <p className="text-xs font-mono text-[#412D15]/80 mt-2">
              No registration required. Initialize a room, distribute the URL, and track shared balances in real time.
            </p>
          </div>

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div>
              <label className="text-[10px] font-mono tracking-widest text-[#412D15] uppercase block mb-1">
                Ledger / Group Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Weekend Ski Trip..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-[#412D15] focus:outline-none focus:ring-1 focus:ring-[#1F150C] bg-[#E1DCC9]/50 text-[#1F150C] placeholder:text-[#412D15]/60"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="w-full flex items-center justify-center gap-2 bg-[#412D15] text-[#E1DCC9] py-2.5 text-xs font-mono uppercase tracking-widest font-bold hover:bg-[#1F150C] transition cursor-pointer shadow-md disabled:opacity-50"
            >
              {isCreating ? 'Initializing...' : 'Initialize Room'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      <footer className="pt-6 border-t border-dashed border-[#412D15] text-center font-mono text-[11px] text-[#E1DCC9]/70 flex items-center justify-center gap-3">
        <span>Achilles Fayloga</span>
        <span>•</span>
        <span>Who2Pay: Expense Tracker and Splitter</span>
      </footer>
    </div>
  );
}