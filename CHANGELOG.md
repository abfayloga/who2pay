# Changelog

All notable changes to **Who2Pay** are documented here.

Changes below describe the source-code updates prepared for this project. They are not presented as published releases, and earlier changes are not assigned version numbers or dates because no release tags were provided.

## [Unreleased] — 2026-10-14 — Near-black dark mode

### Added
- Light, Dark, and System appearance modes on the Home and Room pages.
- Detection of the device's preferred color scheme, including changes while the app is open.
- Browser-local appearance preference persistence.
- Shared `useTheme` hook and `theme.css` for consistent styling.

### Changed
- Introduced a near-black, flat palette with charcoal cards, subtle borders, and legible text, without gradients.
- Adapted transaction rows, member tags, forms, and native date/time controls for dark mode.
- Retained the existing light appearance; System is the default mode.

### Notes
- Theme preferences are stored per browser/device and are not synchronized through Supabase.
- Verify contrast for custom member colors and native controls on mobile browsers after deployment.

## Earlier changes — Expense entry and splitting

### Added
- Support for one payer or several contributors to the same expense.
- Selection of which room members participate in each expense.
- Three split methods: **Equal**, **Custom Amounts**, and **Itemized Orders**.
- Per-member custom shares for unequal spending and a **Split remaining equally** shortcut.
- Itemized orders assigned to individual members or shared among multiple members, with automatic share calculation.
- Ability to derive the transaction amount from itemized orders.
- Mathematical expression entry using addition, subtraction, multiplication, division, and parentheses; results are validated and stored as numeric amounts.
- Automatic validation of allocated shares against the expense total.

### Changed
- Updated share and balance calculations to recognize per-member allocations, rather than always dividing expenses equally.
- Preserved equal splitting for legacy transactions without custom share data.
- Added an individual expense-share breakdown to the total group expenses summary.

## Earlier changes — Balances and repayments

### Added
- Suggested debt-minimizing repayments for group balances, including multi-payer expenses.
- Personalized **To pay** and **To receive** summaries within a single pending-settlements card.
- Direct **Settle** / **Received** actions alongside suggested payments and within the Balances section.
- Ability for a room member to record repayments between two other members, with confirmation.
- Transaction-specific settlement actions that create repayment entries linked to the originating expense.
- A per-transaction repayment checklist to record only members who have actually paid.
- Progress tracking for transaction-specific repayments; previously recorded entries appear checked and unavailable for duplicate selection.
- Settlement records in the transaction history, separate from ordinary expenses.

### Changed
- Consolidated transaction-specific repayment calculations into the existing `settlement.js` utility.
- Updated repayment calculations to account for custom and itemized shares where supplied.
- Kept balance-settlement actions available while adding expense-specific actions.

### Notes
- Recording a settlement changes the ledger; it does **not** transfer money.
- Overall balance settlements are not automatically matched to specific expenses; avoid recording the same real-world payment through both flows.

## Earlier changes — Transaction history, import, and export

### Added
- Transaction search and filters for member, transaction type, and date range.
- **Expenses only** as the default transaction filter, with options for all records or settlements only.
- A compact filter icon that expands additional filtering controls.
- Bulk table import with review and validation, accepting Google Sheets tab-separated pastes, CSV, and Markdown tables.
- Four-column import/export layout: **Description**, **Amount**, **Paid By**, **Split Between**.
- CSV downloads and printable PDF reports of transaction records.
- A generic example in the import guide, independent of any specific trip or group.
- Transaction edit and delete controls.

### Changed
- Distinguished ordinary expenses from settlement entries using row color instead of a settlement tag.
- Made transaction rows denser on mobile and aligned View, Settle, Edit, and Delete actions with the payer information.
- Added an optional compact split-details view on mobile for viewing payer contributions and member allocations.
- Refined native date and time inputs for smaller screens.

### Notes
- Exporting and re-importing through the four-column format does not preserve item-by-item allocations or custom split shares; the imported rows use their supported default allocation behavior.
- Re-importing the same rows can create duplicate expenses.

## Earlier changes — Rooms, members, and currency

### Added
- Room-specific currency selection, with **Philippine Peso (PHP)** as the default.
- Member color customization with a selection of distinguishable preset colors and a Custom option at the end.
- Supabase persistence for `member_colors` and room `currency`, with matching client-side property mapping.
- Real-time room updates through Supabase subscriptions.

### Changed
- Applied the selected currency to expense, balance, settlement, and export displays.
- Corrected the missing member-color field in `saveRoomData()` so color choices are included in Supabase saves.
- Kept the member list below Balances in the right-side column.

### Notes
- Changing the selected currency does not perform exchange-rate conversion; existing numeric amounts keep their values.
- The `member_colors` JSONB and `currency` columns must exist when using the corresponding Supabase-backed features.

## Earlier changes — Interface and usability

### Changed
- Replaced mismatched page styling with a consistent, flat layout and restrained color palette without gradients.
- Highlighted only two main room summaries: total group expenses and the viewer's pending settlements.
- Kept payer and participant information recognizable through member colors.
- Narrowed the desktop sidebar to give more space to transaction entry and history.
- Reduced mobile card padding, spacing, and action clutter.
- Improved the layout of transaction details and native input fields on small screens.

---

**Compatibility:** Earlier equal-split expense and settlement records remain supported by the updated calculation utilities. Test Supabase persistence and real-time behavior in the deployed app before treating these source updates as a production release.
