import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Users, Wallet } from 'lucide-react';
import { saveRoomData } from '../utils/storage';

export default function Home() {
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    if (!groupName.trim() || isCreating) return;

    setIsCreating(true);
    setError('');

    try {
      const roomId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
          : Math.random().toString(36).slice(2, 12);

      await saveRoomData(roomId, {
        name: groupName.trim(),
        members: [],
        memberColors: {},
        currency: 'PHP',
        expenses: [],
      });
      navigate(`/room/${roomId}`);
    } catch (err) {
      console.error('Could not create room:', err);
      setError('Could not create your room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f3] font-sans text-[#0f172a] selection:bg-[#ccfbf1]">
      <header className="border-b border-[#e6e3dc] bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f766e] text-white">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Who2Pay<span className="text-[#0f766e]">.</span></span>
          </div>
          <span className="ml-auto hidden text-sm text-[#64748b] sm:block">Simple shared expenses</span>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-20">
        <section className="max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-3 py-1.5 text-xs font-semibold text-[#0f766e]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0f766e]" />
            No sign-up required
          </div>
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">
            Split expenses.<br />
            <span className="text-[#0f766e]">Keep things simple.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[#64748b]">
            Track group spending, see who owes whom, and settle up together in one shared room.
          </p>
          <div className="mt-8 space-y-3 text-sm text-[#334155]">
            {['Create a room and share the link', 'Add expenses with one or multiple payers', 'Track balances together in real time'].map((text) => (
              <div key={text} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#ccfbf1] text-[#0f766e]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full max-w-lg rounded-lg border border-[#e6e3dc] bg-white p-6 shadow-sm sm:p-9 lg:ml-auto" aria-labelledby="create-room-title">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-lg bg-[#f0fdfa] text-[#0f766e]">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 id="create-room-title" className="text-2xl font-bold tracking-tight">Create a room</h2>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">
            Give your group a name to start tracking your shared expenses.
          </p>
          <form onSubmit={handleCreateRoom} className="mt-7 space-y-5">
            <div>
              <label htmlFor="group-name" className="mb-2 block text-sm font-semibold text-[#334155]">
                Group name
              </label>
              <input
                id="group-name"
                type="text"
                required
                maxLength={80}
                placeholder="e.g. Weekend trip, Apartment bills"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="w-full rounded-lg border border-[#cbd5e1] bg-white px-4 py-3 text-sm text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[#0f766e] focus:ring-2 focus:ring-[#ccfbf1]"
              />
            </div>
            {error && <p role="alert" className="text-sm text-[#b91c1c]">{error}</p>}
            <button
              type="submit"
              disabled={isCreating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#115e59] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? 'Creating room…' : 'Create room'}
              {!isCreating && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
            <p className="text-center text-xs leading-5 text-[#64748b]">
              Anyone with the room link can view and update its expenses.
            </p>
          </form>
        </section>
      </main>

      <footer className="border-t border-[#e6e3dc] px-5 py-5 text-center text-xs text-[#64748b] sm:px-8">
        Who2Pay · Expense tracker and splitter · Achilles Fayloga
      </footer>
    </div>
  );
}
