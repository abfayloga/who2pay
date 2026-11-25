import { useState } from 'react';
import {
  ClipboardPaste,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { formatDate, todayIsoDate, toIsoDate } from '../utils/formatDate';
import { repaymentsForExpense } from '../utils/settlement';
import { EXPORT_HEADERS, TABLE_HEADERS, exportRowForTransaction, parseImportedTransactions, tableRowForTransaction, getPayers } from '../utils/tableTransactions';
import { cardClass, fieldClass, primaryButton, secondaryButton } from '../utils/uiClasses';
import DateField from './DateField';
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
  onRecordPayments,
  onUndoPayments,
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
  const [settlementExpenseId, setSettlementExpenseId] = useState(null);
  const [selectedRepayments, setSelectedRepayments] = useState([]);

  const hasFilters = Boolean(searchQuery || startDate || endDate || memberFilter !== 'ALL' || typeFilter !== 'EXPENSE');
  const filteredExpenses = expenses.filter((expense) => {
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
  const settlementExpense = expenses.find((entry) => String(entry.id) === String(settlementExpenseId) && !entry.isSettlement) || null;

  const isExpenseSettled = (expense) => {
    if (expense.isSettlement) return false;
    const repayments = repaymentsForExpense(expense, expenses);
    return repayments.length > 0 && repayments.every((repayment) => repayment.paid);
  };

  const renderSplitMembers = (expense) => {
    const splitNames = expense.splitShares && typeof expense.splitShares === 'object'
      ? Object.keys(expense.splitShares)
      : (expense.splitWith || []);
    const everyoneIncluded = members.length > 0
      && splitNames.length === members.length
      && members.every((name) => splitNames.includes(name));
    if (everyoneIncluded) {
      return (
        <span
          title={members.join(', ')}
          className="inline-flex rounded-md border border-[#99f6e4] bg-[#f0fdfa] px-1.5 py-0.5 text-xs font-medium text-[#0f766e]"
        >
          Everyone ({members.length})
        </span>
      );
    }
    return splitNames.map((name) => <MemberTag key={name} name={name} colors={colors} small />);
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

  const openExpenseSettlement = (expense) => {
    if (settlingKey !== null) return;
    setSettlementExpenseId(expense.id);
    setSelectedRepayments([]);
  };

  const recordSelectedPayments = async () => {
    if (!settlementExpense || settlingKey !== null) return;
    const repayments = repaymentsForExpense(settlementExpense, expenses);
    const selected = repayments.filter((transfer) => !transfer.paid && selectedRepayments.includes(transfer.index));
    const saved = await onRecordPayments(settlementExpense, selected);
    if (!saved) return;
    setSettlementExpenseId(null);
    setSelectedRepayments([]);
  };

  const actionsFor = (expense) => {
    const repayments = expense.isSettlement ? [] : repaymentsForExpense(expense, expenses);
    const paidCount = repayments.filter((entry) => entry.paid).length;
    const complete = repayments.length > 0 && paidCount === repayments.length;
    const lockedByPayment = repayments.some((item) => item.paid);
    return (
      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={() => setViewingExpenseId(expense.id)}
          aria-label="View details"
          title="View details"
          className="hidden items-center justify-center rounded-lg p-1.5 text-[#64748b] transition hover:bg-[#f0fdfa] hover:text-[#0f766e] md:inline-flex"
        >
          <Eye className="h-4 w-4" />
        </button>
        {!expense.isSettlement && !complete && (
          <button
            type="button"
            onClick={() => openExpenseSettlement(expense)}
            disabled={settlingKey !== null || !repayments.length}
            title={!repayments.length ? 'No repayments needed' : 'Settle this individual transaction'}
            className="rounded-md border border-[#99f6e4] bg-[#f0fdfa] px-1.5 py-1.5 text-[11px] font-semibold text-[#0f766e] transition hover:bg-[#ccfbf1] disabled:opacity-50 sm:px-2 sm:text-xs"
          >
            {paidCount ? `Settle (${paidCount}/${repayments.length})` : 'Settle'}
          </button>
        )}
        {!expense.isSettlement && complete && (
          <span role="status" className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-1 text-[11px] font-semibold text-[#166534]">Settled</span>
        )}
        {!expense.isSettlement && paidCount > 0 && (
          <button
            type="button"
            onClick={() => onUndoPayments(expense)}
            disabled={settlingKey !== null}
            title="Undo recorded payments for this transaction"
            aria-label={`Undo settlement for ${expense.desc}`}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#64748b] hover:bg-[#f1f5f9] disabled:opacity-50"
          >
            Undo
          </button>
        )}
        {!expense.isSettlement && (
          <button
            type="button"
            onClick={() => onEdit(expense)}
            disabled={lockedByPayment}
            title={lockedByPayment ? 'Remove linked repayments before editing' : 'Edit transaction'}
            aria-label={`Edit ${expense.desc}`}
            className="rounded-lg p-1.5 text-[#64748b] transition hover:bg-[#f0fdfa] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(expense.id)}
          title="Delete transaction"
          aria-label={`Delete ${expense.desc}`}
          className="rounded-lg p-1.5 text-[#64748b] transition hover:bg-[#fff1f2] hover:text-[#be123c]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  const settlementRepayments = settlementExpense ? repaymentsForExpense(settlementExpense, expenses) : [];
  const remainingRepayments = settlementRepayments.filter((entry) => !entry.paid);
  const selectedRemainingCount = selectedRepayments.filter((index) => remainingRepayments.some((entry) => entry.index === index)).length;

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
                {filteredExpenses.map((expense) => {
                  const settled = isExpenseSettled(expense);
                  return (
                  <tr
                    key={expense.id}
                    className={`align-top transition ${expense.isSettlement ? 'bg-[#eef6f9] hover:bg-[#e4f0f5]' : settled ? 'bg-[#f0fdf4] text-[#64748b] hover:bg-[#ecfdf5]' : 'bg-white hover:bg-[#faf9f6]'} ${editingExpenseId === expense.id ? 'ring-1 ring-inset ring-[#0f766e]' : ''}`}
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 text-[#64748b]">{formatDate(expense.datetime) || '—'}</td>
                    <td className="max-w-[180px] px-3 py-2.5">
                      <div className={`break-words font-semibold ${settled ? 'text-[#64748b]' : 'text-[#0f172a]'}`}>{expense.desc}</div>
                    </td>
                    <td className="max-w-[150px] px-3 py-2.5">
                      <div className="flex flex-nowrap gap-1">
                        {getPayers(expense).map((payer, index) => <MemberTag key={`${payer.member}-${index}`} name={payer.member} colors={colors} small />)}
                      </div>
                    </td>
                    <td className="max-w-[170px] px-3 py-2.5">
                      <div className="flex flex-nowrap gap-1">
                        {renderSplitMembers(expense)}
                      </div>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums ${settled ? 'text-[#64748b]' : 'text-[#0f172a]'}`}>{formatAmount(expense.amount)}</td>
                    <td className="px-2 py-2"><div className="flex justify-end">{actionsFor(expense)}</div></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="transaction-mobile-list divide-y divide-[#e2e8f0] md:hidden">
            {filteredExpenses.map((expense) => {
              const settled = isExpenseSettled(expense);
              return (
              <article key={expense.id} className={`px-3 py-2.5 ${expense.isSettlement ? 'bg-[#eef6f9]' : settled ? 'bg-[#f0fdf4] text-[#64748b]' : 'bg-white'} ${editingExpenseId === expense.id ? 'ring-1 ring-inset ring-[#0f766e]' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-5">{expense.desc}</p>
                    <p className="mt-0.5 text-[11px] text-[#64748b]">{formatDate(expense.datetime) || '—'}</p>
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
                    <button
                      type="button"
                      onClick={() => setViewingExpenseId(expense.id)}
                      aria-label="View details"
                      title="View details"
                      className="rounded-md p-1.5 text-[#475569] transition hover:bg-[#e2e8f0] hover:text-[#0f766e] md:hidden"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {actionsFor(expense)}
                  </div>
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

      {settlementExpense && (
        <ModalFrame
          titleId="expense-payment-title"
          title="Record transaction payments"
          onClose={() => setSettlementExpenseId(null)}
          closeDisabled={settlingKey !== null}
          closeLabel="Close payment checklist"
          panelClassName="sm:max-w-lg"
        >
          <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto">
            {settlementRepayments.map((entry) => (
              <label
                key={entry.index}
                className={`flex items-center gap-3 rounded-lg border p-3 ${entry.paid ? 'border-[#bbf7d0] bg-[#f0fdf4]' : 'border-[#e2e8f0] bg-white'}`}
              >
                <input
                  type="checkbox"
                  checked={entry.paid || selectedRepayments.includes(entry.index)}
                  disabled={entry.paid || settlingKey !== null}
                  onChange={(event) => setSelectedRepayments((current) => (
                    event.target.checked ? [...current, entry.index] : current.filter((index) => index !== entry.index)
                  ))}
                  className="h-4 w-4 shrink-0 accent-[#0f766e]"
                />
                <span className="min-w-0 flex-1 text-sm text-[#334155]">
                  <strong>{entry.from}</strong> pays <strong>{entry.to}</strong>
                  {entry.paid && <span className="ml-2 text-xs font-semibold text-[#15803d]">Recorded</span>}
                </span>
                <strong className="shrink-0 text-sm text-[#0f172a]">{formatAmount(entry.amount)}</strong>
              </label>
            ))}
          </div>
          {!remainingRepayments.length && <p className="mt-3 text-sm font-medium text-[#15803d]">All repayments for this expense have been recorded.</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={settlingKey !== null} onClick={() => setSettlementExpenseId(null)} className={secondaryButton}>Close</button>
            {remainingRepayments.length > 0 && (
              <button type="button" onClick={recordSelectedPayments} disabled={settlingKey !== null || !selectedRemainingCount} className={primaryButton}>
                {settlingKey !== null ? 'Saving…' : `Record ${selectedRemainingCount} payment(s)`}
              </button>
            )}
          </div>
        </ModalFrame>
      )}
    </section>
  );
}
