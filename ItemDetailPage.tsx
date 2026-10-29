import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { updateItemDetails, archiveItem, adjustStock, fixItemCost, cancelPurchase } from '../../lib/data';
import { calculateProfitMargin } from '../../domain/profit';
import { formatCurrency, parseArabicNumber, round2 } from '../../domain/money';
import { formatDate } from '../../domain/dates';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { LabelPrintModal } from './LabelPrintModal';
import {
  ArrowRight,
  Boxes,
  Edit,
  ClipboardList,
  Archive,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Tag,
  Palette,
  Ruler,
  TrendingUp,
  Receipt,
  Printer,
} from 'lucide-react';

export const ItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // حالة نافذة التعديل
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editSellPrice, setEditSellPrice] = useState('');
  const [editMinAlert, setEditMinAlert] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // حالة نافذة الجرد
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [countedQtyStr, setCountedQtyStr] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [isSavingAdjust, setIsSavingAdjust] = useState(false);

  // حالة الأرشفة
  const [isArchiving, setIsArchiving] = useState(false);

  // حالة نافذة طباعة الملصقات
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  // الاستماع للصنف في فايرستور
  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, 'items', id),
      (snap) => {
        if (snap.exists()) {
          const data: any = { id: snap.id, ...snap.data() };
          setItem(data);
          setEditName(data.name || '');
          setEditColor(data.color || '');
          setEditSize(String(data.size || ''));
          setEditSellPrice(String(data.sellPrice || ''));
          setEditMinAlert(String(data.minStockAlert ?? 5));
          setCountedQtyStr(String(data.currentStock ?? 0));
        } else {
          setErrorMsg('لم يتم العثور على هذا الصنف في النظام');
        }
        setLoading(false);
      },
      (err) => {
        setErrorMsg('فشل تحميل بيانات الصنف: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // حساب هامش الربح
  const profitMargin = useMemo(() => {
    if (!item) return 0;
    const cost = Number(item.costPrice) || 0;
    const sell = Number(item.sellPrice) || 0;
    return calculateProfitMargin(cost, sell);
  }, [item]);

  // حساب فرق الجرد في النافذة المنبثقة
  const countedQty = parseArabicNumber(countedQtyStr);
  const currentStock = item ? Number(item.currentStock ?? 0) : 0;
  const stockDiff = round2(countedQty - currentStock);
  const costImpact = item ? round2(stockDiff * Number(item.costPrice ?? 0)) : 0;

  // حفظ التعديلات
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setErrorMsg(null);

    const sellPrice = parseArabicNumber(editSellPrice);
    if (sellPrice <= 0) {
      setErrorMsg('سعر البيع يجب أن يكون أكبر من صفر');
      return;
    }

    try {
      setIsSavingEdit(true);
      await updateItemDetails(id, {
        name: editName.trim(),
        color: editColor.trim(),
        size: editSize.trim(),
        sellPrice,
        minStockAlert: Number(editMinAlert) || 5,
      });

      setSuccessMsg('تم تحديث بيانات الصنف بنجاح');
      setIsEditOpen(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ التعديلات');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // تأكيد تسوية الجرد
  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setErrorMsg(null);

    try {
      setIsSavingAdjust(true);
      const res = await adjustStock(id, countedQty, adjustNote);
      setSuccessMsg(`تمت تسوية الجرد بنجاح (الفرق: ${res.differenceQty > 0 ? '+' : ''}${res.differenceQty})`);
      setIsAdjustOpen(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تسوية الجرد');
    } finally {
      setIsSavingAdjust(false);
    }
  };

  // أرشفة الصنف
  const handleFixCost = async () => {
    if (!id || !item) return;
    const input = window.prompt('أدخل سعر الشراء الصحيح للقطعة:', String(item.costPrice ?? ''));
    if (input === null) return;
    const val = parseFloat(input.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(',', '.'));
    try {
      await fixItemCost(id, val);
      setSuccessMsg('تم تصحيح سعر الشراء');
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تصحيح السعر');
    }
  };

  const handleCancelPurchase = async () => {
    if (!item?.purchaseId) return;
    if (!window.confirm('إلغاء فاتورة الشراء بالكامل؟ ستُصفَّر أصنافها ويُرجَع المبلغ المدفوع للخزينة.')) return;
    try {
      await cancelPurchase(item.purchaseId);
      navigate('/items');
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل إلغاء فاتورة الشراء');
    }
  };

  const handleArchive = async () => {
    if (!id || !item) return;
    if (item.currentStock > 0) {
      setErrorMsg('يجب تصفير الكمية أولاً لتتمكن من أرشفة الصنف');
      return;
    }

    if (!window.confirm('هل أنت متأكد من رغبتك في أرشفة هذا الصنف؟')) {
      return;
    }

    try {
      setIsArchiving(true);
      await archiveItem(id);
      navigate('/items');
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل أرشفة الصنف');
      setIsArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-3">جاري تحميل بيانات الصنف...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <Card className="p-8">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">الصنف غير موجود</h2>
          <Button onClick={() => navigate('/items')} variant="outline" className="mt-4 gap-2">
            <ArrowRight className="w-4 h-4" />
            <span>العودة للمخزون</span>
          </Button>
        </Card>
      </div>
    );
  }

  const isLowStock = item.currentStock <= (item.minStockAlert ?? 5);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* الشريط العلوي وأزرار التحكم */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/items')}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="رجوع للمخزون"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">{item.name}</h1>
              {!item.isActive && (
                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">
                  مؤرشف
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              الكود: {item.code || item.barcode}
            </p>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setIsEditOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Edit className="w-4 h-4 text-[#14b8a6]" />
            <span>تعديل</span>
          </Button>

          <Button
            onClick={() => setIsAdjustOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            <span>جرد</span>
          </Button>

          <Button
            onClick={() => setIsLabelModalOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            <span>طباعة ملصقات</span>
          </Button>

          <Button onClick={handleFixCost} variant="outline" size="sm" className="gap-1.5">
            <span>تصحيح سعر الشراء</span>
          </Button>

          {item.purchaseId && (
            <Button
              onClick={handleCancelPurchase}
              variant="outline"
              size="sm"
              className="gap-1.5 text-rose-600 hover:bg-rose-50 border-rose-200"
            >
              <span>إلغاء فاتورة الشراء</span>
            </Button>
          )}

          <Button
            onClick={handleArchive}
            variant="outline"
            size="sm"
            disabled={item.currentStock > 0 || isArchiving}
            title={item.currentStock > 0 ? 'يجب تصفير الكمية أولاً' : 'أرشفة الصنف'}
            className="gap-1.5 text-rose-600 hover:bg-rose-50 border-rose-200 disabled:opacity-40"
          >
            <Archive className="w-4 h-4" />
            <span>أرشفة</span>
          </Button>
        </div>
      </div>

      {item.currentStock > 0 && (
        <div className="text-[11px] text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 inline-block">
          * تنبيه الأرشفة: زر الأرشفة معطل تلقائياً طالما أن هناك رصيد متاح في المخزن ({item.currentStock} قطعة).
        </div>
      )}

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

      {/* بطاقات البيانات الأساسية والمالية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* بطاقة الكمية */}
        <Card className="p-5 border-slate-200">
          <span className="text-xs font-medium text-slate-400 block mb-1">الرصيد المتاح بالمخزن</span>
          <div
            className={`flex items-baseline gap-2 text-2xl font-black ${
              isLowStock ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {isLowStock && <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 self-center" />}
            <span>{item.currentStock}</span>
            <span className="text-xs font-normal text-slate-500">{item.unit || 'قطعة'}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            حد التنبيه الأدنى: {item.minStockAlert ?? 5} قطعة
          </p>
        </Card>

        {/* بطاقة الأسعار */}
        <Card className="p-5 border-slate-200">
          <span className="text-xs font-medium text-slate-400 block mb-1">الأسعار والبيع</span>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">سعر البيع</span>
              <span className="text-lg font-extrabold text-[#14b8a6]">
                {formatCurrency(item.sellPrice)}
              </span>
            </div>
            <div className="text-left">
              <span className="text-[11px] text-slate-400 block">سعر الشراء (التكلفة)</span>
              <span className="text-base font-bold text-slate-700">
                {formatCurrency(item.costPrice)}
              </span>
            </div>
          </div>
        </Card>

        {/* بطاقة نسبة الربح */}
        <Card
          className={`p-5 border ${
            profitMargin >= 0
              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="text-xs font-medium block mb-1 opacity-80">هامش الربح على التكلفة</span>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-2xl font-black">
              <TrendingUp className="w-5 h-5" />
              <span>{profitMargin}%</span>
            </div>
            <span className="text-xs font-medium opacity-90">
              {profitMargin >= 0
                ? `+${round2(item.sellPrice - item.costPrice)} ج.م / قطعة`
                : `${round2(item.sellPrice - item.costPrice)} ج.م / قطعة`}
            </span>
          </div>
        </Card>
      </div>

      {/* تفاصيل المواصفات */}
      <Card className="p-6 border-slate-200 space-y-4">
        <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
          مواصفات الصنف وسجل البيانات
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-400 block mb-1">القسم / التصنيف</span>
            <span className="font-semibold text-slate-800">{item.categoryName || item.category || 'عام'}</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">اللون</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Palette className="w-3.5 h-3.5 text-slate-400" />
              <span>{item.color || 'غير محدد'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">المقاس</span>
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Ruler className="w-3.5 h-3.5 text-slate-400" />
              <span>{item.size || 'غير محدد'}</span>
            </div>
          </div>

          <div>
            <span className="text-xs text-slate-400 block mb-1">تاريخ الإضافة</span>
            <span className="font-medium text-slate-600">
              {item.createdAt ? formatDate(item.createdAt, false) : '-'}
            </span>
          </div>
        </div>
      </Card>

      {/* نافذة التعديل */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="تعديل بيانات الصنف"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
            <span>كود الصنف وسعر الشراء محميان ولا يمكن تعديلهما للحفاظ على سلامة القيود.</span>
          </div>

          <Input
            label="اسم / وصف الصنف"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="اللون"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
            />

            <Input
              label="المقاس"
              value={editSize}
              onChange={(e) => setEditSize(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="سعر البيع"
              type="text"
              value={editSellPrice}
              onChange={(e) => setEditSellPrice(e.target.value)}
              required
            />

            <Input
              label="حد التنبيه للأصناف"
              type="number"
              min="0"
              value={editMinAlert}
              onChange={(e) => setEditMinAlert(e.target.value)}
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingEdit}
            >
              حفظ التعديلات
            </Button>
          </div>
        </form>
      </Modal>

      {/* نافذة تسوية الجرد */}
      <Modal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title="تسوية جرد الصنف"
      >
        <form onSubmit={handleConfirmAdjust} className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
            <span className="text-slate-600">الرصيد المسجل في النظام:</span>
            <span className="font-bold text-slate-900">{currentStock} قطعة</span>
          </div>

          <Input
            label="الكمية الفعلية المعدودة في المخزن"
            type="number"
            min="0"
            value={countedQtyStr}
            onChange={(e) => setCountedQtyStr(e.target.value)}
            required
          />

          {/* عرض الفرق وتأثير التكلفة قبل التأكيد */}
          <div
            className={`p-3 rounded-xl border text-xs font-bold space-y-1 ${
              stockDiff === 0
                ? 'bg-slate-50 border-slate-200 text-slate-700'
                : stockDiff > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex justify-between">
              <span>فرق الكمية:</span>
              <span>{stockDiff > 0 ? `+${stockDiff}` : stockDiff} قطعة</span>
            </div>
            <div className="flex justify-between">
              <span>أثر التكلفة على رأس المال:</span>
              <span>{formatCurrency(costImpact)}</span>
            </div>
          </div>

          <Input
            label="ملاحظات / سبب التسوية"
            placeholder="مثال: جرد دوري، عجز طبيعي، تالف..."
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
          />

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAdjustOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSavingAdjust}
            >
              تأكيد التسوية
            </Button>
          </div>
        </form>
      </Modal>

      {/* نافذة طباعة ملصق الصنف */}
      {isLabelModalOpen && (
        <LabelPrintModal
          isOpen={isLabelModalOpen}
          onClose={() => setIsLabelModalOpen(false)}
          items={[
            {
              id: item.id,
              code: item.code || item.barcode,
              name: item.name,
              color: item.color,
              size: item.size,
              sellPrice: item.sellPrice,
              quantity: item.currentStock > 0 ? item.currentStock : 1,
            },
          ]}
        />
      )}
    </div>
  );
};
