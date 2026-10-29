import React, { useState, useMemo } from 'react';
import { useItems, ExtendedItem } from '../../hooks/useItems';
import { normalizeAr } from '../../domain/arabic';
import { formatCurrency, parseArabicNumber, round2 } from '../../domain/money';
import { calculateInvoiceTotals } from '../../domain/invoice';
import { createInvoice } from '../../lib/data';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  User,
  Phone,
  Wallet,
  Receipt,
  Tag,
  CreditCard,
  Banknote,
  Smartphone,
} from 'lucide-react';

interface CartItem {
  itemId: string;
  code: string;
  name: string;
  color?: string;
  size?: number | string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  availableStock: number;
}

export const CashierPage: React.FC = () => {
  const { items, loading } = useItems();

  // حالة البحث عن صنف
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // السلة
  const [cart, setCart] = useState<CartItem[]>([]);

  // الخصم الإجمالي: نوع الخصم (مبلغ ثابت أو نسبة مئوية)
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [discountInputStr, setDiscountInputStr] = useState('');

  // بيانات العميل
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // خانات الدفع
  const [cashStr, setCashStr] = useState('');
  const [instapayStr, setInstapayStr] = useState('');
  const [walletStr, setWalletStr] = useState('');

  // الملاحظات
  const [notes, setNotes] = useState('');

  // حالات الإرسال والرسائل
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInvoiceNum, setSuccessInvoiceNum] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);

  // تصفية نتائج البحث السريع
  const searchResults = useMemo(() => {
    const q = normalizeAr(searchTerm.trim());
    if (!q) return [];

    const matches = items
      .filter((it) => it.isActive)
      .filter((it) => {
        const fullSearch = it.search || normalizeAr(`${it.code} ${it.name} ${it.color} ${it.size}`);
        return fullSearch.includes(q);
      });
    // التطابق التام للكود أولاً (حتى لا يضيع الباركود المطابق خارج أول 8 نتائج)
    const exact = matches.filter((it) => normalizeAr(String(it.code || '')) === q);
    const others = matches.filter((it) => !exact.includes(it));
    return [...exact, ...others].slice(0, 8);
  }, [items, searchTerm]);

  // إضافة صنف للسلة
  const addToCart = (item: ExtendedItem) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.itemId === item.id);
      if (existingIdx >= 0) {
        return prev.map((c, i) => (i === existingIdx ? { ...c, quantity: c.quantity + 1 } : c));
      }

      return [
        ...prev,
        {
          itemId: item.id,
          code: item.code || item.barcode || '',
          name: item.name,
          color: item.color,
          size: item.size,
          quantity: 1,
          unitPrice: round2(item.sellPrice),
          costPrice: round2(item.costPrice || 0),
          availableStock: item.currentStock ?? 0,
        },
      ];
    });

    setSearchTerm('');
    setIsSearchFocused(false);
    setErrorMsg(null);
  };

  // تحديث كمية صنف بالسلة
  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((it) => (it.itemId === itemId ? { ...it, quantity: newQty } : it))
    );
  };

  // إزالة صنف من السلة
  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((it) => it.itemId !== itemId));
  };

  // تفريغ السلة
  const clearCart = () => {
    setCart([]);
    setDiscountInputStr('');
    setCashStr('');
    setInstapayStr('');
    setWalletStr('');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setErrorMsg(null);
  };

  // الحسابات المالية باستخدام calculateInvoiceTotals
  const subtotal = useMemo(() => {
    return round2(cart.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0));
  }, [cart]);

  const overallDiscount = useMemo(() => {
    const rawVal = parseArabicNumber(discountInputStr);
    if (rawVal <= 0) return 0;
    if (discountType === 'percent') {
      return round2((subtotal * Math.min(100, rawVal)) / 100);
    }
    return round2(Math.min(subtotal, rawVal));
  }, [subtotal, discountInputStr, discountType]);

  const cashPaid = parseArabicNumber(cashStr);
  const instapayPaid = parseArabicNumber(instapayStr);
  const walletPaid = parseArabicNumber(walletStr);
  const totalPaid = round2(cashPaid + instapayPaid + walletPaid);

  const invoiceTotals = useMemo(() => {
    return calculateInvoiceTotals({
      items: cart.map((it) => ({
        itemId: it.itemId,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        costPrice: it.costPrice || 0,
        discount: 0,
        total: round2(it.unitPrice * it.quantity),
      })),
      overallDiscount,
      paidAmount: totalPaid,
    });
  }, [cart, overallDiscount, totalPaid]);

  const grandTotal = invoiceTotals.grandTotal;
  const remainingDebt = invoiceTotals.remainingAmount;
  const changeDue = round2(Math.max(0, totalPaid - grandTotal));

  // تعبئة المبلغ بالكامل كاش سريعاً
  const handlePayFullCash = () => {
    setCashStr(String(grandTotal));
    setInstapayStr('');
    setWalletStr('');
  };

  // حفظ الفاتورة
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cart.length === 0) {
      setErrorMsg('السلة فارغة. يرجى اختيار صنف واحد على الأقل');
      return;
    }

    if (remainingDebt > 0.01 && (!customerName.trim() || !customerPhone.trim())) {
      setErrorMsg('يرجى كتابة اسم ورقم هاتف العميل لأن الفاتورة تحتوي على متبقٍ آجل');
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await createInvoice({
        items: cart.map((it) => ({
          itemId: it.itemId,
          code: it.code,
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          costPrice: it.costPrice,
        })),
        overallDiscount,
        payments: {
          cash: cashPaid,
          instapay: instapayPaid,
          wallet: walletPaid,
        },
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setSavedOffline(!!res.queued);
      setSuccessInvoiceNum(res.invoiceNumber);
      clearCart();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ الفاتورة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[#14b8a6]" />
            <span>نقطة البيع والكاشير</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            إتمام عمليات البيع الفوري وإصدار الفواتير
          </p>
        </div>

        {cart.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearCart}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5 self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" />
            <span>تفريغ السلة</span>
          </Button>
        )}
      </div>

      {/* رسالة نجاح الفاتورة */}
      {successInvoiceNum && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              {savedOffline
                ? `تم الحفظ على الجهاز (رقم ${successInvoiceNum}) وهيترفع لما النت يرجع`
                : `تم إصدار الفاتورة بنجاح برقم: ${successInvoiceNum}`}
            </span>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setSuccessInvoiceNum(null)}
          >
            فاتورة جديدة
          </Button>
        </div>
      )}

      {/* رسائل الخطأ */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* شريط البحث المباشر عن الأصناف */}
      <div className="relative z-20">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onKeyDown={(e) => {
              // قارئ الباركود يكتب الكود ثم Enter: نضيف الصنف المطابق تماماً مباشرة
              if (e.key === 'Enter') {
                e.preventDefault();
                const q = normalizeAr(searchTerm.trim());
                const hit = items.find((it) => it.isActive && normalizeAr(String(it.code || '')) === q);
                if (hit) addToCart(hit);
              }
            }}
            placeholder="ابحث بالكود، أو اسم الصنف، أو اللون، أو المقاس..."
            dir="rtl"
            className="w-full rounded-2xl border-2 border-[#14b8a6]/40 bg-white pr-12 pl-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#14b8a6] focus:ring-4 focus:ring-[#14b8a6]/15 shadow-sm transition-all"
          />
          <Search className="absolute right-4 top-4 w-5 h-5 text-slate-400 pointer-events-none" />
        </div>

        {/* قائمة النتائج المنسدلة للبحث */}
        {isSearchFocused && searchResults.length > 0 && (
          <div className="absolute top-full mt-2 inset-x-0 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-80 overflow-y-auto divide-y divide-slate-100 p-1.5">
            {searchResults.map((item) => {
              const stock = item.currentStock ?? 0;
              const isOut = stock <= 0;

              return (
                <div
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="p-3 hover:bg-slate-50 cursor-pointer rounded-xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                      {item.code || item.barcode}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        {item.color && <span>لون: {item.color}</span>}
                        {item.size && <span>مقاس: {item.size}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-left">
                    {/* إظهار الرصيد المتاح مع تنبيه أحمر لو صفر، لكن لا يمنع البيع */}
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-bold ${
                          isOut
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isOut && <AlertTriangle className="w-3 h-3 text-rose-600" />}
                        <span>الرصيد: {stock}</span>
                      </span>
                    </div>

                    <span className="text-sm font-black text-[#14b8a6]">
                      {formatCurrency(item.sellPrice)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* المحتوى الرئيسي: جدول السلة + لوحة الدفع */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* جدول بنود السلة (8 أعمدة) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-0 overflow-hidden border-slate-200">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#14b8a6]" />
                <span>بنود الفاتورة ({cart.length})</span>
              </span>
              <span className="text-xs text-slate-500">
                إجمالي القطع: {cart.reduce((s, it) => s + it.quantity, 0)}
              </span>
            </div>

            {cart.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <ShoppingCart className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">السلة فارغة حالياً</p>
                <p className="text-xs mt-1">ابحث عن صنف بالأعلى لإضافته إلى الفاتورة</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((it) => {
                  const lineTotal = round2(it.unitPrice * it.quantity);
                  const isStockOut = it.availableStock <= 0;

                  return (
                    <div
                      key={it.itemId}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-600">
                            {it.code}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{it.name}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          {it.color && <span>{it.color}</span>}
                          {it.size && <span>مقاس {it.size}</span>}
                          {isStockOut && (
                            <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              <span>رصيد المخزن 0</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* أزرار الكمية وسعر الوحدة والإجمالي */}
                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="flex items-center border border-slate-200 rounded-xl bg-white shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(it.itemId, it.quantity - 1)}
                            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-slate-50 rounded-r-xl transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={it.quantity}
                            onChange={(e) =>
                              updateQuantity(it.itemId, Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-12 text-center text-sm font-bold text-slate-800 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(it.itemId, it.quantity + 1)}
                            className="p-1.5 text-slate-600 hover:text-[#14b8a6] hover:bg-slate-50 rounded-l-xl transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-left min-w-[90px]">
                          <span className="text-[10px] text-slate-400 block">
                            {formatCurrency(it.unitPrice)} للقطعة
                          </span>
                          <span className="text-sm font-black text-slate-900">
                            {formatCurrency(lineTotal)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFromCart(it.itemId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                          title="حذف البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* لوحة الحسابات والدفع (5 أعمدة) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-5 border-slate-200 space-y-5">
            {/* إجمالي الفاتورة بخط كبير */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between shadow-sm">
              <div>
                <span className="text-xs text-slate-400 block mb-1">المطلوب سداده</span>
                <span className="text-2xl sm:text-3xl font-black text-[#14b8a6]">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
              <button
                type="button"
                onClick={handlePayFullCash}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
              >
                سداد كاش كامل
              </button>
            </div>

            {/* الخصم والمجموع الفرعي */}
            <div className="space-y-3 text-sm border-b border-slate-100 pb-3">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>

              {/* قسم الخصم مع زر الاختيار بين نسبة أو مبلغ */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">خصم الفاتورة:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-white text-xs">
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                        discountType === 'fixed'
                          ? 'bg-[#14b8a6] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      مبلغ (ج)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                        discountType === 'percent'
                          ? 'bg-[#14b8a6] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      نسبة (%)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={discountType === 'percent' ? 'مثال: 10' : 'مثال: 50'}
                    value={discountInputStr}
                    onChange={(e) => setDiscountInputStr(e.target.value)}
                    className="flex-1 text-left bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                  />
                  {overallDiscount > 0 && (
                    <span className="text-xs font-extrabold text-rose-600 whitespace-nowrap">
                      خصم: -{formatCurrency(overallDiscount)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* خانات الدفع المتعددة */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-800 block">تفاصيل السداد والمحافظ:</span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-emerald-600" />
                    <span>نقدية (كاش)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={cashStr}
                    onChange={(e) => setCashStr(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-indigo-600" />
                    <span>إنستاباي</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={instapayStr}
                    onChange={(e) => setInstapayStr(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Smartphone className="w-3 h-3 text-rose-600" />
                    <span>فودافون كاش</span>
                  </label>
                  <input
                    type="text"
                    placeholder="0.00"
                    value={walletStr}
                    onChange={(e) => setWalletStr(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                  />
                </div>
              </div>

              {/* ملخص المتبقي آجل أو الباقي للعميل */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">إجمالي المدفوع:</span>
                  <span className="text-slate-900">{formatCurrency(totalPaid)}</span>
                </div>
                {remainingDebt > 0 ? (
                  <div className="flex justify-between text-rose-600 font-extrabold text-sm pt-1 border-t border-slate-200">
                    <span>المتبقي آجل (دين على العميل):</span>
                    <span>{formatCurrency(remainingDebt)}</span>
                  </div>
                ) : changeDue > 0 ? (
                  <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-slate-200">
                    <span>الباقي للعميل:</span>
                    <span>{formatCurrency(changeDue)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* قسم العميل (يظهر اسم وتليفون، ويصبح إلزامياً إذا كان هناك آجل) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#14b8a6]" />
                  <span>بيانات العميل</span>
                </span>
                {remainingDebt > 0 && (
                  <span className="text-[11px] text-rose-600 font-bold">* إلزامي لوجود آجل</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="اسم العميل"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required={remainingDebt > 0}
                />
                <Input
                  placeholder="رقم الهاتف"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required={remainingDebt > 0}
                />
              </div>
            </div>

            {/* زر حفظ الفاتورة */}
            <Button
              type="button"
              onClick={handleSaveInvoice}
              disabled={cart.length === 0}
              isLoading={isSubmitting}
              variant="primary"
              className="w-full py-4 text-base font-bold shadow-sm gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>حفظ وإصدار الفاتورة</span>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
