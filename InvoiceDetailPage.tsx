import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { createReturn, cancelInvoice } from '../../lib/data';
import { calculateLineReturn } from '../../domain/invoice';
import { formatCurrency, round2 } from '../../domain/money';
import { formatDate } from '../../domain/dates';
import { WalletId } from '../../domain/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import {
  ArrowRight,
  User,
  Calendar,
  Phone,
  Printer,
  RotateCcw,
  Ban,
  CreditCard,
  Banknote,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // حالة نافذة المرتجع
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [refundWallet, setRefundWallet] = useState<WalletId>('cash');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  // حالة نافذة تأكيد الإلغاء
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, 'invoices', id),
      (snap) => {
        if (snap.exists()) {
          setInvoice({ id: snap.id, ...snap.data() });
        } else {
          setErrorMsg('لم يتم العثور على الفاتورة المطلوبة');
        }
        setLoading(false);
      },
      (err) => {
        setErrorMsg('فشل تحميل الفاتورة: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // إعداد وتصفير كميات المرتجع عند فتح النافذة
  const openReturnModal = () => {
    if (!invoice) return;
    const initial: Record<string, number> = {};
    (invoice.items || []).forEach((it: any) => {
      initial[it.itemId] = 0;
    });
    setReturnQuantities(initial);
    setIsReturnModalOpen(true);
    setErrorMsg(null);
  };

  // حساب معاينة المرتجع
  const returnPreview = useMemo(() => {
    if (!invoice || !invoice.items) {
      return { totalReturnValue: 0, appliedToDebt: 0, cashRefund: 0, validLines: [] };
    }

    let totalVal = 0;
    const validLines: { itemId: string; quantity: number }[] = [];

    invoice.items.forEach((it: any) => {
      const returnQty = returnQuantities[it.itemId] || 0;
      if (returnQty > 0) {
        const soldQty = Number(it.quantity) || 1;
        // نفس منطق createReturn: القيمة بعد الخصم والضريبة، مع مراعاة ما سبق إرجاعه
        const sumTotals = invoice.items.reduce(
          (sm: number, x: any) => sm + (Number(x.total) || Number(x.unitPrice) * Number(x.quantity) || 0),
          0
        );
        const legacyFactor = sumTotals > 0 ? (Number(invoice.grandTotal) || sumTotals) / sumTotals : 1;
        const lineNet =
          it.lineGrand !== undefined && it.lineGrand !== null
            ? Number(it.lineGrand)
            : round2((Number(it.total) || Number(it.unitPrice) * soldQty) * legacyFactor);
        const { refundAmount } = calculateLineReturn(
          lineNet,
          soldQty,
          returnQty,
          Number(it.returnedQty) || 0,
          Number(it.returnedAmount) || 0
        );
        totalVal = round2(totalVal + refundAmount);
        validLines.push({ itemId: it.itemId, quantity: returnQty });
      }
    });

    const currentDebt = round2(Number(invoice.remainingAmount) || 0);
    const appliedToDebt = round2(Math.min(currentDebt, totalVal));
    const cashRefund = round2(totalVal - appliedToDebt);

    return {
      totalReturnValue: totalVal,
      appliedToDebt,
      cashRefund,
      validLines,
    };
  }, [invoice, returnQuantities]);

  // تنفيذ المرتجع
  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !id) return;
    setErrorMsg(null);

    if (returnPreview.validLines.length === 0 || returnPreview.totalReturnValue <= 0) {
      setErrorMsg('يرجى إدخال كمية مرتجعة واحدة على الأقل');
      return;
    }

    try {
      setIsSubmittingReturn(true);
      await createReturn(id, returnPreview.validLines, refundWallet);
      setSuccessMsg('تم تسجيل المرتجع بنجاح وتحديث المخزون والخزينة');
      setIsReturnModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تسجيل المرتجع');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // تنفيذ إلغاء الفاتورة
  const handleConfirmCancel = async () => {
    if (!invoice || !id) return;
    setErrorMsg(null);

    try {
      setIsSubmittingCancel(true);
      await cancelInvoice(id);
      setSuccessMsg('تم إلغاء الفاتورة بالكامل وعكس القيود بنجاح');
      setIsCancelModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إلغاء الفاتورة');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-3">جاري تحميل الفاتورة...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Card className="p-8">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">الفاتورة غير موجودة</h2>
          <Button onClick={() => navigate('/invoices')} variant="outline" className="mt-4 gap-2">
            <ArrowRight className="w-4 h-4" />
            <span>العودة للفواتير</span>
          </Button>
        </Card>
      </div>
    );
  }

  const isCancelled = invoice.status === 'cancelled';
  const hasDebt = (invoice.remainingAmount || 0) > 0.01;
  const payments = invoice.payments || {};

  // فحص ما إذا كان هناك أي بنود قابلة للإرجاع
  const hasReturnableItems = (invoice.items || []).some(
    (it: any) => (Number(it.quantity) || 0) > (Number(it.returnedQty) || 0)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* الشريط العلوي والأزرار */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/invoices')}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="رجوع لسجل الفواتير"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                فاتورة رقم {invoice.invoiceNumber}
              </h1>
              {isCancelled ? (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-700">
                  ملغاة
                </span>
              ) : hasDebt ? (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800">
                  آجل
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                  مدفوعة
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatDate(invoice.createdAt, true)}
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>طباعة</span>
          </Button>

          {!isCancelled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasReturnableItems}
              onClick={openReturnModal}
              title={hasReturnableItems ? 'تسجيل مرتجع' : 'تم إرجاع كافة البنود بالفعل'}
              className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4 text-amber-600" />
              <span>مرتجع</span>
            </Button>
          )}

          {!isCancelled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(true)}
              className="gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <Ban className="w-4 h-4" />
              <span>إلغاء</span>
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

      {/* بيانات العميل والتاريخ */}
      <Card className="p-5 border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block mb-1">العميل</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <User className="w-4 h-4 text-slate-400" />
              <span>{invoice.customerName || 'عميل نقدي'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">رقم الهاتف</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Phone className="w-4 h-4 text-slate-400" />
              <span dir="ltr">{invoice.customerPhone || '-'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">تاريخ الفاتورة</span>
            <div className="flex items-center gap-1.5 font-medium text-slate-700">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>{formatDate(invoice.createdAt, true)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
            <span className="font-bold ml-1">ملاحظات:</span>
            <span>{invoice.notes}</span>
          </div>
        )}
      </Card>

      {/* جدول بنود الفاتورة - ممنوع تماماً إظهار سعر الشراء أو الربح */}
      <Card className="p-0 overflow-hidden border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">بنود الفاتورة</h2>
          {isCancelled && (
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
              تم إلغاء وإرجاع كافة البنود للمخزن
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50/50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 font-semibold">#</th>
                <th className="p-3 font-semibold">الكود</th>
                <th className="p-3 font-semibold">الصنف / الموديل</th>
                <th className="p-3 font-semibold text-center">الكمية المباعة</th>
                <th className="p-3 font-semibold text-center">المرتجع سابقاً</th>
                <th className="p-3 font-semibold">سعر الوحدة</th>
                <th className="p-3 font-semibold text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(invoice.items || []).map((it: any, index: number) => {
                const returned = Number(it.returnedQty) || 0;
                return (
                  <tr key={index} className="hover:bg-slate-50/50">
                    <td className="p-3 text-xs text-slate-400">{index + 1}</td>
                    <td className="p-3 font-mono text-xs font-bold text-slate-700">
                      {it.code || '-'}
                    </td>
                    <td className="p-3 font-medium text-slate-800">{it.name}</td>
                    <td className="p-3 font-bold text-slate-900 text-center">{it.quantity}</td>
                    <td className="p-3 font-medium text-amber-700 text-center">
                      {returned > 0 ? `${returned} قطعة` : '-'}
                    </td>
                    <td className="p-3 font-medium text-slate-700">
                      {formatCurrency(it.unitPrice)}
                    </td>
                    <td className="p-3 font-bold text-slate-900 text-left">
                      {formatCurrency(it.total || it.unitPrice * it.quantity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ملخص الدفعات والإجماليات */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* تفاصيل السداد والمحافظ */}
        <Card className="p-5 border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
            تفاصيل الدفعات
          </h2>
          <div className="space-y-2 text-sm">
            {payments.cash > 0 && (
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>نقدي (خزينة المحل):</span>
                </span>
                <span className="font-bold">{formatCurrency(payments.cash)}</span>
              </div>
            )}

            {payments.instapay > 0 && (
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>إنستاباي (البنك):</span>
                </span>
                <span className="font-bold">{formatCurrency(payments.instapay)}</span>
              </div>
            )}

            {payments.wallet > 0 && (
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-rose-600" />
                  <span>فودافون كاش:</span>
                </span>
                <span className="font-bold">{formatCurrency(payments.wallet)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-bold text-slate-900">
              <span>إجمالي المسدد:</span>
              <span className="text-[#14b8a6]">{formatCurrency(invoice.paidAmount)}</span>
            </div>
          </div>
        </Card>

        {/* إجماليات الفاتورة */}
        <Card className="p-5 border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
            ملخص الحساب
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الفرعي:</span>
              <span className="font-bold text-slate-800">
                {formatCurrency(invoice.subtotal || invoice.grandTotal)}
              </span>
            </div>

            {(invoice.discountTotal || 0) > 0 && (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>خصم الفاتورة:</span>
                <span>-{formatCurrency(invoice.discountTotal)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
              <span>إجمالي الفاتورة:</span>
              <span>{formatCurrency(invoice.grandTotal)}</span>
            </div>

            {hasDebt && !isCancelled && (
              <div className="flex justify-between text-rose-600 font-black text-sm pt-2 border-t border-slate-100 bg-rose-50 p-2.5 rounded-xl">
                <span>المتبقي آجل (دين):</span>
                <span>{formatCurrency(invoice.remainingAmount)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* نافذة المرتجع */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`تسجيل مرتجع - فاتورة ${invoice.invoiceNumber}`}
      >
        <form onSubmit={handleConfirmReturn} className="space-y-4">
          <div className="space-y-3 max-h-60 overflow-y-auto p-1">
            {(invoice.items || []).map((it: any) => {
              const soldQty = Number(it.quantity) || 0;
              const returnedSoFar = Number(it.returnedQty) || 0;
              const maxReturnable = Math.max(0, soldQty - returnedSoFar);

              if (maxReturnable <= 0) return null;

              return (
                <div
                  key={it.itemId}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-800">{it.name}</span>
                    <span className="text-slate-500">
                      المتاح للإرجاع: <strong>{maxReturnable}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-600 shrink-0">الكمية المرتجعة:</label>
                    <input
                      type="number"
                      min="0"
                      max={maxReturnable}
                      value={returnQuantities[it.itemId] || 0}
                      onChange={(e) => {
                        const val = Math.min(
                          maxReturnable,
                          Math.max(0, parseInt(e.target.value) || 0)
                        );
                        setReturnQuantities((prev) => ({ ...prev, [it.itemId]: val }));
                      }}
                      className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-sm"
                    />
                    <span className="text-xs text-slate-400">
                      سعر الوحدة: {formatCurrency(it.unitPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* اختيار خزينة الرد */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              خزينة رد المبلغ النقدي (إن وجد رد كاش):
            </label>
            <select
              value={refundWallet}
              onChange={(e) => setRefundWallet(e.target.value as WalletId)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#14b8a6]"
            >
              <option value="cash">خزينة المحل (نقدية / كاش)</option>
              <option value="bank">الحساب البنكي / إنستاباي</option>
              <option value="wallet">محفظة إلكترونية / فودافون كاش</option>
            </select>
          </div>

          {/* معاينة الحسبة المالية للمرتجع */}
          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold space-y-1.5">
            <div className="flex justify-between text-slate-700">
              <span>إجمالي قيمة المرتجع:</span>
              <span className="text-slate-900">
                {formatCurrency(returnPreview.totalReturnValue)}
              </span>
            </div>

            {returnPreview.appliedToDebt > 0 && (
              <div className="flex justify-between text-amber-800 border-t border-slate-200 pt-1">
                <span>خصم من الدين الآجل للفاتورة:</span>
                <span>-{formatCurrency(returnPreview.appliedToDebt)}</span>
              </div>
            )}

            <div className="flex justify-between text-emerald-700 border-t border-slate-200 pt-1 text-sm font-extrabold">
              <span>المبلغ المسترد نقداً للعميل:</span>
              <span>{formatCurrency(returnPreview.cashRefund)}</span>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsReturnModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingReturn}
              disabled={returnPreview.totalReturnValue <= 0}
            >
              تأكيد المرتجع
            </Button>
          </div>
        </form>
      </Modal>

      {/* نافذة تأكيد الإلغاء */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="تأكيد إلغاء الفاتورة بالكامل"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">هل أنت متأكد من رغبتك في إلغاء الفاتورة؟</p>
              <p className="mt-1">
                سيتم إرجاع كافة الكميات المتبقية إلى المخزن، وتصفية الدين الآجل على العميل، وسحب
                المبالغ التي تم تحصيلها من الخزائن. هذا الإجراء لا يمكن التراجع عنه.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
            >
              تراجع
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isSubmittingCancel}
              onClick={handleConfirmCancel}
            >
              نعم، تأكيد الإلغاء
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
