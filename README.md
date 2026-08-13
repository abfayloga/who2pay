# When2Split
A minimal, real-time expense-splitting web application built with React and Supabase. Create an expense room, distribute the generated link to group members, and track shared balances across devices instantly with zero registration required.

## Features
* No Sign-Ups Needed: Create or join group ledgers immediately via a unique room link.
* Real-Time Synchronization: Updates sync instantly across all open browser sessions using Supabase Realtime.
* Flexible Expense Entry: Supports single or multi-payer contributions with customized split participant selection.
* Automated Settlement Engine: Calculates optimal payment routes to clear balances with minimal transactions.
* Search & Filters: Filter transactions by participant, entry type, keyword, or date range.

## Tech Stack
* Frontend Framework: React + Vite
* Routing: React Router DOM
* Styling: Tailwind CSS
* Backend / Database: Supabase (PostgreSQL + Realtime Subscriptions)
