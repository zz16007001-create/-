/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './features/auth/LoginPage';
import { AppShell } from './components/layout/AppShell';
import { PlaceholderPage } from './components/layout/PlaceholderPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ItemsListPage } from './features/items/ItemsListPage';
import { ItemDetailPage } from './features/items/ItemDetailPage';
import { AddPurchasePage } from './features/purchase/AddPurchasePage';
import { CashierPage } from './features/cashier/CashierPage';
import { InvoicesListPage } from './features/invoices/InvoicesListPage';
import { InvoiceDetailPage } from './features/invoices/InvoiceDetailPage';
import { CustomersListPage } from './features/customers/CustomersListPage';
import { CustomerDetailPage } from './features/customers/CustomerDetailPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { SnapshotPage } from './features/snapshot/SnapshotPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { BackupPage } from './features/settings/BackupPage';

/** يمنع الشاشة البيضاء: أي خطأ غير متوقع تظهر له رسالة بدل انهيار التطبيق. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('UI error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" className="p-8 text-center space-y-3">
          <p className="text-lg font-bold text-slate-900">حدث خطأ غير متوقع</p>
          <p className="text-sm text-slate-600">بياناتك محفوظة. اضغط لإعادة تحميل الصفحة.</p>
          <button className="px-4 py-2 rounded-xl bg-[#14b8a6] text-white" onClick={() => window.location.reload()}>
            إعادة التحميل
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected App Routes wrapped in AppShell */}
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="cashier" element={<CashierPage />} />
          <Route path="items" element={<ItemsListPage />} />
          <Route path="items/:id" element={<ItemDetailPage />} />
          <Route path="purchase" element={<AddPurchasePage />} />
          <Route path="invoices" element={<InvoicesListPage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="customers" element={<CustomersListPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="snapshot" element={<SnapshotPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="backup" element={<BackupPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
    </ErrorBoundary>
  );
}
