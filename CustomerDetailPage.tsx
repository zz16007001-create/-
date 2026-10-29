import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { collectPayment, writeOffDebt } from '../../lib/data';
import { formatCurrency, parseArabicNumber } from '../../domain/money';
import { formatDate } from '../../domain/dates';
import { WalletId } from '../../domain/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import {
  ArrowRight,
  User,
  Phone,
  Banknote,
  Send,
  Ban,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // نافذة التحصيل
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [collectAmountStr, setCollectAmountStr] = useState('');
  const [collectWallet, setCollectWallet] = useState<WalletId>('cash');
  const [isSubmittingCollect, setIsSubmittingCollect] = useState(false);

  // نافذة إعدام الدين
  const [isWriteOffOpen, setIsWriteOffOpen] = useState(false);
  const [writeOffAmountStr, setWriteOffAmountStr] = useState('');
  const [isSubmittingWriteOff, setIsSubmittingWriteOff] = useState(false);

  // جلب بيانات العميل وفواتيره
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const custRef = doc(db, 'customers', id);
    const unsubscribe = onSnapshot(
      custRef,
      async (snap) => {
        if (snap.exists()) {
          const custData: any = { id: snap.id, ...snap.data() };
          setCustomer(custData);
          setCollectAmountStr(custData.currentBalance > 0 ? String(custData.currentBalance) : '');
          setWriteOffAmountStr(custData.currentBalance > 0 ? String(custData.currentBalance) : '');

          // جلب فواتير العميل
          try {
            const invRef = collection(db, 'invoices');
            const q = query(invRef, where('customerId', '==', id));
            const invSnap = await getDocs(q);
            const docs: any[] = [];
            invSnap.forEach((d) => {
              docs.push({ id: d.id, ...d.data() });
            });
            docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            setInvoices(docs);
          } catch (invErr) {
            console.warn('Error fetching customer invoices:', invErr);
          }
        } else {
          setErrorMsg('العميل غير موجود');
        }
        setLoading(false);
      },
      (err) => {
        setErrorMsg('فشل تحميل بيانات العميل: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // إرسال رسالة تذكير عبر واتساب
  const handleSendWhatsAppReminder = () => {
    if (!customer || !customer.phone) {
      alert('لا يوجد رقم هاتف مسجل لهذا العميل');
      return;
    }

    const cleanPhone = customer.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('0')
      ? '2' + cleanPhone
      : cleanPhone.startsWith('20')
      ? cleanPhone
      : '20' + cleanPhone;

    const debt = Math.abs(customer.currentBalance || 0);
    const message = encodeURIComponent(
      `مرحباً أستاذ ${customer.name}، نذكر سيادتكم بوجود حساب مستحق قدره ${formatCurrency(debt)} لدى «محلي». نسعد بزيارتكم وسدادكم في أقرب وقت. شكراً لتعاملكم الراقي معنا!`
    );

    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, '_blank');
  };

  // تأكيد التحصيل
  const handleConfirmCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !id) return;
    setErrorMsg(null);

    const amount = parseArabicNumber(collectAmountStr);
    if (amount <= 0) {
      setErrorMsg('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }

    try {
      setIsSubmittingCollect(true);
      await collectPayment(id, amount, collectWallet);
      setSuccessMsg(`تم تحصيل ${formatCurrency(amount)} بنجاح`);
      setIsCollectOpen(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل التحصيل');
    } finally {
      setIsSubmittingCollect(false);
    }
  };

  // تأكيد إعدام الدين
  const handleConfirmWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !id) return;
    setErrorMsg(null);

    const amount = parseArabicNumber(writeOffAmountStr);
    if (amount <= 0) {
      setErrorMsg('المبلغ يجب أن يكون أكبر من صفر');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من إعدام دين بقيمة ${formatCurrency(amount)}؟`)) {
      return;
    }

    try {
      setIsSubmittingWriteOff(true);
      await writeOffDebt(id, amount);
      setSuccessMsg(`تم إعدام دين بقيمة ${formatCurrency(amount)} بنجاح`);
      setIsWriteOffOpen(false);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إعدام الدين');
    } finally {
      setIsSubmittingWriteOff(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-3">جاري تحميل بيانات العميل...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Card className="p-8">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">العميل غير موجود</h2>
          <Button onClick={() => navigate('/customers')} variant="outline" className="mt-4 gap-2">
            <ArrowRight className="w-4 h-4" />
            <span>العودة لسجل العملاء</span>
          </Button>
        </Card>
      </div>
    );
  }

  const hasDebt = (customer.currentBalance || 0) > 0.01;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* رأس الصفحة والأزرار */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="رجوع لسجل العملاء"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{customer.name}</h1>
              {hasDebt && (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-700">
                  مدين
                </span>
              )}
            </div>
            {customer.phone && (
              <p className="text-xs text-slate-500 mt-0.5" dir="ltr">
                {customer.phone}
              </p>
            )}
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex flex-wrap items-center gap-2">
          {hasDebt && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsCollectOpen(true)}
              className="gap-1.5"
            >
              <Banknote className="w-4 h-4" />
              <span>تحصيل</span>
            </Button>
          )}

          {hasDebt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendWhatsAppReminder}
              className="gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Send className="w-4 h-4 text-emerald-600" />
              <span>تذكير واتساب</span>
            </Button>
          )}

          {hasDebt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsWriteOffOpen(true)}
              className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Ban className="w-4 h-4" />
              <span>دين معدوم</span>
            </Button>
          )}
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

      {/* بطاقة ملخص الحساب */}
      <Card className="p-5 border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block mb-1">الرصيد الحالي</span>
            <span
              className={`text-xl font-black ${
                hasDebt ? 'text-rose-600' : 'text-slate-800'
              }`}
            >
              {formatCurrency(customer.currentBalance || 0)}
              {hasDebt && ' (مستحق على العميل)'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">رقم الهاتف</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800" dir="ltr">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>{customer.phone || 'غير مسجل'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">تاريخ فتح الحساب</span>
            <span className="font-medium text-slate-600">
              {customer.createdAt ? formatDate(customer.createdAt, false) : '-'}
            </span>
          </div>
        </div>
      </Card>

      {/* جدول فواتير العميل */}
      <Card className="p-0 overflow-hidden border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#14b8a6]" />
            <span>فواتير العميل ({invoices.length})</span>
          </h2>
        </div>

        {invoices.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Clock className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-xs font-medium">لا توجد فواتير مسجلة لهذا العميل</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(inv.createdAt, true)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  {(inv.remainingAmount || 0) > 0 && inv.status !== 'cancelled' && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">المتبقي آجل</span>
                      <span className="font-bold text-rose-600">
                        {formatCurrency(inv.remainingAmount)}
                      </span>
                    </div>
                  )}

                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block">الإجمالي</span>
                    <span className="font-black text-slate-900">
                      {formatCurrency(inv.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* نافذة التحصيل */}
      <Modal
        isOpen={isCollectOpen}
        onClose={() => setIsCollectOpen(false)}
        title={`تحصيل حساب من العميل: ${customer.name}`}
      >
        <form onSubmit={handleConfirmCollect} className="space-y-4">
          <Input
            label="المبلغ المحصل (ج.م)"
            type="text"
            value={collectAmountStr}
            onChange={(e) => setCollectAmountStr(e.target.value)}
            placeholder="0.00"
            required
          />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              الخزينة المودع بها التحصيل:
            </label>
            <select
              value={collectWallet}
              onChange={(e) => setCollectWallet(e.target.value as WalletId)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#14b8a6]"
            >
              <option value="cash">خزينة المحل (نقدية / كاش)</option>
              <option value="bank">الحساب البنكي / إنستاباي</option>
              <option value="wallet">محفظة إلكترونية / فودافون كاش</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCollectOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingCollect}
            >
              تأكيد التحصيل
            </Button>
          </div>
        </form>
      </Modal>

      {/* نافذة إعدام الدين */}
      <Modal
        isOpen={isWriteOffOpen}
        onClose={() => setIsWriteOffOpen(false)}
        title={`إعدام دين للعميل: ${customer.name}`}
      >
        <form onSubmit={handleConfirmWriteOff} className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            إعدام الدين يقلل من رصيد العميل ويغلق الفواتير المستحقة دون إدخال أي أموال في الخزائن.
          </div>

          <Input
            label="مبلغ الدين المعدوم (ج.م)"
            type="text"
            value={writeOffAmountStr}
            onChange={(e) => setWriteOffAmountStr(e.target.value)}
            placeholder="0.00"
            required
          />

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsWriteOffOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isSubmittingWriteOff}
            >
              تأكيد إعدام الدين
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
