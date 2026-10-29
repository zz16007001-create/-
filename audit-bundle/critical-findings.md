# Critical Findings

This document summarizes the financial and operational audit findings for the project "محلي".

## Executive Summary
The system is a retail POS and inventory management app intended for a footwear, bags, and accessories store. The codebase is structurally organized and demonstrates strong UX-oriented thinking, but it still contains critical operational and accounting risks if used in a live store environment without additional controls.

## Priority 1 — Prevent negative inventory before sale
- File(s): `data.ts`, `stock.ts`, `useItems.ts`
- Issue: The system reduces `currentStock` on invoice creation, but there is no consistent guard preventing sale when stock is already insufficient.
- Impact: Real stock losses, false sales, inaccurate inventory valuation.
- Scenario: Two sessions open the same item before stock sync, both read the same count, both sell and decrement.
- Recommended fix: validate each item before save; reject if quantity > currentStock; add server-side or atomic validation.
- Materiality for your scale: High. Even with 20–30 invoices/day, the stock loss is financially material.

## Priority 1 — Multi-device / offline sync conflict risk
- File(s): `firebase.ts`, `data.ts`, `AppShell.tsx`, `useItems.ts`
- Issue: Offline-first Firebase caches are useful, but there is no strong conflict detection or atomic reservation logic for inventory and sales.
- Impact: Duplicate invoice numbers, double sales, mismatched balances.
- Recommended fix: server-side write checks, invoice number reservation, stock version validation, synchronization retry queue.
- Materiality: Low to medium for single-device use; high if used on more than one device.

## Priority 1 — Inconsistent accounting state across invoice, customer, and wallet
- File(s): `data.ts`, `payment.ts`, `profit.ts`, `stock.ts`
- Issue: Some values are derived from documents while others are stored directly; the system updates several sources in separate steps.
- Impact: Customer balance, wallet totals, and invoice values may drift apart.
- Recommended fix: ledger-style updates or reconciled single source of truth.
- Materiality: Medium-high for a small store, but critical if the system is used for real cash flow.

## Priority 2 — Return and cancel flows are complex and sensitive
- File(s): `data.ts`, `invoice.ts`, `payment.ts`
- Issue: createReturn and cancelInvoice update stock, customer balance, invoice debt, and wallet totals in multiple steps.
- Impact: Double refunds or wrong debt reduction if any step fails.
- Recommended fix: validate before execution; lock invoice after refund; ensure single consistent state.
- Materiality: Medium, because the chance is lower than negative stock but still real.

## Priority 2 — Profit mismatch risk
- File(s): `profit.ts`, `data.ts`, `stock.ts`, `CHANGES.md`
- Issue: Real profit is derived from many values, and any mismatch in stock or wallet movement creates a misleading monthly profit.
- Impact: Wrong financial reporting.
- Recommended fix: monthly reconciliation report and lock daily/monthly totals.
- Materiality: Medium for your scale.

## Priority 3 — Variant identity and stock item uniqueness
- File(s): `codes.ts`, `useItems.ts`, `data.ts`
- Issue: Each variant is treated as a standalone item, which is acceptable for small shops but not ideal for product master + variant architecture.
- Impact: Harder inventory auditing and deduplication.
- Recommended fix: add product and variant IDs, enforce unique variant code.
- Materiality: Low to medium.

## Priority 3 — UI values can look correct while underlying ledger is off
- File(s): `DashboardPage.tsx`, `ReportsPage.tsx`, `AppShell.tsx`, `data.ts`
- Issue: The interface shows current values, but those values are not the sole source of truth.
- Impact: Misleading business decisions.
- Recommended fix: add a reconciliation view and a daily closing check.
- Materiality: Medium.

## Positive findings
- `money.ts` has good rounding (`round2`) and Arabic number parsing.
- `invoice.ts` has mathematically coherent sales and return logic.
- `payment.ts` uses oldest-debt-first allocation.
- `createPurchase` in `data.ts` writes a purchase and item records in a single batch, which is a good pattern.
- `App.tsx` has an error boundary; `AppShell.tsx` guards auth.
- `firebase.ts` supports offline-first operation.

## Recommended operational rules before going live
1. Block any sale if item quantity is not enough.
2. Reconcile stock at end of each day.
3. Do not allow edits to a closed invoice.
4. Keep a daily movement log: sales, returns, payments, expenses.
5. Use reconciled cash and stock totals each month.
6. If multiple devices are used, enforce a server-side lock or conflict detection.

## Low priority / mostly excluded for your current scale
- Massive concurrent multi-branch conflict
- Very large dataset performance bottlenecks
- Complicated ERP-grade ledger with full auditing across all departments

These are not necessarily absent, but they are less relevant at your current activity level.

---

# Audit Philosophy
This review is not just UI review. It is a business-process and accounting review.
The system is judged from the perspective of real cash movement, real stock movement, and the risk of financial mistakes in a retail store.

The central theme is: if the app is used in a real shop, it must ensure that every sale, return, debt collection, stock movement, and wallet update are consistent. Otherwise the numbers become unreliable.

---

# File-level risk summary
- `data.ts` — core risk area, maximum business impact
- `invoice.ts` — important financial logic, but must be verified against live data
- `stock.ts` — important for inventory balancing, but not sufficient as a solo guard
- `payment.ts` — correct allocation logic, but still needs ledger reconciliation
- `profit.ts` — useful for reporting, needs month-end validation
- `firebase.ts` — good offline choice, but must be paired with conflict control
- `useItems.ts` — data listener logic, important for real-time item loading
- `codes.ts` — good naming standard but should be paired with variant-level uniqueness
- `App.tsx` and `AppShell.tsx` — UI safety and auth, good but not enough for business logic


