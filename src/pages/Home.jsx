import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ArrowRight, Sun, Moon, Monitor } from 'lucide-react';
import { saveRoomData } from '../utils/storage';
import { useTheme } from '../hooks/useTheme';

export default function Home() {
  const [groupName, setGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    if (!groupName.trim() || isCreating) return;
    setIsCreating(true);
    setError('');
    const roomId = Math.random().toString(36).slice(2, 8);
    try {
      await saveRoomData(roomId, {
        name: groupName.trim(), members: [], memberColors: {}, expenses: [], currency: 'PHP',
      });
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err?.message || 'Unable to create the room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f3] font-sans text-[#0f172a]">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <span className="text-base font-bold tracking-tight">Who2Pay</span>
        <div className="flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white p-1" role="group" aria-label="Appearance">
          {[{ value: 'light', Icon: Sun, label: 'Light' }, { value: 'dark', Icon: Moon, label: 'Dark' }, { value: 'system', Icon: Monitor, label: 'System' }].map(({ value, Icon, label }) => (
            <button key={value} type="button" title={label} aria-label={`${label} theme`} aria-pressed={theme === value}
              onClick={() => setTheme(value)}
              className={`rounded-md p-2 ${theme === value ? 'bg-[#0f766e] text-white' : 'text-[#64748b] hover:bg-[#f1f5f9]'}`}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-xl border border-[#dedbd4] bg-white p-6 sm:p-8">
          <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-[#f0fdfa] text-[#0f766e]"><Users className="h-6 w-6" /></span>
          <h1 className="text-2xl font-bold tracking-tight">Split expenses, simply.</h1>
          <p className="mt-2 text-sm leading-6 text-[#64748b]">Create a room, share the link, and track balances together in real time. No sign-up needed.</p>
          <form onSubmit={handleCreateRoom} className="mt-7 space-y-4">
            <div>
              <label htmlFor="groupName" className="mb-1.5 block text-sm font-medium">Group name</label>
              <input id="groupName" type="text" required maxLength={100} placeholder="e.g. Weekend trip"
                value={groupName} onChange={(event) => setGroupName(event.target.value)}
                className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-3 text-sm text-[#0f172a] outline-none focus:border-[#0f766e]" />
            </div>
            {error && <p role="alert" className="text-sm text-[#b91c1c]">{error}</p>}
            <button type="submit" disabled={isCreating}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-semibold text-white hover:bg-[#115e59] disabled:opacity-50">
              {isCreating ? 'Creating room…' : 'Create room'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </section>
      </main>
      <footer className="px-5 py-6 text-center text-xs text-[#64748b]">Achilles Fayloga · Who2Pay</footer>
    </div>
  );
}
