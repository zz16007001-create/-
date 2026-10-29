# Reviewed Files and Purpose

This document explains the structure and the purpose of the files reviewed during the audit of the project "محلي".

## 1) Application shell and routing
### `App.tsx`
Purpose:
- Defines the root router and route tree for the app.
- Wraps the app in an `ErrorBoundary` to prevent a fatal white screen.

Key role:
- Controls the client-side navigation structure.
- Ensures no unhandled rendering failure crashes the full app.

Why it matters:
- For a real POS app, a crash during sales or billing is unacceptable.
- The error boundary is a valuable protection layer.

### `AppShell.tsx`
Purpose:
- Provides shared layout: header, sidebar, mobile nav, and auth protection.
- Holds the login guard and sign-out logic.

Key role:
- All protected routes are wrapped here.
- It triggers `migrateWalletKeys()` once the user is authenticated.

Why it matters:
- Good for user flow and protected navigation.
- It also shows the app is designed with offline data and migration awareness.

## 2) Authentication and user access
### `auth.ts`
Purpose:
- Provides Firebase sign-in, sign-out, and auth state observation.
- Converts Firebase error codes into Arabic messages.

Key role:
- Controls the login gate of the system.

Why it matters:
- Good UX for Arabic-speaking users.
- Important for secure user access, but not enough alone for financial controls.

### `LoginPage.tsx`
Purpose:
- Login form UI.

Key role:
- Entry point for sale system access.

## 3) Financial math and core logic
### `money.ts`
Purpose:
- Currency rounding, Arabic number parsing, and phone normalization.

Key functions:
- `round2()`
- `formatCurrency()`
- `parseArabicNumber()`
- `normalizePhone()`

Why it matters:
- This is the foundation of all financial calculations.
- Good rounding is essential for accurate sales and returns.

### `invoice.ts`
Purpose:
- Calculates invoice totals, discounts, tax, return values, and line-level allocation.

Key functions:
- `calculateInvoiceTotals()`
- `distributeDiscount()`
- `allocateInvoiceLines()`
- `calculateLineReturn()`
- `calculateReturn()`

Why it matters:
- This is the main logic for sales and returns.
- If logic is wrong, the business can lose real money.

### `payment.ts`
Purpose:
- Allocates collections and bad debt by invoice age.

Key functions:
- `distributeCollection()`
- `distributeBadDebt()`

Why it matters:
- It applies a sound “oldest debt first” policy.
- It is useful for debt management but depends on accurate current debt values.

### `profit.ts`
Purpose:
- Calculates invoice profit, real profit, and mismatch.

Key functions:
- `calculateInvoiceProfit()`
- `calculateRealProfit()`
- `calculateMismatch()`
- `shouldWarnMismatch()`

Why it matters:
- Useful for period-end review.
- But profit is only as reliable as the underlying stock and sales entries.

## 4) Inventory and stock logic
### `stock.ts`
Purpose:
- Re calculates stock and wallet balances from transactions.

Key functions:
- `calculateStockAdjustment()`
- `recalculateItemQty()`
- `recalculateWallets()`

Why it matters:
- It is a central audit utility for inventory and wallet balance checks.
- It helps reveal imbalances, but by itself it is not a full prevention mechanism.

### `useItems.ts`
Purpose:
- Reads live items from Firestore and provides item list state for UI.

Why it matters:
- This is where the app obtains current inventory data.
- Item state feeds cashier flow, inventory screens, and item editing.

## 5) Product coding and variants
### `codes.ts`
Purpose:
- Generates unique product codes for shoes, bags, and accessories.

Key functions:
- `getDevicePrefix()`
- `makeCode()`

Why it matters:
- Good for item tracking.
- It helps maintain unique codes across products.

### `types.ts`
Purpose:
- Defines the core domain entities: Item, Invoice, Customer, Purchase, Return, Transaction, Snapshot.

Why it matters:
- This is the business model used across the entire app.
- These types define the financial structure of the system.

## 6) Data persistence and business transactions
### `data.ts`
Purpose:
- This is the most important file in the system.
- It contains the main business functions for purchases, invoices, returns, debt collection, and backups.

Key functions:
- `createPurchase()`
- `updateItemDetails()`
- `archiveItem()`
- `adjustStock()`
- `createInvoice()`
- `createReturn()`
- `cancelInvoice()`
- `collectPayment()`
- `writeOffDebt()`
- `createTransaction()`
- `closeMonthSnapshot()`
- `exportBackup()`
- `importBackup()`
- `createOpening()`
- `hasOperationalActivity()`

Why it matters:
- This file contains the actual operational logic for real business events.
- This is where most accounting and stock-risk issues are concentrated.
- It is the file to audit first in a production environment.

### `firebase.ts`
Purpose:
- Initializes the Firebase app, Firestore, and authentication.
- Enables offline persistence.

Why it matters:
- This is essential for offline-first POS behavior.
- It is a strength, but it creates concurrency considerations if the app is used on multiple devices.

