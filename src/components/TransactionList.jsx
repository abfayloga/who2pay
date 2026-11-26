import { useState } from 'react';
import {
  ClipboardPaste,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  MoreHorizontal,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { formatCompactDate, formatDate, todayIsoDate, toIsoDate } from '../utils/formatDate';
import { getSettledMemberIds } from '../utils/settlement';
import { getExpenseShares } from '../utils/splitShares';
import { EXPORT_HEADERS, TABLE_HEADERS, exportRowForTransaction, parseImportedTransactions, tableRowForTransaction, getPayers } from '../utils/tableTransactions';
import { cardClass, fieldClass, primaryButton, secondaryButton } from '../utils/uiClasses';
import DateField from './DateField';
import ParticipantSettlementPopover from './ParticipantSettlementPopover';
import TransactionDetailsModal from './TransactionDetailsModal';
import { CardHeading, MemberTag, ModalFrame } from './roomUi';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const csvCell = (value) => {
  const original = String(value ?? '');
  const safe = /^[\s]*[=+@\-\t\r]/.test(original) ? `'${original}` : original;
  return `"${safe.replace(/"/g, '""')}"`;
};

const fileSlug = (value) => (
  String(value || 'room').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'room'
);

export default function TransactionList({
  roomName,
  currency,
  members,
  expenses,
  colors,
  editingExpenseId,
  formatAmount,
  settlingKey,
  onEdit,
  onDelete,
  onImport,
  onSetParticipantsSettled,
  currentUser,
}) {
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
  const [viewingExpenseId, setViewingExpenseId] = useState(null);
  const [splitBreakdownExpenseId, setSplitBreakdownExpenseId] = useState(null);
  const [mobileMenuExpenseId, setMobileMenuExpenseId] = useState(null);
  const [participantPopover, setParticipantPopover] = useState(null);

  const hasFilters = Boolean(searchQuery || startDate || endDate || memberFilter !== 'ALL' || typeFilter !== 'EXPENSE');
  const filteredExpenses = expenses.filter((expense) => {
    if (expense.internalSettlementOffset) return false;
    const payers = getPayers(expense).map((payer) => payer.member);
    const splitMembers = expense.splitWith || [];
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [expense.desc || '', ...payers, ...splitMembers]
      .some((value) => String(value).toLowerCase().includes(query));
    const matchesMember = memberFilter === 'ALL' || payers.includes(memberFilter) || splitMembers.includes(memberFilter);
    const matchesType = typeFilter === 'ALL' || (typeFilter === 'SETTLEMENT' ? expense.isSettlement : !expense.isSettlement);
    const date = toIsoDate(expense.datetime);
    return matchesSearch && matchesMember && matchesType
      && (!startDate || (date && date >= startDate))
      && (!endDate || (date && date <= endDate));
  });

  const clearFilters = () => {
    setSearchQuery('');
    setMemberFilter('ALL');
    setTypeFilter('EXPENSE');
    setStartDate('');
    setEndDate('');
  };

  const importPreview = parseImportedTransactions(importText, members);
  const viewingExpense = expenses.find((entry) => String(entry.id) === String(viewingExpenseId)) || null;
  const splitBreakdownExpense = expenses.find((entry) => String(entry.id) === String(splitBreakdownExpenseId)) || null;
  const splitBreakdownShares = splitBreakdownExpense ? getExpenseShares(splitBreakdownExpense) : {};
  const participantPopoverExpense = expenses.find(
    (entry) => !entry.isSettlement && String(entry.id) === String(participantPopover?.expenseId),
  ) || null;
  const participantPopoverSettledIds = participantPopoverExpense
    ? getSettledMemberIds(participantPopoverExpense, expenses)
    : [];

  const isExpenseSettled = (expense) => {
    if (expense.isSettlement) return false;
    const participants = [...new Set(expense.splitWith || [])];
    if (!participants.length) return false;
    const settledMembers = new Set(getSettledMemberIds(expense, expenses));
    return participants.every((member) => settledMembers.has(member));
  };

  const renderSplitMembers = (expense) => {
    const splitNames = [...new Set(expense.splitWith || [])];
    const shares = getExpenseShares(expense);
    const breakdown = splitNames.map((name) => `${name}: ${formatAmount(shares[name] || 0)}`).join('\n');
    const openBreakdown = () => setSplitBreakdownExpenseId(expense.id);
    const breakdownButtonClass = 'max-w-full truncate rounded-full border border-[#99f6e4] bg-[#f0fdfa] px-2 py-0.5 text-[11px] font-medium leading-4 text-[#0f766e] hover:bg-[#ccfbf1]';
    const everyoneIncluded = members.length > 0
      && splitNames.length === members.length
      && members.every((name) => splitNames.includes(name));
    if (everyoneIncluded) {
      return (
        <button type="button" onClick={openBreakdown} title={breakdown} className={`${breakdownButtonClass} shrink-0`}>
          Everyone ({members.length})
        </button>
      );
    }

    const excludedMember = members.length >= 4 && splitNames.length === members.length - 1
      ? members.find((name) => !splitNames.includes(name))
      : null;
    if (excludedMember) {
      return (
        <button type="button" onClick={openBreakdown} title={breakdown} className={breakdownButtonClass}>
          All except {excludedMember}
        </button>
      );
    }

    const orderedNames = splitNames.length >= 4 && splitNames.includes(currentUser)
      ? [currentUser, ...splitNames.filter((name) => name !== currentUser)]
      : splitNames;
    const renderPills = (limit) => (
      <>
        {orderedNames.slice(0, limit).map((name) => (
          <div
            key={name}
            className={orderedNames.length > limit ? 'min-w-0 shrink overflow-hidden' : 'shrink-0'}
          >
            <MemberTag name={name} colors={colors} small />
          </div>
        ))}
        {orderedNames.length > limit && (
          <button type="button" onClick={openBreakdown} title={breakdown} className={`${breakdownButtonClass} shrink-0`}>
            +{orderedNames.length - limit}
          </button>
        )}
      </>
    );

    return (
      <>
        <div className="hidden min-w-0 flex-nowrap items-center gap-1 overflow-hidden md:flex">
          {renderPills(orderedNames.length <= 3 ? 3 : 2)}
        </div>
        <div className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden md:hidden">
          {renderPills(1)}
        </div>
      </>
    );
  };

  const handleImport = async () => {
    if (importSaving || !importPreview.transactions.length || importPreview.issues.length) return;
    setImportSaving(true);
    setImportMessage('');
    try {
      const saved = await onImport(importPreview.transactions, importPreview.newMembers);
      if (!saved) {
        setImportMessage('Could not save the import. No rows were added.');
        return;
      }
      setImportMessage(`Imported ${importPreview.transactions.length} transaction(s).`);
      setImportText('');
      setImportOpen(false);
    } finally {
      setImportSaving(false);
    }
  };

  const handleExportCsv = () => {
    if (!filteredExpenses.length) return;
    const rows = [EXPORT_HEADERS, ...filteredExpenses.map(exportRowForTransaction)];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileSlug(roomName)}-transactions.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportPdf = () => {
    if (!filteredExpenses.length) return;
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      window.alert('Please allow pop-ups to open the PDF print view.');
      return;
    }
    const rows = filteredExpenses.map((expense) => (
      `<tr>${exportRowForTransaction(expense).map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`
    )).join('');
    const generatedOn = formatDate(todayIsoDate());
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
      <title>${escapeHtml(roomName)} – Transactions</title>
      <style>
        @page { size: A4 landscape; margin: 14mm; }
        body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; padding: 16px; }
        h1 { margin: 0 0 8px; font-size: 22px; }
        .meta { font-size: 12px; color: #64748b; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
        th { text-align: left; background: #f1f5f9; color: #334155; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 6px; vertical-align: top; overflow-wrap: anywhere; }
        tr { break-inside: avoid; }
        th:nth-child(1) { width: 12%; } th:nth-child(2) { width: 33%; }
        th:nth-child(3) { width: 15%; } th:nth-child(4) { width: 20%; }
        th:nth-child(5) { width: 20%; }
        @media screen { body { max-width: 1100px; margin: auto; } }
      </style></head><body>
      <h1>${escapeHtml(roomName)} — Transaction report</h1>
      <p class="meta">${filteredExpenses.length} transaction(s) · Generated ${escapeHtml(generatedOn)} · Current table filters applied · Currency: ${escapeHtml(currency || 'PHP')}</p>
      <table><thead><tr>${EXPORT_HEADERS.map((heading) => `<th>${escapeHtml(heading)}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></body></html>`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
    }, { once: true });
    printWindow.document.close();
  };

  const actionsFor = (expense) => {
    const participants = [...new Set(expense.splitWith || [])];
    const settledIds = getSettledMemberIds(expense, expenses);
    const settledMembers = new Set(settledIds);
    const settledCount = participants.filter((member) => settledMembers.has(member)).length;
    const complete = participants.length > 0 && settledCount === participants.length;
    const openParticipantPopover = (anchor) => {
      if (settlingKey !== null || !participants.length) return;
      setParticipantPopover({ expenseId: expense.id, anchor });
    };
    const settlementControl = !expense.isSettlement && participants.length > 0
      ? (
        <button
          type="button"
          onClick={(event) => openParticipantPopover(event.currentTarget)}
          disabled={settlingKey !== null}
          aria-label={complete
            ? `Review settled transaction, ${settledCount} of ${participants.length}`
            : `Settle transaction, ${settledCount} of ${participants.length} participants settled`}
          title={complete ? 'Review or undo participant settlements' : 'Settle this individual transaction'}
          className={`inline-flex min-h-[34px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1 text-[11px] font-semibold disabled:opacity-50 md:min-h-[28px] md:px-1 md:text-[10px] ${complete ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' : 'min-w-[64px] border-[#99f6e4] bg-[#f0fdfa] text-[#0f766e] transition hover:bg-[#ccfbf1]'}`}
        >
          {complete ? (
            <>Settled ({settledCount}/{participants.length})</>
          ) : (
            <>
              <span>Settle</span>
              <span className="settlement-fraction-badge rounded-full border border-[#cbd5e1] bg-white/70 px-1 py-0.5 text-[9px] font-semibold leading-none tabular-nums text-[#475569]">
                {settledCount}/{participants.length}
              </span>
            </>
          )}
        </button>
      )
      : null;

    const closeMenu = (action) => {
      setMobileMenuExpenseId(null);
      action();
    };
    const moreActionsMenu = (
      <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-40 rounded-lg border border-[#e6e3dc] bg-white p-1 shadow-lg">
        <button type="button" role="menuitem" onClick={() => closeMenu(() => setViewingExpenseId(expense.id))} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#f1f5f9]">
          <Eye className="h-4 w-4" /> View details
        </button>
        {!expense.isSettlement && (
          <button type="button" role="menuitem" onClick={() => closeMenu(() => onEdit(expense))} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#334155] hover:bg-[#f1f5f9]">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
        <button type="button" role="menuitem" onClick={() => closeMenu(() => onDelete(expense.id))} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[#be123c] hover:bg-[#fff1f2]">
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    );

    return (
      <>
        <div className="hidden items-center gap-0.5 md:flex">
          <button
            type="button"
            onClick={() => setViewingExpenseId(expense.id)}
            aria-label="View details"
            title="View details"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#64748b] transition hover:bg-[#f0fdfa] hover:text-[#0f766e]"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {settlementControl}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMobileMenuExpenseId((current) => String(current) === String(expense.id) ? null : expense.id)}
              aria-label={`More actions for ${expense.desc || 'transaction'}`}
              aria-expanded={String(mobileMenuExpenseId) === String(expense.id)}
              title="More actions"
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {String(mobileMenuExpenseId) === String(expense.id) && moreActionsMenu}
          </div>
        </div>
        <div className="relative flex items-center gap-1 md:hidden">
          {settlementControl}
          <button
            type="button"
            onClick={() => setMobileMenuExpenseId((current) => String(current) === String(expense.id) ? null : expense.id)}
            aria-label={`More actions for ${expense.desc || 'transaction'}`}
            aria-expanded={String(mobileMenuExpenseId) === String(expense.id)}
            title="More actions"
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {String(mobileMenuExpenseId) === String(expense.id) && moreActionsMenu}
        </div>
      </>
    );
  };

  return (
    <section className={cardClass}>
      <CardHeading
        title={`Transactions (${filteredExpenses.length})`}
        right={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setImportOpen((open) => !open); setImportMessage(''); }} className={secondaryButton} aria-expanded={importOpen}>
              <ClipboardPaste className="h-4 w-4" /> Import table
            </button>
            <button type="button" onClick={handleExportCsv} disabled={!filteredExpenses.length} className={secondaryButton} title="Download a CSV of filtered transactions">
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </button>
            <button type="button" onClick={handleExportPdf} disabled={!filteredExpenses.length} className={secondaryButton} title="Open a print view and select Save as PDF">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        )}
      />
      {importOpen && (
        <div className="space-y-2 border-b border-[#e6e3dc] bg-[#faf9f6] px-3 py-3 sm:px-4 sm:py-4">
          <h3 className="text-sm font-semibold text-[#0f172a]">Import table</h3>
          <textarea
            rows={7}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            className={`${fieldClass} font-mono text-xs`}
            placeholder={'Description\tAmount\tPaid By\tSplit Between\nTeam lunch\t1200.00\tAlex\tAlex, Jamie, Sam\nTaxi fare\t450.00\tSam\tAlex, Sam'}
            aria-label="Paste transaction table"
          />
          {importText.trim() && (
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-[#334155]">Preview: {importPreview.transactions.length} valid of {importPreview.rowCount} rows</p>
              {importPreview.newMembers.length > 0 && <p className="text-[#92400e]">New room members to add: {importPreview.newMembers.join(', ')}</p>}
              {importPreview.issues.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-[#b91c1c]">
                  {importPreview.issues.map((issue, index) => <li key={index}>{issue}</li>)}
                </ul>
              )}
              {importPreview.transactions.length > 0 && (
                <div className="max-h-52 overflow-auto rounded-md border border-[#dedbd4] bg-white">
                  <table className="w-full min-w-[550px] text-left text-xs">
                    <thead>
                      <tr>{TABLE_HEADERS.map((heading) => <th key={heading} className="border-b border-[#dedbd4] p-2">{heading}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importPreview.transactions.slice(0, 10).map((entry, index) => (
                        <tr key={index} className="border-t border-[#eeeeea]">
                          {tableRowForTransaction(entry).map((cell, column) => <td key={column} className="p-2">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.transactions.length > 10 && <p className="p-2 text-[#64748b]">Showing the first 10 rows.</p>}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={importSaving || !importPreview.transactions.length || Boolean(importPreview.issues.length)}
              className={primaryButton}
            >
              {importSaving ? 'Importing…' : `Import ${importPreview.transactions.length} transactions`}
            </button>
            <button type="button" onClick={() => setImportOpen(false)} className={secondaryButton}>Cancel</button>
          </div>
        </div>
      )}
      {importMessage && <p role="status" className="border-b border-[#e6e3dc] px-5 py-3 text-sm text-[#0f766e]">{importMessage}</p>}
      <div className="border-b border-[#e6e3dc] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="search"
              aria-label="Search transactions"
              placeholder="Search transactions"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className={`${fieldClass} pl-9`}
            />
          </div>
          <button
            type="button"
            aria-label="Toggle transaction filters"
            title="Filters"
            aria-expanded={filtersOpen}
            aria-controls="transaction-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${filtersOpen || hasFilters ? 'border-[#0f766e] bg-[#f0fdfa] text-[#0f766e]' : 'border-[#cbd5e1] bg-white text-[#475569] hover:bg-[#f8fafc]'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {hasFilters && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#0f766e]" />}
          </button>
        </div>
        {filtersOpen && (
          <div id="transaction-filters" className="mt-3 space-y-3 rounded-lg border border-[#e6e3dc] bg-[#faf9f6] p-3">
            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
              <select aria-label="Filter by member" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)} className={fieldClass}>
                <option value="ALL">All members</option>
                {members.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select aria-label="Filter by transaction type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={fieldClass}>
                <option value="ALL">All transactions</option>
                <option value="EXPENSE">Expenses only</option>
                <option value="SETTLEMENT">Settlements only</option>
              </select>
              <DateField
                id="filter-start"
                label="From"
                value={startDate}
                onChange={setStartDate}
                labelClassName="mb-1 block text-xs text-[#64748b]"
              />
              <DateField
                id="filter-end"
                label="To"
                value={endDate}
                onChange={setEndDate}
                labelClassName="mb-1 block text-xs text-[#64748b]"
              />
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
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#94a3b8]">
            <Download className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">No transactions found</p>
          <p className="mt-1 text-sm text-[#64748b]">{hasFilters ? 'Try adjusting your filters.' : 'Add an expense to get started.'}</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <div role="table" aria-label="Transactions" className="transaction-grid text-left text-xs">
              <div role="rowgroup">
                <div role="row" className="transaction-grid-row transaction-grid-header bg-[#faf9f6] text-[#64748b]">
                  <div role="columnheader" className="py-2.5 font-semibold">Date</div>
                  <div role="columnheader" className="py-2.5 font-semibold">Transaction</div>
                  <div role="columnheader" className="py-2.5 font-semibold">Paid by</div>
                  <div role="columnheader" className="min-w-0 overflow-hidden py-2.5 font-semibold">Split between</div>
                  <div role="columnheader" className="transaction-grid-amount py-2.5 font-semibold">Amount</div>
                  <div role="columnheader" className="py-2.5 text-right font-semibold">Actions</div>
                </div>
              </div>
              <div role="rowgroup">
                {filteredExpenses.map((expense) => {
                  const settled = isExpenseSettled(expense);
                  const fullDate = formatDate(expense.datetime);
                  return (
                  <div
                    role="row"
                    key={expense.id}
                    className={`transaction-grid-row align-center border-b border-[#e2e8f0] transition ${expense.isSettlement ? 'bg-[#eef6f9] hover:bg-[#e4f0f5]' : settled ? 'bg-[#f0fdf4] text-[#64748b] hover:bg-[#ecfdf5]' : 'bg-white hover:bg-[#faf9f6]'} ${editingExpenseId === expense.id ? 'ring-1 ring-inset ring-[#0f766e]' : ''}`}
                  >
                    <div role="cell" title={fullDate || undefined} className="min-w-0 py-2.5 text-[#64748b]">{formatCompactDate(expense.datetime) || '—'}</div>
                    <div role="cell" className="min-w-0 py-2.5">
                      <div className={`break-words font-semibold ${settled ? 'text-[#64748b]' : 'text-[#0f172a]'}`}>{expense.desc}</div>
                    </div>
                    <div role="cell" className="min-w-0 overflow-hidden py-2.5">
                      <div className="flex min-w-0 flex-nowrap gap-1 overflow-hidden">
                        {getPayers(expense).map((payer, index) => <MemberTag key={`${payer.member}-${index}`} name={payer.member} colors={colors} small />)}
                      </div>
                    </div>
                    <div role="cell" className="min-w-0 overflow-hidden py-2.5">
                      <div className="min-w-0 overflow-hidden">
                        {renderSplitMembers(expense)}
                      </div>
                    </div>
                    <div role="cell" className={`transaction-grid-amount py-2.5 font-bold ${settled ? 'text-[#64748b]' : 'text-[#0f172a]'}`}>{formatAmount(expense.amount)}</div>
                    <div role="cell" className="min-w-0 py-2"><div className="flex justify-end">{actionsFor(expense)}</div></div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="transaction-mobile-list divide-y divide-[#e2e8f0] md:hidden">
            {filteredExpenses.map((expense) => {
              const settled = isExpenseSettled(expense);
              const payers = getPayers(expense);
              return (
                <article key={expense.id} className={`px-3 py-2.5 ${expense.isSettlement ? 'bg-[#eef6f9]' : settled ? 'bg-[#f0fdf4] text-[#64748b]' : 'bg-white'} ${editingExpenseId === expense.id ? 'ring-1 ring-inset ring-[#0f766e]' : ''}`}>
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-semibold leading-5 ${settled ? 'text-[#64748b]' : 'text-[#0f172a]'}`} title={expense.desc}>{expense.desc}</p>
                      <p className="mt-0.5 text-[10px] text-[#64748b]">{formatDate(expense.datetime) || '—'}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums">{formatAmount(expense.amount)}</span>
                  </div>
                  <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap text-[10px] text-[#64748b]">
                      <span className="shrink-0">Paid</span>
                      {payers.slice(0, 1).map((payer, index) => (
                        <MemberTag key={`${payer.member}-${index}`} name={payer.member} colors={colors} small />
                      ))}
                      {payers.length > 1 && (
                        <span title={payers.map(({ member }) => member).join(', ')} className="shrink-0 rounded-full border border-[#cbd5e1] px-1.5 py-0.5 text-[10px] leading-4">
                          +{payers.length - 1}
                        </span>
                      )}
                      <span className="ml-1 shrink-0">Split</span>
                      <div className="min-w-0 overflow-hidden">{renderSplitMembers(expense)}</div>
                    </div>
                    {actionsFor(expense)}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {viewingExpense && (
        <TransactionDetailsModal
          expense={viewingExpense}
          colors={colors}
          formatAmount={formatAmount}
          onClose={() => setViewingExpenseId(null)}
        />
      )}

      {splitBreakdownExpense && (
        <ModalFrame
          titleId="split-breakdown-title"
          title="Split breakdown"
          onClose={() => setSplitBreakdownExpenseId(null)}
          closeLabel="Close split breakdown"
        >
          <div className="mt-4 space-y-2">
            {(splitBreakdownExpense.splitWith || []).map((name) => (
              <div key={name} className="flex items-center justify-between gap-3 rounded-md border border-[#e6e3dc] bg-[#faf9f6] px-3 py-2">
                <MemberTag name={name} colors={colors} small />
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#0f172a]">
                  {formatAmount(splitBreakdownShares[name] || 0)}
                </span>
              </div>
            ))}
          </div>
        </ModalFrame>
      )}

      {participantPopoverExpense && participantPopover?.anchor?.isConnected && (
        <ParticipantSettlementPopover
          expense={{ ...participantPopoverExpense, settledMemberIds: participantPopoverSettledIds }}
          anchor={participantPopover.anchor}
          colors={colors}
          currentUser={currentUser}
          formatAmount={formatAmount}
          saving={settlingKey !== null}
          onSetParticipant={(member, shouldSettle) => onSetParticipantsSettled(participantPopoverExpense.id, [member], shouldSettle)}
          onSetParticipants={(names, shouldSettle) => onSetParticipantsSettled(participantPopoverExpense.id, names, shouldSettle)}
          onClose={() => setParticipantPopover(null)}
        />
      )}
    </section>
  );
}
