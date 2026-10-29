import React, { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { createTransaction, reverseTransaction, TransactionActionType } from '../../lib/data';
import { WalletId } from '../../domain/types';
import { formatCurrency, parseArabicNumber } from '../../domain/money';
import { formatDate, getCairoDate, getMonthKey } from '../../domain/dates';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import {
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  UserMinus,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Wallet,
  Receipt,
  FileSpreadsheet,
} from 'lucide-react';

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  walletId: string;
  targetWalletId?: string;
  category?: string;
  description?: string;
  status?: string;
  referenceNumber?: string;
  createdAt: number;
}

const WALLET_NAMES: Record<string, string> = {
  cash: 'خزينة المحل (كاش)',
  bank: 'الحساب البنكي / إنستاباي',
  wallet: 'محفظة إلكترونية / فودافون كاش',
  pocket: 'الجيب الشخصي',
  none: 'بدون خزينة',
};

const EXPENSE_CATEGORIES = [
  'إيجار المحل',
  'كهرباء ومياه ومرافق',
  'مرتبات ومكافآت',
  'بوفيه ومشروبات ونظافة',
  'تغليف وأكياس ومطبوعات',
  'دعاية وإعلانات',
  'صيانة وإصلاحات',
  'شحن ومواصلات',
  'مصروفات نثريات أخرى',
];

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // حالة النافذة المنبثقة
  const [activeModalType, setActiveModalType] = useState<TransactionActionType | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [wallet, setWallet] = useState<WalletId>('cash');
  const [toWallet, setToWallet] = useState<WalletId>('bank');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState('');
  const [dateStr, setDateStr] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const txRef = collection(db, 'transactions');
    const q = query(txRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: TransactionItem[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          docs.push({
            id: snap.id,
            type: d.type || 'expense',
            amount: Number(d.amount) || 0,
            walletId: d.walletId || 'cash',
            targetWalletId: d.targetWalletId,
            category: d.category || '',
            description: d.description || '',
            status: d.status,
            referenceNumber: d.referenceNumber,
            createdAt: d.createdAt || 0,
          });
        });
        docs.sort((a, b) => b.createdAt - a.createdAt);
        setTransactions(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('Transactions listener error:', err);
        // Fallback without orderBy
        const fallbackSub = onSnapshot(txRef, (snap) => {
          const docs: TransactionItem[] = [];
          snap.forEach((s) => {
            const d = s.data();
            docs.push({
              id: s.id,
              type: d.type || 'expense',
              amount: Number(d.amount) || 0,
              walletId: d.walletId || 'cash',
              targetWalletId: d.targetWalletId,
              category: d.category || '',
              description: d.description || '',
              status: d.status,
              referenceNumber: d.referenceNumber,
              createdAt: d.createdAt || 0,
            });
          });
          docs.sort((a, b) => b.createdAt - a.createdAt);
          setTransactions(docs);
          setLoading(false);
        });
        return () => fallbackSub();
      }
    );

    return () => unsubscribe();
  }, []);

  // أرصدة الخزائن والشهر المقفول (للتحذيرات فقط)
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [lockedThroughMonth, setLockedThroughMonth] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(doc(db, 'stats', 'wallets'), (snap) => {
      const b = (snap.exists() ? snap.data().balances : null) || {};
      setWalletBalances({
        cash: Number(b.cash) || 0,
        bank: Number(b.bank) || 0,
        wallet: Number(b.wallet) || 0,
      });
    }, () => {});
    const u2 = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      setLockedThroughMonth(snap.exists() ? snap.data().lockedThroughMonth || null : null);
    }, () => {});
    return () => {
      u1();
      u2();
    };
  }, []);

  const handleReverse = async (tx: TransactionItem) => {
    if (!window.confirm(`عكس هذه الحركة (${formatCurrency(tx.amount)})؟ سيُرجَع أثرها على الخزينة وتُستبعد من الحسابات.`)) return;
    try {
      await reverseTransaction(tx.id);
      setSuccessMsg('تم عكس الحركة وتصحيح الخزينة');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      window.alert(err.message || 'فشل عكس الحركة');
    }
  };

  const openModal = (type: TransactionActionType) => {
    setActiveModalType(type);
    setAmountStr('');
    setWallet('cash');
    setToWallet('bank');
    setCategory(EXPENSE_CATEGORIES[0]);
    setCustomCategory('');
    setNote('');
    setDateStr('');
    setErrorMsg(null);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalType) return;
    setErrorMsg(null);

    const amount = parseArabicNumber(amountStr);
    if (amount <= 0) {
      setErrorMsg('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    const finalCategory =
      activeModalType === 'expense'
        ? category === 'مصروفات نثريات أخرى' && customCategory.trim()
          ? customCategory.trim()
          : category
        : undefined;

    // تحذير: خزينة ستصبح سالبة
    if (activeModalType !== 'capital_in') {
      const after = (walletBalances[wallet] ?? 0) - amount;
      if (after < 0) {
        const ok = window.confirm(
          `تنبيه: رصيد الخزينة سيصبح ${formatCurrency(after)} (سالب). هل تريد المتابعة؟`
        );
        if (!ok) return;
      }
    }

    // تحذير: التسجيل في شهر تم قفله
    const txMonth = getMonthKey(dateStr ? new Date(dateStr) : getCairoDate());
    if (lockedThroughMonth && txMonth <= lockedThroughMonth) {
      const ok = window.confirm(
        `تنبيه: شهر ${txMonth} تم قفله بالفعل، وهذه الحركة ستدخل في حسابات ما بعد القفل. هل تريد المتابعة؟`
      );
      if (!ok) return;
    }

    try {
      setIsSubmitting(true);
      await createTransaction({
        type: activeModalType,
        amount,
        wallet,
        toWallet: activeModalType === 'transfer' ? toWallet : undefined,
        category: finalCategory,
        note: note.trim() || undefined,
        date: dateStr ? new Date(dateStr) : undefined,
      });

      setSuccessMsg('تم تسجيل الحركة وتحديث رصيد الخزينة بنجاح');
      setActiveModalType(null);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ الحركة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModalTitle = () => {
    switch (activeModalType) {
      case 'expense':
        return 'تسجيل مصروف جديد';
      case 'withdrawal':
        return 'تسجيل سحب شخصي (مسحوبات الشركاء)';
      case 'capital_in':
        return 'إضافة رأس مال / تمويل شخصي';
      case 'transfer':
        return 'تحويل أموال بين الخزائن';
      default:
        return 'تسجيل حركة مالية';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* رأس الصفحة وأزرار العمليات الأربعة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-[#14b8a6]" />
            <span>العمليات وحركات الخزينة</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            تسجيل المصروفات والمسحوبات الشخصية والتحويلات اليومية
          </p>
        </div>

        {/* 4 أزرار في الأعلى */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openModal('expense')}
            className="gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50"
          >
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span>مصروف</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openModal('withdrawal')}
            className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <UserMinus className="w-4 h-4 text-amber-600" />
            <span>سحب شخصي</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openModal('capital_in')}
            className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>إضافة رأس مال</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openModal('transfer')}
            className="gap-1.5 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
          >
            <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
            <span>تحويل</span>
          </Button>
        </div>
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

      {/* قائمة الحركات الأخيرة */}
      <Card className="p-0 overflow-hidden border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#14b8a6]" />
            <span>سجل المعاملات والقيود المالية ({transactions.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Spinner size="lg" />
            <p className="text-sm text-slate-500 mt-3">جاري تحميل حركات الخزينة...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ArrowLeftRight className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <h3 className="text-base font-bold text-slate-700">لا توجد حركات مسجلة</h3>
            <p className="text-xs mt-1">استخدم الأزرار في الأعلى لتسجيل المصروفات أو التحويلات.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => {
              const isExpense = tx.type === 'expense';
              const isWithdrawal = tx.type === 'withdrawal';
              const isCapitalIn = tx.type === 'capital_in';
              const isTransfer = tx.type === 'transfer';
              const isCollection = tx.type === 'collection';
              const isRefund = tx.type === 'refund';
              const isPurchase = tx.type === 'purchase_payment';

              const isOutflow = isExpense || isWithdrawal || isRefund || isPurchase;

              return (
                <div
                  key={tx.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {/* بادج نوع الحركة */}
                      {isExpense && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                          مصروف
                        </span>
                      )}
                      {isWithdrawal && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          مسحوبات شخصية
                        </span>
                      )}
                      {isCapitalIn && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          تمويل رأس مال
                        </span>
                      )}
                      {isTransfer && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                          تحويل خزائن
                        </span>
                      )}
                      {isCollection && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
                          تحصيل عميل
                        </span>
                      )}
                      {isRefund && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          رد مرتجع
                        </span>
                      )}
                      {isPurchase && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          سداد مشتريات
                        </span>
                      )}

                      <span className="font-bold text-slate-800 text-sm">
                        {tx.category || tx.description || 'معاملة مالية'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {WALLET_NAMES[tx.walletId] || tx.walletId}
                          {isTransfer && tx.targetWalletId && (
                            <> &rarr; {WALLET_NAMES[tx.targetWalletId] || tx.targetWalletId}</>
                          )}
                        </span>
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(tx.createdAt, true)}</span>
                      </span>

                      {tx.description && tx.category && tx.description !== tx.category && (
                        <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          {tx.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* المبلغ */}
                  <div className="text-left">
                    {tx.status === 'reversed' && (
                      <span className="block text-[11px] text-slate-400 mb-0.5">معكوسة</span>
                    )}
                    {tx.status !== 'reversed' &&
                      ['expense', 'withdrawal', 'capital_in', 'transfer'].includes(tx.type) &&
                      tx.walletId !== 'pocket' &&
                      !tx.referenceNumber && (
                        <button
                          type="button"
                          onClick={() => handleReverse(tx)}
                          className="block text-[11px] text-rose-600 underline mb-0.5"
                        >
                          عكس الحركة
                        </button>
                      )}
                    <span
                      className={`${tx.status === 'reversed' ? 'line-through opacity-50 ' : ''}text-base font-black ${
                        isOutflow
                          ? 'text-rose-600'
                          : isCapitalIn || isCollection
                          ? 'text-emerald-700'
                          : 'text-indigo-700'
                      }`}
                    >
                      {isOutflow ? '-' : isCapitalIn || isCollection ? '+' : ''}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* نافذة تسجيل الحركة */}
      <Modal
        isOpen={!!activeModalType}
        onClose={() => setActiveModalType(null)}
        title={getModalTitle()}
      >
        <form onSubmit={handleSaveTransaction} className="space-y-4">
          <Input
            label="المبلغ (ج.م)"
            type="text"
            placeholder="0.00"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            required
          />

          {/* اختيار الخزينة المصدر */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {activeModalType === 'transfer' ? 'من خزينة:' : 'الخزينة:'}
            </label>
            <select
              value={wallet}
              onChange={(e) => setWallet(e.target.value as WalletId)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#14b8a6]"
            >
              <option value="cash">خزينة المحل (نقدية / كاش)</option>
              <option value="bank">الحساب البنكي / إنستاباي</option>
              <option value="wallet">محفظة إلكترونية / فودافون كاش</option>
            </select>
          </div>

          {/* إلى خزينة (للتحويل فقط) */}
          {activeModalType === 'transfer' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                إلى خزينة:
              </label>
              <select
                value={toWallet}
                onChange={(e) => setToWallet(e.target.value as WalletId)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#14b8a6]"
              >
                <option value="bank">الحساب البنكي / إنستاباي</option>
                <option value="cash">خزينة المحل (نقدية / كاش)</option>
                <option value="wallet">محفظة إلكترونية / فودافون كاش</option>
              </select>
            </div>
          )}

          {/* تصنيف المصروف (للمصروف فقط) */}
          {activeModalType === 'expense' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تصنيف المصروف:
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#14b8a6]"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {category === 'مصروفات نثريات أخرى' && (
                <div className="mt-2">
                  <Input
                    placeholder="اكتب تصنيف المصروف..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {/* التاريخ (اختياري) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تاريخ الحركة (اتركه فارغاً للتاريخ الحالي):
            </label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#14b8a6]"
            />
          </div>

          <Input
            label="ملاحظات / تفاصيل إضافية (اختياري)"
            placeholder="مثال: فاتورة شهر 10، سحب شخصي للبيت..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveModalType(null)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              تأكيد وحفظ
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
