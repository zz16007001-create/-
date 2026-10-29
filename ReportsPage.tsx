import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getCairoDate, getMonthKey, formatMonth, formatDate } from '../../domain/dates';
import { formatCurrency, round2 } from '../../domain/money';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import {
  BarChart3,
  Calendar,
  DollarSign,
  TrendingDown,
  Clock,
  Boxes,
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  ArrowUpRight,
  Archive,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const currentMonth = getMonthKey(getCairoDate());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [activeTab, setActiveTab] = useState<'sales' | 'expenses' | 'stagnant' | 'closings'>('sales');
  const [snapshotsList, setSnapshotsList] = useState<any[]>([]);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let readyCount = 0;
    const checkReady = () => {
      readyCount++;
      if (readyCount >= 5) setLoading(false);
    };

    // 1. الفواتير
    const unsubInvoices = onSnapshot(
      collection(db, 'invoices'),
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setInvoices(docs);
        checkReady();
      },
      () => checkReady()
    );

    // 2. الحركات المالية
    const unsubTx = onSnapshot(
      collection(db, 'transactions'),
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => {
          const x = d.data();
          if (x.status !== 'reversed') docs.push({ id: d.id, ...x });
        });
        docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTransactions(docs);
        checkReady();
      },
      () => checkReady()
    );

    // 3. الأصناف
    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        setItems(docs);
        checkReady();
      },
      () => checkReady()
    );

    // 4. المرتجعات (تُخصم من صافي المبيعات)
    const unsubReturns = onSnapshot(
      collection(db, 'returns'),
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => {
          const r = d.data();
          if (r.type === 'return') docs.push({ id: d.id, ...r });
        });
        setReturnsList(docs);
        checkReady();
      },
      () => checkReady()
    );

    // 5. الشهور المقفولة (لقطات القفل)
    const unsubSnaps = onSnapshot(
      collection(db, 'snapshots'),
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => {
          const x = d.data();
          if (x.type === 'monthly_closing') docs.push({ id: d.id, ...x });
        });
        docs.sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)));
        setSnapshotsList(docs);
        checkReady();
      },
      () => checkReady()
    );

    return () => {
      unsubSnaps();
      unsubInvoices();
      unsubTx();
      unsubItems();
      unsubReturns();
    };
  }, []);

  // قائمة الأشهر المتاحة للاختيار (الشهر الحالي والأشهر السابقة المسجلة)
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonth);

    invoices.forEach((inv) => {
      if (inv.monthKey) monthsSet.add(inv.monthKey);
    });
    transactions.forEach((tx) => {
      if (tx.monthKey) monthsSet.add(tx.monthKey);
    });

    return Array.from(monthsSet).sort().reverse();
  }, [invoices, transactions, currentMonth]);

  // فواتير الشهر المختار (النشطة فقط)
  const monthInvoices = useMemo(() => {
    return invoices.filter(
      (inv) => inv.monthKey === selectedMonth && inv.status !== 'cancelled'
    );
  }, [invoices, selectedMonth]);

  // إجمالي مبيعات الشهر وعدد الفواتير
  const totalSales = useMemo(() => {
    const gross = monthInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    const returned = returnsList
      .filter((r) => r.monthKey === selectedMonth)
      .reduce((sum, r) => sum + (Number(r.totalRefund) || 0), 0);
    return round2(gross - returned); // صافي المبيعات بعد المرتجعات
  }, [monthInvoices, returnsList, selectedMonth]);

  // ربح الشهر: الرقم المعتمد من لقطة القفل إن وُجدت، وإلا تقدير تقريبي
  const monthProfit = useMemo(() => {
    const snap = snapshotsList.find((x) => x.monthKey === selectedMonth);
    if (snap) {
      return { value: Number(snap.invoiceProfit) || 0, exact: true };
    }
    const cogs = monthInvoices.reduce(
      (sum, inv) =>
        sum +
        (inv.items || []).reduce(
          (s2: number, l: any) =>
            s2 + (Number(l.costPrice) || 0) * Math.max(0, (Number(l.quantity) || 0) - (Number(l.returnedQty) || 0)),
          0
        ),
      0
    );
    const exp = transactions
      .filter((tx) => tx.monthKey === selectedMonth && tx.type === 'expense')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    return { value: round2(totalSales - cogs - exp), exact: false };
  }, [snapshotsList, selectedMonth, monthInvoices, transactions, totalSales]);

  // مصروفات الشهر المختار مقسمة حسب التصنيف
  const monthExpensesList = useMemo(() => {
    return transactions.filter(
      (tx) => tx.monthKey === selectedMonth && tx.type === 'expense'
    );
  }, [transactions, selectedMonth]);

  const totalExpenses = useMemo(() => {
    return round2(monthExpensesList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0));
  }, [monthExpensesList]);

  const expensesByCategory = useMemo(() => {
    const categoryMap: Record<string, number> = {};
    monthExpensesList.forEach((tx) => {
      const cat = tx.category || 'أخرى';
      categoryMap[cat] = round2((categoryMap[cat] || 0) + (Number(tx.amount) || 0));
    });

    return Object.entries(categoryMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpenses > 0 ? round2((amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthExpensesList, totalExpenses]);

  // تقرير الأصناف الراكدة: لم تُبع منذ 90 يوماً أو أكثر
  const stagnantItems = useMemo(() => {
    const now = Date.now();
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

    // خريطة لتاريخ آخر عملية بيع لكل صنف
    const lastSoldMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.status !== 'cancelled') {
        const invDate = inv.createdAt || (inv.dateIso ? new Date(inv.dateIso).getTime() : 0);
        (inv.items || []).forEach((line: any) => {
          if (line.itemId) {
            const prev = lastSoldMap[line.itemId] || 0;
            if (invDate > prev) {
              lastSoldMap[line.itemId] = invDate;
            }
          }
        });
      }
    });

    return items
      .filter((it) => it.isActive !== false && (it.currentStock ?? 0) > 0)
      .map((it) => {
        const lastSaleDate = lastSoldMap[it.id] || it.createdAt || 0;
        const diffMs = now - lastSaleDate;
        const daysWithoutSale = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        return {
          ...it,
          daysWithoutSale,
          lastActivityDate: lastSaleDate,
          neverSold: !lastSoldMap[it.id],
        };
      })
      .filter((it) => it.daysWithoutSale >= 90)
      .sort((a, b) => b.daysWithoutSale - a.daysWithoutSale);
  }, [items, invoices]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-4">جاري تجميع بيانات التقارير والإحصائيات...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* رأس الصفحة وفلتر اختيار الشهر */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#14b8a6]" />
            <span>التقارير المالية والتشغيلية</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            تحليل المبيعات، تفصيل المصروفات، ومراقبة البضاعة الراكدة
          </p>
        </div>

        {/* قائمة اختيار الشهر المالي */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">الشهر:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m} {m === currentMonth ? '(الحالي)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* تبويبات التقارير (Tabs) */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-4 text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'sales'
                ? 'border-[#14b8a6] text-[#0d9488]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>تقرير المبيعات ({monthInvoices.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('closings')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'closings'
                ? 'border-[#14b8a6] text-[#0d9488]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>الشهور المقفولة ({snapshotsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'expenses'
                ? 'border-[#14b8a6] text-[#0d9488]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>تقرير المصروفات ({monthExpensesList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stagnant')}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'stagnant'
                ? 'border-[#14b8a6] text-[#0d9488]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>الأصناف الراكدة (+90 يوم) ({stagnantItems.length})</span>
          </button>
        </div>
      </div>

      {/* 1. تقرير المبيعات */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-5 border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block mb-1">إجمالي مبيعات الشهر</span>
                <span className="text-2xl font-black text-[#14b8a6]">
                  {formatCurrency(totalSales)}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#14b8a6] flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
            </Card>

            <Card className="p-5 border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block mb-1">
                  {monthProfit.exact ? 'ربح الشهر (من القفل)' : 'ربح الشهر (تقريبي، قبل الديون المعدومة وتسويات الجرد)'}
                </span>
                <span className={`text-2xl font-black ${monthProfit.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(monthProfit.value)}
                </span>
              </div>
            </Card>

            <Card className="p-5 border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block mb-1">عدد الفواتير المنفذة</span>
                <span className="text-2xl font-black text-slate-800">{monthInvoices.length}</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Receipt className="w-6 h-6" />
              </div>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-800">سجل فواتير شهر ({selectedMonth})</h2>
            </div>

            {monthInvoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                لا توجد فواتير مبيعات مسجلة في هذا الشهر
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50/50 text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">رقم الفاتورة</th>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3">طريقة السداد</th>
                      <th className="p-3 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-xs font-bold text-slate-700">
                          {inv.invoiceNumber}
                        </td>
                        <td className="p-3 text-xs text-slate-500">
                          {formatDate(inv.createdAt, false)}
                        </td>
                        <td className="p-3 font-medium text-slate-800">
                          {inv.customerName || 'عميل نقدي'}
                        </td>
                        <td className="p-3 text-xs">
                          {(inv.remainingAmount || 0) > 0 ? (
                            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-bold">
                              آجل ({formatCurrency(inv.remainingAmount)})
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold">
                              مدفوع بالكامل
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-900 text-left">
                          {formatCurrency(inv.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 2. تقرير المصروفات */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <Card className="p-5 border-slate-200 flex items-center justify-between bg-rose-50/40 border-rose-200">
            <div>
              <span className="text-xs text-rose-700 block mb-1">إجمالي المصروفات لشهر ({selectedMonth})</span>
              <span className="text-2xl font-black text-rose-700">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <TrendingDown className="w-6 h-6" />
            </div>
          </Card>

          {/* تصنيف المصروفات */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 border-slate-200 space-y-3">
              <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                توزيع المصروفات حسب التصنيف
              </h2>

              {expensesByCategory.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">لا توجد مصروفات مسجلة</p>
              ) : (
                <div className="space-y-3">
                  {expensesByCategory.map((catItem) => (
                    <div key={catItem.category} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span>{catItem.category}</span>
                        <span>
                          {formatCurrency(catItem.amount)} ({catItem.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, catItem.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* تفاصيل المصروفات اليومية */}
            <Card className="p-0 overflow-hidden border-slate-200">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-800">بيان قيود المصروفات</h2>
              </div>
              {monthExpensesList.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">لا توجد بنود مصروفات</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {monthExpensesList.map((tx) => (
                    <div key={tx.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {tx.category || 'مصروف'}
                        </span>
                        {tx.description && (
                          <span className="text-slate-500">{tx.description}</span>
                        )}
                        <span className="text-slate-400 block mt-0.5">
                          {formatDate(tx.createdAt, false)}
                        </span>
                      </div>
                      <span className="font-bold text-rose-600">
                        -{formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* الشهور المقفولة */}
      {activeTab === 'closings' && (
        <Card className="border-slate-200 overflow-hidden">
          {snapshotsList.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">لا توجد شهور مقفولة بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm text-right">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="p-3">الشهر</th>
                    <th className="p-3">ربح الفواتير</th>
                    <th className="p-3">الربح الحقيقي</th>
                    <th className="p-3">رأس المال</th>
                    <th className="p-3">الفرق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {snapshotsList.map((sn) => (
                    <tr key={sn.id}>
                      <td className="p-3 font-bold">{sn.monthKey}</td>
                      <td className="p-3">{formatCurrency(Number(sn.invoiceProfit) || 0)}</td>
                      <td className="p-3">{formatCurrency(Number(sn.realProfit) || 0)}</td>
                      <td className="p-3">{formatCurrency(Number(sn.capital) || 0)}</td>
                      <td className="p-3">{formatCurrency(Number(sn.mismatch) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* 3. تقرير الأصناف الراكدة (+90 يوماً) */}
      {activeTab === 'stagnant' && (
        <div className="space-y-4">
          <Card className="p-4 border-amber-200 bg-amber-50/50 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="block font-bold mb-0.5">معيار الأصناف الراكدة:</strong>
              يتم احتساب البضاعة راكدة إذا مر 90 يوماً أو أكثر على آخر فاتورة بيع لها (أو على تاريخ
              إضافتها للمخزن إن لم تُبع قط) وما زال رصيدها أكبر من صفر في المخزن.
            </div>
          </Card>

          <Card className="p-0 overflow-hidden border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>قائمة الأصناف الراكدة ({stagnantItems.length} صنف)</span>
              </h2>
            </div>

            {stagnantItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-700">لا توجد بضائع راكدة</h3>
                <p className="text-xs mt-1">كافة الأصناف المتوفرة في المخزن تشهد حركة مبيعات نشطة.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50/50 text-xs text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">الكود</th>
                      <th className="p-3">اسم الموديل</th>
                      <th className="p-3">اللون</th>
                      <th className="p-3">المقاس</th>
                      <th className="p-3 text-center">الكمية بالمخزن</th>
                      <th className="p-3">سعر البيع</th>
                      <th className="p-3 text-left">مدة الركود</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stagnantItems.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-xs font-bold text-slate-700">
                          {it.code || it.barcode}
                        </td>
                        <td className="p-3 font-bold text-slate-800">{it.name}</td>
                        <td className="p-3 text-xs text-slate-600">{it.color || '-'}</td>
                        <td className="p-3 text-xs text-slate-600">{it.size || '-'}</td>
                        <td className="p-3 font-bold text-slate-900 text-center">
                          {it.currentStock} {it.unit || 'قطعة'}
                        </td>
                        <td className="p-3 font-medium text-slate-700">
                          {formatCurrency(it.sellPrice)}
                        </td>
                        <td className="p-3 text-left">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            {it.daysWithoutSale} يوم
                            {it.neverSold && ' (لم تُبع)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
