import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { normalizeAr } from '../../domain/arabic';
import { formatCurrency } from '../../domain/money';
import { formatDate } from '../../domain/dates';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import {
  Receipt,
  Search,
  Eye,
  EyeOff,
  User,
  Calendar,
  AlertCircle,
  FileText,
  CreditCard,
  Ban,
} from 'lucide-react';

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  dateIso?: string;
  createdAt: number;
  customerName?: string;
  customerPhone?: string;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  items?: any[];
}

export const InvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCancelled, setShowCancelled] = useState(false); // إخفاء الملغاة افتراضياً

  useEffect(() => {
    setLoading(true);
    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs: InvoiceListItem[] = [];
        snapshot.forEach((snap) => {
          const d = snap.data();
          docs.push({
            id: snap.id,
            invoiceNumber: d.invoiceNumber || snap.id,
            dateIso: d.dateIso,
            createdAt: d.createdAt || 0,
            customerName: d.customerName || '',
            customerPhone: d.customerPhone || '',
            grandTotal: Number(d.grandTotal) || 0,
            paidAmount: Number(d.paidAmount) || 0,
            remainingAmount: Number(d.remainingAmount) || 0,
            status: d.status || 'completed',
            items: d.items || [],
          });
        });
        docs.sort((a, b) => b.createdAt - a.createdAt);
        setInvoices(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('Invoices onSnapshot error:', err);
        // Fallback without orderBy
        const fallbackSub = onSnapshot(invoicesRef, (snap) => {
          const docs: InvoiceListItem[] = [];
          snap.forEach((s) => {
            const d = s.data();
            docs.push({
              id: s.id,
              invoiceNumber: d.invoiceNumber || s.id,
              dateIso: d.dateIso,
              createdAt: d.createdAt || 0,
              customerName: d.customerName || '',
              customerPhone: d.customerPhone || '',
              grandTotal: Number(d.grandTotal) || 0,
              paidAmount: Number(d.paidAmount) || 0,
              remainingAmount: Number(d.remainingAmount) || 0,
              status: d.status || 'completed',
              items: d.items || [],
            });
          });
          docs.sort((a, b) => b.createdAt - a.createdAt);
          setInvoices(docs);
          setLoading(false);
        });
        return () => fallbackSub();
      }
    );

    return () => unsubscribe();
  }, []);

  // التصفية والبحث
  const filteredInvoices = useMemo(() => {
    const q = normalizeAr(searchTerm.trim());

    return invoices.filter((inv) => {
      // إخفاء الفواتير الملغاة افتراضياً ما لم يطلب المستخدم إظهارها
      if (!showCancelled && inv.status === 'cancelled') {
        return false;
      }

      // البحث برقم الفاتورة أو اسم العميل
      if (q) {
        const textToSearch = normalizeAr(`${inv.invoiceNumber} ${inv.customerName || ''} ${inv.customerPhone || ''}`);
        if (!textToSearch.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, searchTerm, showCancelled]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#14b8a6]" />
            <span>سجل الفواتير والمبيعات</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            عرض كافة فواتير البيع وحالة السداد والمتبقي الآجل
          </p>
        </div>
      </div>

      {/* شريط البحث وتصفية الملغى */}
      <Card className="p-4 border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث برقم الفاتورة، أو اسم العميل..."
            dir="rtl"
            className="w-full rounded-xl border border-slate-300 bg-white pr-10 pl-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 transition-all"
          />
          <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>

        {/* زر إظهار/إخفاء الفواتير الملغاة */}
        <button
          type="button"
          onClick={() => setShowCancelled(!showCancelled)}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-colors shrink-0 ${
            showCancelled
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {showCancelled ? <Eye className="w-4 h-4 text-rose-600" /> : <EyeOff className="w-4 h-4" />}
          <span>{showCancelled ? 'إخفاء الفواتير الملغاة' : 'إظهار الفواتير الملغاة'}</span>
        </button>
      </Card>

      {/* قائمة الفواتير */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 mt-3">جاري تحميل الفواتير...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Card className="py-16 text-center border-dashed border-2 border-slate-200">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-700">لا توجد فواتير مطابقة</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm ? 'جرّب كتابة كلمة بحث أخرى' : 'لم يتم تسجيل أي فواتير بيع بعد'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => {
            const isCancelled = inv.status === 'cancelled';
            const hasDebt = inv.remainingAmount > 0.01;

            return (
              <Card
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className={`p-4 border transition-all cursor-pointer hover:shadow-md hover:border-[#14b8a6]/50 ${
                  isCancelled ? 'bg-slate-50/70 border-slate-200 opacity-75' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* رقم الفاتورة والعميل والتاريخ */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                        {inv.invoiceNumber}
                      </span>

                      {isCancelled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                          <Ban className="w-3 h-3" />
                          <span>ملغاة</span>
                        </span>
                      ) : hasDebt ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          آجل (متبقٍ)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          مدفوعة بالكامل
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">
                          {inv.customerName || 'عميل نقدي'}
                        </span>
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(inv.createdAt, true)}</span>
                      </span>
                    </div>
                  </div>

                  {/* المبالغ المالية: الإجمالي والمتبقي آجل */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {hasDebt && !isCancelled && (
                      <div className="text-right sm:text-left">
                        <span className="text-[10px] text-slate-400 block">المتبقي آجل</span>
                        <span className="text-sm font-bold text-rose-600">
                          {formatCurrency(inv.remainingAmount)}
                        </span>
                      </div>
                    )}

                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 block">إجمالي الفاتورة</span>
                      <span className="text-base font-black text-slate-900">
                        {formatCurrency(inv.grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
