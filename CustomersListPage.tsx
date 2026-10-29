import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { collectPayment, addCustomerWithOpeningBalance } from '../../lib/data';
import { Customer, WalletId } from '../../domain/types';
import { normalizeAr } from '../../domain/arabic';
import { formatCurrency, parseArabicNumber } from '../../domain/money';
import { calculateReceivables } from '../../domain/capital';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import {
  Users,
  Search,
  BadgeDollarSign,
  Phone,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Banknote,
} from 'lucide-react';

export const CustomersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // إضافة عميل برصيد سابق
  const [isOpeningCustOpen, setIsOpeningCustOpen] = useState(false);
  const [ocName, setOcName] = useState('');
  const [ocPhone, setOcPhone] = useState('');
  const [ocAmount, setOcAmount] = useState('');
  const [ocBusy, setOcBusy] = useState(false);
  const [ocError, setOcError] = useState<string | null>(null);

  const handleAddOpeningCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOcError(null);
    try {
      setOcBusy(true);
      await addCustomerWithOpeningBalance({
        name: ocName,
        phone: ocPhone,
        amount: parseArabicNumber(ocAmount),
      });
      setIsOpeningCustOpen(false);
      setOcName('');
      setOcPhone('');
      setOcAmount('');
    } catch (err: any) {
      setOcError(err.message || 'فشل إضافة العميل');
    } finally {
      setOcBusy(false);
    }
  };

  // حالة النافذة السريعة للتحصيل
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [collectAmountStr, setCollectAmountStr] = useState('');
  const [collectWallet, setCollectWallet] = useState<WalletId>('cash');
  const [isSubmittingCollect, setIsSubmittingCollect] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const custRef = collection(db, 'customers');

    const unsubscribe = onSnapshot(
      custRef,
      (snapshot) => {
        const docs: Customer[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          docs.push({
            id: snap.id,
            name: d.name || 'عميل غير مسمى',
            phone: d.phone || '',
            email: d.email || '',
            address: d.address || '',
            currentBalance: Number(d.currentBalance) || 0,
            creditLimit: d.creditLimit,
            notes: d.notes || '',
            createdAt: d.createdAt || 0,
            updatedAt: d.updatedAt || 0,
          });
        });

        // ترتيب تنازلي حسب الرصيد (الأعلى ديناً أولاً)
        docs.sort((a, b) => b.currentBalance - a.currentBalance);
        setCustomers(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('Customers listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // حساب إجمالي الديون المستحقة
  const totalReceivables = useMemo(() => {
    return calculateReceivables(customers);
  }, [customers]);

  // تصفية العملاء
  const filteredCustomers = useMemo(() => {
    const q = normalizeAr(searchTerm.trim());
    if (!q) return customers;

    return customers.filter((c) => {
      const matchText = normalizeAr(`${c.name} ${c.phone} ${c.address || ''}`);
      return matchText.includes(q);
    });
  }, [customers, searchTerm]);

  // فتح نافذة التحصيل السريع
  const handleOpenCollect = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setSelectedCustomer(customer);
    setCollectAmountStr(customer.currentBalance > 0 ? String(customer.currentBalance) : '');
    setCollectWallet('cash');
    setErrorMsg(null);
  };

  // تأكيد التحصيل
  const handleConfirmCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setErrorMsg(null);

    const amount = parseArabicNumber(collectAmountStr);
    if (amount <= 0) {
      setErrorMsg('يرجى إدخال مبلغ تحصيل صحيح أكبر من صفر');
      return;
    }

    try {
      setIsSubmittingCollect(true);
      await collectPayment(selectedCustomer.id, amount, collectWallet);
      setSuccessMsg(`تم تحصيل ${formatCurrency(amount)} من العميل بنجاح`);
      setSelectedCustomer(null);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تسجيل التحصيل');
    } finally {
      setIsSubmittingCollect(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Modal
        isOpen={isOpeningCustOpen}
        onClose={() => setIsOpeningCustOpen(false)}
        title="إضافة عميل برصيد سابق (من الدفتر)"
      >
        <form onSubmit={handleAddOpeningCustomer} className="space-y-4">
          <Input label="اسم العميل" value={ocName} onChange={(e) => setOcName(e.target.value)} />
          <Input label="رقم الهاتف" value={ocPhone} onChange={(e) => setOcPhone(e.target.value)} />
          <Input label="الدين السابق (ج.م)" value={ocAmount} onChange={(e) => setOcAmount(e.target.value)} />
          {ocError && <p className="text-xs text-rose-600">{ocError}</p>}
          <Button type="submit" variant="primary" disabled={ocBusy}>
            {ocBusy ? 'جاري الحفظ...' : 'حفظ العميل'}
          </Button>
        </form>
      </Modal>

      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-[#14b8a6]" />
            <span>سجل العملاء والديون</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            متابعة أرصدة العملاء والتحصيلات وتذكيرات الديون
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setOcError(null);
            setIsOpeningCustOpen(true);
          }}
        >
          + إضافة عميل برصيد سابق
        </Button>
      </div>

      {/* بطاقة إجمالي الديون المستحقة في الأعلى */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 text-white sm:col-span-2 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-300 block mb-1">إجمالي الديون المستحقة للمحل</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-400">
              {formatCurrency(totalReceivables)}
            </span>
            <p className="text-[11px] text-slate-400 mt-1.5">
              مجموع المبالغ الآجلة على كافة العملاء النشطين
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
            <BadgeDollarSign className="w-8 h-8 text-amber-400" />
          </div>
        </Card>

        <Card className="p-5 border-slate-200 flex flex-col justify-center">
          <span className="text-xs text-slate-400 block mb-1">عدد العملاء المسجلين</span>
          <span className="text-2xl font-bold text-slate-800">{customers.length} عميل</span>
          <span className="text-xs text-rose-600 font-medium mt-1">
            {customers.filter((c) => c.currentBalance > 0).length} عملاء عليهم ديون مستحقة
          </span>
        </Card>
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

      {/* شريط البحث */}
      <Card className="p-4 border-slate-200">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم العميل أو برقم الهاتف..."
            dir="rtl"
            className="w-full rounded-xl border border-slate-300 bg-white pr-10 pl-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 transition-all"
          />
          <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </Card>

      {/* قائمة العملاء */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 mt-3">جاري تحميل بيانات العملاء...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-2 border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">لا يوجد عملاء مطابقين</h3>
          <p className="text-xs text-slate-400 mt-1">
            يتم تسجيل العملاء تلقائياً عند حفظ فواتير بيع بآجل.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((cust) => {
            const hasDebt = cust.currentBalance > 0.01;
            const hasCredit = cust.currentBalance < -0.01;

            return (
              <Card
                key={cust.id}
                onClick={() => navigate(`/customers/${cust.id}`)}
                className="p-4 border border-slate-200 hover:border-[#14b8a6]/50 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* بيانات العميل */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base group-hover:text-[#14b8a6] transition-colors">
                        {cust.name}
                      </h3>
                      {hasDebt ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                          مدين
                        </span>
                      ) : hasCredit ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                          دائن (دفعة مقدمة)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          خالص الحساب
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {cust.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span dir="ltr">{cust.phone}</span>
                        </span>
                      )}
                      {cust.address && <span>{cust.address}</span>}
                    </div>
                  </div>

                  {/* الرصيد وزر التحصيل السريع */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right sm:text-left">
                      <span className="text-[10px] text-slate-400 block">الرصيد الحالي</span>
                      <span
                        className={`text-base font-black ${
                          hasDebt
                            ? 'text-rose-600'
                            : hasCredit
                            ? 'text-emerald-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {formatCurrency(Math.abs(cust.currentBalance))}
                        {hasDebt && ' (عليه)'}
                        {hasCredit && ' (له)'}
                      </span>
                    </div>

                    {hasDebt && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={(e) => handleOpenCollect(e, cust)}
                        className="gap-1.5 shadow-2xs"
                      >
                        <Banknote className="w-3.5 h-3.5" />
                        <span>تحصيل</span>
                      </Button>
                    )}

                    <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-[#14b8a6] transition-colors hidden sm:block" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* نافذة التحصيل السريع */}
      {selectedCustomer && (
        <Modal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          title={`تحصيل دفعة من العميل: ${selectedCustomer.name}`}
        >
          <form onSubmit={handleConfirmCollect} className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">إجمالي الدين المستحق:</span>
                <span className="font-bold text-rose-600 text-sm">
                  {formatCurrency(selectedCustomer.currentBalance)}
                </span>
              </div>
            </div>

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
                onClick={() => setSelectedCustomer(null)}
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
      )}
    </div>
  );
};
