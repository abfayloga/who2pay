# Who2Pay

A minimal, real-time expense tracking and splitting web application built with React and Supabase. Create a room, share its unique link with group members, and manage shared expenses, individual balances, and settlements across devices without requiring registration.

Who2Pay simplifies group expense management for trips, dining, shared accommodations, and everyday group spending.

## Features

### Room Management
- **No Registration Required:** Create or join expense rooms instantly using a unique shareable link.
- **Real-Time Synchronization:** Keep expenses, settlements, and room details synchronized across devices through Supabase Realtime.
- **Member Management:** Add or remove members and assign customizable colors for easier identification.
- **Multi-Currency Support:** Choose a room currency, with Philippine Peso (PHP) as the default.

### Flexible Expense Splitting
- **Single or Multiple Payers:** Record expenses paid by one person or multiple contributors.
- **Equal Split:** Divide an expense equally among selected participants.
- **Custom Split:** Assign individual amounts to members for expenses with unequal contributions.
- **Itemized Split:** Add individual orders, shared items, and additional charges, then allocate them to specific members.
- **Split Remaining Equally:** Automatically distribute unassigned amounts among selected participants.
- **Mathematical Expressions:** Enter calculations directly into amount fields using standard arithmetic operators.
- **Automatic Validation:** Verify that allocated shares match the total expense before saving.

### Balances and Settlements
- **Automated Settlement Engine:** Calculate optimized repayments to minimize the number of transactions needed to settle balances.
- **Personalized Settlement Summary:** View amounts to pay and receive, including suggested transfers.
- **Individual Expense Summary:** Monitor each member's allocated share of group expenses.
- **Transaction-Level Settlements:** Record repayments associated with specific expenses.
- **Partial Settlements:** Select which members have completed their payments using a settlement checklist.
- **Settlement Tracking:** Log completed repayments as settlement transactions.
- **Member-to-Member Settlements:** Allow members to record completed payments on behalf of others.

### Transaction Management
- **Transaction History:** View, edit, delete, and filter recorded expenses and settlements.
- **Search and Filters:** Filter transactions by member, type, description, or date range.
- **Transaction Categories:** Visually distinguish expenses from settlement records.
- **Bulk Import:** Import transactions from Google Sheets, CSV, or Markdown-formatted tables.
- **CSV and PDF Export:** Generate transaction reports for external records and sharing.

### User Interface
- **Responsive Design:** Optimized layouts for desktop and mobile devices.
- **Compact Transaction Cards:** Access common transaction actions without excessive scrolling.
- **Modern Flat UI:** Minimal design with subtle borders, consistent spacing, and accessible controls.
- **Color-Coded Members:** Easily identify participants throughout transactions, balances, and settlement records.

## Tech Stack

| Technology | Purpose |
|---|---|
| React | Frontend framework |
| Vite | Development server and build tool |
| React Router DOM | Client-side routing |
| Tailwind CSS | Responsive UI styling |
| Lucide React | Icons |
| Supabase | Backend services and database |
| PostgreSQL | Persistent room and transaction storage |
| Supabase Realtime | Live database updates across sessions |

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project

### Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Ensure that your Supabase database is configured with the required `rooms` table, JSONB expense storage, and appropriate access policies.

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in your terminal.

## How It Works

1. **Create a Room:** Enter a group name to generate a unique expense room.
2. **Invite Members:** Share the room URL so others can access the same ledger.
3. **Add Expenses:** Record the payer, amount, participants, and preferred splitting method.
4. **Track Balances:** Who2Pay calculates how much each member has paid, owes, or should receive.
5. **Record Settlements:** Follow suggested payments or settle specific expenses, including partial repayments.
6. **Export Records:** Download transaction records as CSV or PDF.

All changes are stored in Supabase and synchronized across connected sessions.

## Important Notes

- Changing the room currency changes how amounts are displayed and interpreted; it does not automatically convert previously recorded amounts using exchange rates.
- Recording a settlement updates the expense ledger but does not initiate an actual money transfer.
- Transaction-level repayments and overall balance settlements should not be recorded twice for the same payment.
- The standard four-column CSV/PDF export format does not preserve detailed custom or itemized share allocations when re-imported.

## Deployment

Who2Pay can be deployed using Vercel.

Configure the required Supabase environment variables in your Vercel project settings, then deploy the application.

**Live Application:** https://who2pay.vercel.app/

## Author

Achilles Fayloga

## License

No license has been specified.