import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, doc, onSnapshot, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { closeMonthSnapshot } from '../../lib/data';
import { DEFAULT_SETTINGS, StoreSettings } from '../../lib/settings';
import { getCairoDate, getMonthKey, formatMonth } from '../../domain/dates';
import {
  calculateCapital,
  calculateInventoryValue,
  calculateReceivables,
  calculateCustomerCredits,
} from '../../domain/capital';
import {
  calculateInvoiceProfit,
  calculateRealProfit,
  calculateMismatch,
} from '../../domain/profit';
import { formatCurrency, parseArabicNumber, round2 } from '../../domain/money';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import {
  Camera,
  AlertTriangle,
  AlertCircle,
  Lock,
  CheckCircle2,
  TrendingUp,
  Receipt,
  Wallet,
  Building,
  HelpCircle,
  Banknote,
  CreditCard,
  Smartphone,
} from 'lucide-react';

export const SnapshotPage: React.FC = () => {
  const currentMonthKey = getMonthKey(getCairoDate());
  const prevMonthKey = (() => {
    const [y, m] = currentMonthKey.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  })();

  // البيانات المسترجعة
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [rawInvoices, setInvoices] = useState<any[]>([]);
  const [rawTransactions, setTransactions] = useState<any[]>([]);
  const [rawStockAdjustments, setStockAdjustments] = useState<any[]>([]);
  const [rawMonthReturns, setMonthReturns] = useState<any[]>([]);
  // رأس مال آخر قفل سابق (خط الأساس لحساب الربح الحقيقي)
  const [baseline, setBaseline] = useState<{ monthKey: string; capital: number; timestamp: number } | null>(null);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({
    cash: 0,
    bank: 0,
    wallet: 0,
  });
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [lockedThroughMonth, setLockedThroughMonth] = useState<string | null>(null);

  // الأرصدة الفعلية في الدرج المدخلة من قبل المستخدم
  const actualInitRef = useRef(false);
  const [actualCashStr, setActualCashStr] = useState('');
  const [actualBankStr, setActualBankStr] = useState('');
  const [actualWalletStr, setActualWalletStr] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let loadedCount = 0;
    const checkReady = () => {
      loadedCount++;
      if (loadedCount >= 7) {
        setLoading(false);
      }
    };

    // 1. الأصناف
    const unsubItems = onSnapshot(collection(db, 'items'), (snap) => {
      const docs: any[] = [];
      snap.forEach((d) => {
        const it = d.data();
        if (it.isActive !== false) docs.push({ id: d.id, ...it });
      });
      setItems(docs);
      checkReady();
    }, () => checkReady());

    // 2. العملاء
    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snap) => {
      const docs: any[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
      setCustomers(docs);
      checkReady();
    }, () => checkReady());

    // 3. فواتير الشهر الحالي
    const invQuery = query(collection(db, 'invoices'), where('monthKey', '>=', prevMonthKey));
    const unsubInvoices = onSnapshot(invQuery, (snap) => {
      const docs: any[] = [];
      snap.forEach((d) => {
        const inv = d.data();
        if (inv.status !== 'cancelled') docs.push({ id: d.id, ...inv });
      });
      setInvoices(docs);
      checkReady();
    }, () => checkReady());

    // 4. معاملات الشهر الحالي
    const txQuery = query(collection(db, 'transactions'), where('monthKey', '>=', prevMonthKey));
    const unsubTransactions = onSnapshot(txQuery, (snap) => {
      const docs: any[] = [];
      snap.forEach((d) => {
        const x = d.data();
        if (x.status !== 'reversed') docs.push({ id: d.id, ...x });
      });
      setTransactions(docs);
      checkReady();
    }, () => checkReady());

    // 5. تسويات الجرد للشهر الحالي
    const adjQuery = query(collection(db, 'stock_adjustments'), where('monthKey', '>=', prevMonthKey));
    const unsubAdj = onSnapshot(adjQuery, (snap) => {
      const docs: any[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
      setStockAdjustments(docs);
      checkReady();
    }, () => checkReady());

    // 5-ب. مرتجعات الشهر (تُخصم من المبيعات والتكلفة)
    const retQuery = query(collection(db, 'returns'), where('monthKey', '>=', prevMonthKey));
    const unsubReturns = onSnapshot(retQuery, (snap) => {
      const docs: any[] = [];
      snap.forEach((d) => {
        const r = d.data();
        if (r.type === 'return') docs.push({ id: d.id, ...r });
      });
      setMonthReturns(docs);
      checkReady();
    }, () => checkReady());

    // 5-ج. آخر قفل شهري سابق = خط الأساس
    getDocs(query(collection(db, 'snapshots'), orderBy('timestamp', 'desc'), limit(4)))
      .then((snap) => {
        const prev = snap.docs
          .map((d) => d.data())
          .find((d) => d.monthKey && d.monthKey < currentMonthKey);
        setBaseline(prev ? { monthKey: prev.monthKey, capital: Number(prev.capital) || 0, timestamp: Number(prev.timestamp) || 0 } : null);
      })
      .catch(() => setBaseline(null));

    // 6. أرصدة الخزائن والإعدادات
    const unsubWallets = onSnapshot(doc(db, 'stats', 'wallets'), (snap) => {
      if (snap.exists()) {
        const b = snap.data().balances || {};
        const sys = {
          cash: Number(b.cash) || 0,
          bank: Number(b.bank) || 0,
          wallet: Number(b.wallet) || 0,
        };
        setWalletBalances(sys);
        // نملأ خانات العد مرة واحدة فقط حتى لا تُمسح الأرقام التي يكتبها المستخدم
        if (!actualInitRef.current) {
          actualInitRef.current = true;
          setActualCashStr(String(sys.cash));
          setActualBankStr(String(sys.bank));
          setActualWalletStr(String(sys.wallet));
        }
      }
      checkReady();
    }, () => checkReady());

    // الإعدادات
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLockedThroughMonth(data.lockedThroughMonth || null);
        if (data.mismatchThreshold !== undefined && data.mismatchThreshold !== null) {
          setSettings((prev) => ({ ...prev, mismatchThreshold: data.mismatchThreshold }));
        }
      }
    });

    return () => {
      unsubItems();
      unsubCustomers();
      unsubInvoices();
      unsubTransactions();
      unsubAdj();
      unsubReturns();
      unsubWallets();
      unsubSettings();
    };
  }, [currentMonthKey]);

  // الأرصدة الفعلية المعدودة
  const actualCash = parseArabicNumber(actualCashStr);
  const actualBank = parseArabicNumber(actualBankStr);
  const actualWallet = parseArabicNumber(actualWalletStr);
  const actualWalletsTotal = round2(actualCash + actualBank + actualWallet);

  // حساب رأس المال
  // الفترة = من وقت آخر قفل حتى الآن (وليس الشهر التقويمي)، لتتطابق مع فترة نمو رأس المال
  const inPeriod = (d: any) => {
    if (baseline?.timestamp) return (Number(d.createdAt) || 0) > baseline.timestamp;
    return d.monthKey === currentMonthKey;
  };
  const invoices = useMemo(() => rawInvoices.filter(inPeriod), [rawInvoices, baseline]);
  const transactions = useMemo(() => rawTransactions.filter(inPeriod), [rawTransactions, baseline]);
  const stockAdjustments = useMemo(() => rawStockAdjustments.filter(inPeriod), [rawStockAdjustments, baseline]);
  const monthReturns = useMemo(() => rawMonthReturns.filter(inPeriod), [rawMonthReturns, baseline]);

  const inventoryValue = useMemo(() => calculateInventoryValue(items), [items]);
  const receivables = useMemo(() => calculateReceivables(customers), [customers]);
  const customerCredits = useMemo(() => calculateCustomerCredits(customers), [customers]);

  const currentCapital = useMemo(() => {
    return calculateCapital(actualWalletsTotal, inventoryValue, receivables, customerCredits, 0);
  }, [actualWalletsTotal, inventoryValue, receivables, customerCredits]);

  // قيمة وتكلفة المرتجعات خلال الشهر
  const returnsValue = useMemo(
    () => round2(monthReturns.reduce((sum, r) => sum + (Number(r.totalRefund) || 0), 0)),
    [monthReturns]
  );
  const returnsCost = useMemo(
    () =>
      round2(
        monthReturns.reduce(
          (sum, r) =>
            sum +
            (r.items || []).reduce(
              (iSum: number, it: any) => iSum + (Number(it.costPrice) || 0) * (Number(it.quantity) || 0),
              0
            ),
          0
        )
      ),
    [monthReturns]
  );

  // صافي المبيعات = مبيعات الفواتير غير الملغاة - المرتجعات
  const totalSalesNet = useMemo(() => {
    const gross = invoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    return round2(gross - returnsValue);
  }, [invoices, returnsValue]);

  // تكلفة البضاعة المباعة = تكلفة المباع - تكلفة المرتجع
  const costOfGoodsSold = useMemo(() => {
    const sold = invoices.reduce((sum, inv) => {
      const invCost = (inv.items || []).reduce(
        (iSum: number, it: any) => iSum + Number(it.costPrice || 0) * (Number(it.quantity) || 0),
        0
      );
      return sum + invCost;
    }, 0);
    return round2(sold - returnsCost);
  }, [invoices, returnsCost]);

  const monthExpenses = useMemo(() => {
    return round2(
      transactions
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    );
  }, [transactions]);

  const monthBadDebt = useMemo(() => {
    return round2(
      transactions
        .filter((t) => t.type === 'bad_debt')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    );
  }, [transactions]);

  const monthDrawings = useMemo(() => {
    return round2(
      transactions
        .filter((t) => t.type === 'withdrawal')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    );
  }, [transactions]);

  const monthCapitalIn = useMemo(() => {
    return round2(
      transactions
        .filter((t) => t.type === 'capital_in')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    );
  }, [transactions]);

  const stockAdjustmentImpact = useMemo(() => {
    return round2(
      stockAdjustments.reduce((sum, adj) => sum + (Number(adj.totalCostImpact) || 0), 0)
    );
  }, [stockAdjustments]);

  // 1. ربح الفترة (من الفواتير والمصروفات)
  const invoiceProfit = useMemo(() => {
    return calculateInvoiceProfit({
      totalSalesNet,
      costOfGoodsSold,
      stockAdjustmentImpact,
      expenses: monthExpenses,
      badDebt: monthBadDebt,
    });
  }, [totalSalesNet, costOfGoodsSold, stockAdjustmentImpact, monthExpenses, monthBadDebt]);

  // 2. الربح الحقيقي = نمو رأس المال منذ آخر قفل + المسحوبات - رأس المال المضاف
  //    (لا يمكن حسابه بدون قفل سابق)
  const capitalGrowth = useMemo(() => {
    return baseline ? round2(currentCapital - baseline.capital) : null;
  }, [currentCapital, baseline]);

  const realProfit = useMemo(() => {
    return capitalGrowth === null ? invoiceProfit : calculateRealProfit(capitalGrowth, monthDrawings, monthCapitalIn);
  }, [capitalGrowth, invoiceProfit, monthDrawings, monthCapitalIn]);

  // 3. الفرق بين الربح الحقيقي وربح الفواتير (يكشف أي فلوس أو بضاعة ضايعة)
  const mismatch = useMemo(() => {
    return capitalGrowth === null ? 0 : calculateMismatch(realProfit, invoiceProfit);
  }, [capitalGrowth, realProfit, invoiceProfit]);

  const mismatchThreshold = settings.mismatchThreshold ?? 50;
  const hasBaseline = baseline !== null;
  const isMismatchWarning = hasBaseline && Math.abs(mismatch) > mismatchThreshold;
  const isCurrentMonthLocked = lockedThroughMonth === currentMonthKey;

  // تأكيد قفل الشهر
  const handleCloseMonth = async () => {
    if (isCurrentMonthLocked) {
      alert('هذا الشهر مقفل بالفعل');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من رغبتك في قفل حسابات شهر (${formatMonth(new Date())})؟`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      await closeMonthSnapshot({
        monthKey: currentMonthKey,
        actualWallets: {
          cash: actualCash,
          bank: actualBank,
          wallet: actualWallet,
        },
        systemWallets: walletBalances,
        inventoryValue,
        receivables,
        customerCredits,
        capital: currentCapital,
        invoiceProfit,
        realProfit,
        mismatch,
        notes: closingNotes.trim() || undefined,
      });

      setSuccessMsg(`تم قفل شهر (${currentMonthKey}) بنجاح وحفظ Snapshot للأرقام المالية.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل قفل الشهر');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-4">جاري جلب أرقام وحسابات صورة المحل...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Camera className="w-6 h-6 text-[#14b8a6]" />
            <span>صورة المحل وقفل الشهر ({formatMonth(new Date())})</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            تدقيق الخزائن الفعلية ومطابقة الأرباح الحقيقية وقفل الشهر المالي
          </p>
        </div>

        {isCurrentMonthLocked && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 self-start sm:self-auto">
            <Lock className="w-4 h-4" />
            <span>الشهر الحالي مقفل رسمياً</span>
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* تنبيه الميسماتش (إن وجد فرق أكبر من 50 ج.م) */}
      {isMismatchWarning && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 flex items-start gap-3 shadow-sm animate-pulse">
          <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm sm:text-base">
              ⚠️ في حاجة مش متسجلة، راجع المخزون والمصاريف
            </h3>
            <p className="text-xs text-rose-700 mt-1">
              الفرق بين الربح الحقيقي وربح الفواتير ({formatCurrency(Math.abs(mismatch))}) يتجاوز
              حد الأمان المسموح به ({formatCurrency(mismatchThreshold)}). تأكد من تسجيل كافة
              المصاريف أو فروق الجرد.
            </p>
          </div>
        </div>
      )}

      {/* كروت رأس المال والأرباح */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* رأس المال */}
        <Card className="p-5 border-slate-200 bg-slate-900 text-white flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-400 block mb-1">رأس المال الفعلي الإجمالي</span>
            <span className="text-2xl font-black text-white">{formatCurrency(currentCapital)}</span>
            <div className="mt-3 space-y-1 text-xs text-slate-300 border-t border-white/10 pt-2">
              <div className="flex justify-between">
                <span>الخزائن الفعلية:</span>
                <span className="font-bold text-white">{formatCurrency(actualWalletsTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>قيمة المخزون:</span>
                <span className="font-bold text-white">{formatCurrency(inventoryValue)}</span>
              </div>
              <div className="flex justify-between">
                <span>ديون العملاء:</span>
                <span className="font-bold text-amber-400">{formatCurrency(receivables)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* ربح الفواتير */}
        <Card className="p-5 border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">ربح الفواتير للشهر</span>
            <span className="text-2xl font-black text-[#14b8a6]">
              {formatCurrency(invoiceProfit)}
            </span>
            <div className="mt-3 space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
              <div className="flex justify-between">
                <span>صافي المبيعات:</span>
                <span>{formatCurrency(totalSalesNet)}</span>
              </div>
              <div className="flex justify-between">
                <span>تكلفة البضاعة:</span>
                <span>-{formatCurrency(costOfGoodsSold)}</span>
              </div>
              <div className="flex justify-between">
                <span>مصاريف الشهر:</span>
                <span>-{formatCurrency(monthExpenses)}</span>
              </div>
              {returnsValue > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>(المبيعات أعلاه بعد خصم مرتجعات):</span>
                  <span>{formatCurrency(returnsValue)}</span>
                </div>
              )}
              {monthBadDebt > 0 && (
                <div className="flex justify-between">
                  <span>ديون معدومة:</span>
                  <span>-{formatCurrency(monthBadDebt)}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* الربح الحقيقي والفرق */}
        <Card className="p-5 border-slate-200 flex flex-col justify-between">
          <div>
            <span className="text-xs text-slate-500 block mb-1">الربح الحقيقي الصافي</span>
            <span className="text-2xl font-black text-slate-900">
              {formatCurrency(realProfit)}
            </span>

            <div className="mt-3 space-y-1 text-xs border-t border-slate-100 pt-2">
              <div className="flex justify-between text-slate-600">
                <span>المسحوبات الشخصية:</span>
                <span>{formatCurrency(monthDrawings)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>تمويل شخصي مضاف:</span>
                <span>{formatCurrency(monthCapitalIn)}</span>
              </div>
              <div
                className={`flex justify-between font-bold pt-1 border-t border-slate-100 ${
                  isMismatchWarning ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                <span>فرق الربح (Mismatch):</span>
                <span>{formatCurrency(mismatch)}</span>
              </div>
              {!hasBaseline && (
                <p className="text-[11px] text-slate-500 pt-1">
                  لا يوجد قفل شهر سابق، فالربح الحقيقي = ربح الفواتير حالياً. بعد أول قفل شهري يبدأ حساب الفرق الحقيقي.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* قسم الرصيد الفعلي في الدرج وتدقيق الخزائن */}
      <Card className="p-6 border-slate-200 space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#14b8a6]" />
            <span>الرصيد الفعلي في الدرج والخزائن</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            أدخل المبالغ النقدية المعدودة في الواقع لمطابقتها مع رصيد النظام وتسجيل أي فروق جرد
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* نقدية كاش */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span>خزينة المحل (كاش)</span>
              </span>
              <span className="text-xs text-slate-500">
                النظام: <strong>{formatCurrency(walletBalances.cash || 0)}</strong>
              </span>
            </div>

            <Input
              label="الرصيد الفعلي المعدود:"
              type="text"
              value={actualCashStr}
              onChange={(e) => setActualCashStr(e.target.value)}
              disabled={isCurrentMonthLocked}
              required
            />

            <div className="text-[11px] font-bold flex justify-between pt-1">
              <span className="text-slate-500">الفرق:</span>
              <span
                className={
                  round2(actualCash - (walletBalances.cash || 0)) === 0
                    ? 'text-slate-600'
                    : round2(actualCash - (walletBalances.cash || 0)) > 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }
              >
                {round2(actualCash - (walletBalances.cash || 0)) > 0 ? '+' : ''}
                {formatCurrency(round2(actualCash - (walletBalances.cash || 0)))}
              </span>
            </div>
          </div>

          {/* بنك إنستاباي */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>البنك / إنستاباي</span>
              </span>
              <span className="text-xs text-slate-500">
                النظام: <strong>{formatCurrency(walletBalances.bank || 0)}</strong>
              </span>
            </div>

            <Input
              label="الرصيد الفعلي في الحساب:"
              type="text"
              value={actualBankStr}
              onChange={(e) => setActualBankStr(e.target.value)}
              disabled={isCurrentMonthLocked}
              required
            />

            <div className="text-[11px] font-bold flex justify-between pt-1">
              <span className="text-slate-500">الفرق:</span>
              <span
                className={
                  round2(actualBank - (walletBalances.bank || 0)) === 0
                    ? 'text-slate-600'
                    : round2(actualBank - (walletBalances.bank || 0)) > 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }
              >
                {round2(actualBank - (walletBalances.bank || 0)) > 0 ? '+' : ''}
                {formatCurrency(round2(actualBank - (walletBalances.bank || 0)))}
              </span>
            </div>
          </div>

          {/* فودافون كاش */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-rose-600" />
                <span>فودافون كاش</span>
              </span>
              <span className="text-xs text-slate-500">
                النظام: <strong>{formatCurrency(walletBalances.wallet || 0)}</strong>
              </span>
            </div>

            <Input
              label="الرصيد الفعلي في المحفظة:"
              type="text"
              value={actualWalletStr}
              onChange={(e) => setActualWalletStr(e.target.value)}
              disabled={isCurrentMonthLocked}
              required
            />

            <div className="text-[11px] font-bold flex justify-between pt-1">
              <span className="text-slate-500">الفرق:</span>
              <span
                className={
                  round2(actualWallet - (walletBalances.wallet || 0)) === 0
                    ? 'text-slate-600'
                    : round2(actualWallet - (walletBalances.wallet || 0)) > 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }
              >
                {round2(actualWallet - (walletBalances.wallet || 0)) > 0 ? '+' : ''}
                {formatCurrency(round2(actualWallet - (walletBalances.wallet || 0)))}
              </span>
            </div>
          </div>
        </div>

        <Input
          label="ملاحظات قفل الشهر والإغلاق (اختياري)"
          placeholder="مثال: جرد نهاية شهر أكتوبر، ترحيل أرباح..."
          value={closingNotes}
          onChange={(e) => setClosingNotes(e.target.value)}
          disabled={isCurrentMonthLocked}
        />

        {/* زر قفل الشهر */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleCloseMonth}
            disabled={isCurrentMonthLocked || isSubmitting}
            isLoading={isSubmitting}
            className="w-full py-4 text-base font-bold shadow-sm gap-2"
          >
            <Lock className="w-5 h-5" />
            <span>
              {isCurrentMonthLocked
                ? `الشهر مقفل (${currentMonthKey})`
                : `قفل حسابات شهر ${formatMonth(new Date())}`}
            </span>
          </Button>
        </div>
      </Card>
    </div>
  );
};
