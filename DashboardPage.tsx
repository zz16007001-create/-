import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { getCairoDate, getDayKey } from '../../domain/dates';
import {
  calculateCapital,
  calculateInventoryValue,
  calculateReceivables,
  calculateCustomerCredits,
} from '../../domain/capital';
import { formatCurrency, round2 } from '../../domain/money';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import {
  Wallet,
  ShoppingCart,
  Boxes,
  Users,
  AlertTriangle,
  PackagePlus,
  TrendingDown,
  ArrowRight,
  Database,
  Building,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronLeft,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // حالات البيانات
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [todayInvoices, setTodayInvoices] = useState<any[]>([]);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({
    cash: 0,
    bank: 0,
    wallet: 0,
  });

  const [loading, setLoading] = useState(true);
  const [backupAlert, setBackupAlert] = useState(false);

  useEffect(() => {
    // التحقق من تاريخ آخر نسخة احتياطية (7 أيام)
    try {
      const lastBackupStr = localStorage.getItem('mahally_last_backup');
      if (!lastBackupStr) {
        setBackupAlert(true);
      } else {
        const lastBackupDate = new Date(lastBackupStr).getTime();
        const diffDays = (Date.now() - lastBackupDate) / (1000 * 60 * 60 * 24);
        if (diffDays >= 7) {
          setBackupAlert(true);
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    const todayKey = getDayKey(getCairoDate());
    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= 4) {
        setLoading(false);
      }
    };

    // 1. الاستماع للأصناف
    const unsubItems = onSnapshot(
      collection(db, 'items'),
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => {
          const it = d.data();
          if (it.isActive !== false) {
            docs.push({ id: d.id, ...it });
          }
        });
        setItems(docs);
        checkAllLoaded();
      },
      () => checkAllLoaded()
    );

    // 2. الاستماع للعملاء
    const unsubCustomers = onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        setCustomers(docs);
        checkAllLoaded();
      },
      () => checkAllLoaded()
    );

    // 3. الاستماع لفواتير اليوم الحالي فقط
    const invQuery = query(collection(db, 'invoices'), where('dayKey', '==', todayKey));
    const unsubInvoices = onSnapshot(
      invQuery,
      (snap) => {
        const docs: any[] = [];
        snap.forEach((d) => {
          const inv = d.data();
          if (inv.status !== 'cancelled') {
            docs.push({ id: d.id, ...inv });
          }
        });
        setTodayInvoices(docs);
        checkAllLoaded();
      },
      () => checkAllLoaded()
    );

    // 4. الاستماع لأرصدة الخزائن
    const unsubWallets = onSnapshot(
      doc(db, 'stats', 'wallets'),
      (snap) => {
        if (snap.exists()) {
          const b = snap.data().balances || {};
          setWalletBalances({
            cash: Number(b.cash) || 0,
            bank: Number(b.bank) || 0,
            wallet: Number(b.wallet) || 0,
          });
        }
        checkAllLoaded();
      },
      () => checkAllLoaded()
    );

    return () => {
      unsubItems();
      unsubCustomers();
      unsubInvoices();
      unsubWallets();
    };
  }, []);

  // الحسابات المالية ورأس المال
  const totalWallets = useMemo(() => {
    return round2(
      (walletBalances.cash || 0) + (walletBalances.bank || 0) + (walletBalances.wallet || 0)
    );
  }, [walletBalances]);

  const inventoryValue = useMemo(() => {
    return calculateInventoryValue(items);
  }, [items]);

  const receivables = useMemo(() => {
    return calculateReceivables(customers);
  }, [customers]);

  const customerCredits = useMemo(() => {
    return calculateCustomerCredits(customers);
  }, [customers]);

  const currentCapital = useMemo(() => {
    return calculateCapital(totalWallets, inventoryValue, receivables, customerCredits, 0);
  }, [totalWallets, inventoryValue, receivables, customerCredits]);

  // مبيعات اليوم
  const todaySalesTotal = useMemo(() => {
    return round2(todayInvoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0));
  }, [todayInvoices]);

  // نواقص المخزون
  const lowStockItems = useMemo(() => {
    return items.filter((it) => (it.currentStock ?? 0) <= (it.minStockAlert ?? 5));
  }, [items]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-4">جاري تحميل لوحة التحكم والبيانات المالية...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* تنبيه النسخ الاحتياطي */}
      {backupAlert && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>تنبيه: لم يتم عمل نسخة احتياطية محلية لبياناتك منذ أكثر من 7 أيام!</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/settings')}
            className="text-amber-800 border-amber-300 bg-white hover:bg-amber-100 shrink-0 self-start sm:self-auto text-xs"
          >
            <Database className="w-3.5 h-3.5" />
            <span>الذهاب للإعدادات والنسخ</span>
          </Button>
        </div>
      )}

      {/* عنوان لوحة التحكم */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">لوحة التحكم الرئيسية</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            نظرة شاملة وسريعة على رأس المال والمبيعات اليومية والمخزون
          </p>
        </div>
      </div>

      {/* شبكة الكروت الأساسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* كارت رأس المال */}
        <Card className="p-5 border-slate-200 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-800 text-white flex flex-col justify-between shadow-xs lg:col-span-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-medium">رأس المال التشغيلي الحالي</span>
              <Building className="w-5 h-5 text-[#14b8a6]" />
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white mt-2 tracking-tight">
              {formatCurrency(currentCapital)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              صافي قيمة المحل = الخزائن + بضاعة المخزن + ديون العملاء
            </p>
          </div>

          {/* تفصيل رأس المال */}
          <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-white/10 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">الخزائن</span>
              <span className="font-bold text-white text-sm">
                {formatCurrency(totalWallets)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">بضاعة المخزن</span>
              <span className="font-bold text-white text-sm">
                {formatCurrency(inventoryValue)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">ديون العملاء</span>
              <span className="font-bold text-amber-400 text-sm">
                {formatCurrency(receivables)}
              </span>
            </div>
          </div>

          {/* تفصيل الخزائن وأرصدة العملاء الدائنة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-white/10 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">كاش (الدرج)</span>
              <span className="font-bold text-white text-sm">{formatCurrency(walletBalances.cash || 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">بنك / إنستاباي</span>
              <span className="font-bold text-white text-sm">{formatCurrency(walletBalances.bank || 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">محفظة إلكترونية</span>
              <span className="font-bold text-white text-sm">{formatCurrency(walletBalances.wallet || 0)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">رصيد دائن للعملاء (-)</span>
              <span className="font-bold text-rose-300 text-sm">{formatCurrency(customerCredits)}</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            رأس المال = {formatCurrency(totalWallets)} + {formatCurrency(inventoryValue)} + {formatCurrency(receivables)} - {formatCurrency(customerCredits)}.
            لمعرفة ربح الشهر والفرق الحقيقي افتح «الجرد والإغلاق».
          </p>
        </Card>

        {/* كارت مبيعات اليوم */}
        <Card className="p-5 border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">مبيعات اليوم</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#14b8a6] flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {formatCurrency(todaySalesTotal)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              عدد الفواتير المنفذة اليوم: {todayInvoices.length} فاتورة
            </p>
          </div>

          <button
            onClick={() => navigate('/invoices')}
            className="flex items-center justify-between text-xs font-bold text-[#14b8a6] hover:text-[#0d9488] pt-3 border-t border-slate-100 mt-3"
          >
            <span>عرض الفواتير</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Card>

        {/* كارت نواقص المخزون */}
        <Card className="p-5 border-slate-200 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">نواقص المخزون</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div
              className={`text-2xl font-black mt-2 ${
                lowStockItems.length > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {lowStockItems.length} صنف
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              أصناف وصلت للحد الأدنى وتطلب التوريد
            </p>
          </div>

          <button
            onClick={() => navigate('/items')}
            className="flex items-center justify-between text-xs font-bold text-rose-600 hover:text-rose-700 pt-3 border-t border-slate-100 mt-3"
          >
            <span>فحص النواقص</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Card>
      </div>

      {/* تفاصيل الخزائن الثلاث */}
      <Card className="p-5 border-slate-200 space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          تفاصيل الخزائن والحسابات النقدية
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">خزينة المحل (كاش)</span>
                <span className="text-[11px] text-slate-400">الدرج النقدي</span>
              </div>
            </div>
            <span className="text-sm font-extrabold text-slate-900">
              {formatCurrency(walletBalances.cash || 0)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">البنك / إنستاباي</span>
                <span className="text-[11px] text-slate-400">الحساب البنكي</span>
              </div>
            </div>
            <span className="text-sm font-extrabold text-slate-900">
              {formatCurrency(walletBalances.bank || 0)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">فودافون كاش</span>
                <span className="text-[11px] text-slate-400">محفظة الهاتف</span>
              </div>
            </div>
            <span className="text-sm font-extrabold text-slate-900">
              {formatCurrency(walletBalances.wallet || 0)}
            </span>
          </div>
        </div>
      </Card>

      {/* الإجراءات السريعة (3 أزرار سريعة) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          إجراءات سريعة
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Button
            onClick={() => navigate('/cashier')}
            variant="primary"
            className="py-4 justify-between text-sm shadow-xs font-bold"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="w-5 h-5" />
              <span>بيع جديد (الكاشير)</span>
            </div>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Button>

          <Button
            onClick={() => navigate('/purchase')}
            variant="outline"
            className="py-4 justify-between text-sm shadow-2xs font-bold bg-white text-slate-800 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2.5">
              <PackagePlus className="w-5 h-5 text-[#14b8a6]" />
              <span>إضافة بضاعة جديدة</span>
            </div>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Button>

          <Button
            onClick={() => navigate('/transactions')}
            variant="outline"
            className="py-4 justify-between text-sm shadow-2xs font-bold bg-white text-slate-800 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2.5">
              <TrendingDown className="w-5 h-5 text-rose-600" />
              <span>تسجيل مصروف</span>
            </div>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
};