## 7) Offline and sync support
### `pending.ts`
Purpose:
- Tracks pending writes that have not yet completed.

Key functions:
- `getPendingCount()`
- `subscribePending()`
- `trackPending()`

Why it matters:
- Good for showing that the system is trying to handle offline queues.
- This helps the user understand whether work is still pending upload.

### `SyncIndicator.tsx`
Purpose:
- Visual indicator for online/offline state and pending queue count.

Why it matters:
- Useful operational UI.
- It gives the user visibility into connectivity and sync state.

## 8) Core entry pages and business flows
### `CashierPage.tsx`
Purpose:
- POS selling flow and cart management.

Why it matters:
- This is the central operational page of the app.
- It is at the center of sales, stock reduction, and payment logic.

### `AddPurchasePage.tsx`
Purpose:
- Add new purchase entries.

Why it matters:
- It creates inventory items and purchase records.
- It affects item creation and cost price.

### `ItemDetailPage.tsx`
Purpose:
- Shows item detail and allows edits, stock adjust, archive, and cost fix.

Why it matters:
- This is the management page for real inventory health.

### `InvoiceDetailPage.tsx`
Purpose:
- Shows invoice details and allows return or cancel procedures.

Why it matters:
- This is a finance-sensitive UI because it changes returns, debt, and cash movements.

### `CustomersListPage.tsx` and `CustomerDetailPage.tsx`
Purpose:
- Manage customers, their balances, collection, and debt write-off.

Why it matters:
- Customer debt is a major accounting risk if not reconciled properly.

### `TransactionsPage.tsx`
Purpose:
- Lists and manages financial transactions.

Why it matters:
- Transaction history is a key audit trail for the whole business.

### `ReportsPage.tsx`
Purpose:
- Shows reporting metrics and system outputs.

Why it matters:
- Good for transparency, but reports are only as good as the underlying data quality.

### `SnapshotPage.tsx`
Purpose:
- Implements month-end or period-end snapshot/closing logic.

Why it matters:
- This is important for month-end accounting and profitability review.

### `SettingsPage.tsx`
Purpose:
- Manages store settings, wallet definitions, colors, tax, and general configuration.

Why it matters:
- Settings define business rules such as default wallets, tax, and color codes.

### `BackupPage.tsx`
Purpose:
- Exports or imports system backup.

Why it matters:
- Backup and restore are crucial for business continuity.
- The system appears to be designed to handle that safely.

## 9) Helper UI components
### `Button.tsx`, `Input.tsx`, `Card.tsx`, `Modal.tsx`, `Spinner.tsx`, `BarcodeSVG.tsx`, `LabelPrintModal.tsx`, `PlaceholderPage.tsx`
Purpose:
- Reusable UI elements for the app.

Why it matters:
- These support the user experience and POS workflow.
- They help with product scanning, printing, and page structure.

## 10) Domain and business metadata
### `settings.ts`
Purpose:
- Default configuration values and wallet definitions.

Why it matters:
- This is the store configuration layer.
- It defines tax, default wallets, low-stock threshold, and default region language.

### `arabic.ts`
Purpose:
- Arabic string normalization for search and comparison.

Why it matters:
- Important for matching Arabic inputs, names, and patterns.

### `capital.ts`
Purpose:
- Capital and equity calculations.

Why it matters:
- Useful for the monthly financial model and capital evaluation.

### `validation.ts`
Purpose:
- Validates purchase, invoice, and return data.

Why it matters:
- This is the front line of business-rule validation.

### `pending.ts`
Purpose:
- Queue counter for pending operations.

## 11) How the system works overall
The app is built around these layers:
1. UI layer: routes, pages, forms, modals
2. Domain logic layer: money, invoice, stock, payment, profit
3. Persistence layer: Firestore + Firebase + offline cache
4. Business operation layer: createInvoice, createReturn, createPurchase, collectPayment
5. Reporting and snapshot layer: ReportsPage, SnapshotPage, closeMonthSnapshot

In other words, the system tries to model a real retail business using:
- Items/stock
- Sales/invoices
- Purchases
- Customer debt
- Wallet/cash balances
- Returns/cancellations
- Monthly closing and reports

## 12) Reading guidance for future AI systems
If an AI tool needs to understand this program, the primary files to read in order are:
1. `data.ts`
2. `invoice.ts`
3. `stock.ts`
4. `money.ts`
5. `payment.ts`
6. `profit.ts`
7. `firebase.ts`
8. `types.ts`
9. `codes.ts`
10. `App.tsx` and `AppShell.tsx`

These files represent the core of the business logic and the real operational flow.

---

# Summary
This review package is intended to help any future AI or developer understand:
- what the system does,
- why the files matter,
- how the business flows are connected,
- and which parts are sensitive from a financial and operational perspective.

The app is not just a UI; it is a POS + inventory + accounting workflow and therefore its financial integrity depends on the correctness of the data layer and the consistency of combined document updates.
