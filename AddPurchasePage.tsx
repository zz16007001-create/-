import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SETTINGS } from '../../lib/settings';
import { calculateProfitMargin } from '../../domain/profit';
import { createPurchase } from '../../lib/data';
import { parseArabicNumber, round2, formatCurrency } from '../../domain/money';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LabelPrintModal, PrintableLabelItem } from '../items/LabelPrintModal';
import {
  PackagePlus,
  Plus,
  Trash2,
  CheckCircle2,
  Eye,
  AlertCircle,
  Footprints,
  ShoppingBag,
  Sparkles,
  Printer,
  ArrowRight,
} from 'lucide-react';

interface SizeRow {
  size: number | string;
  quantity: number;
}

interface BagVariantRow {
  color: string;
  quantity: number;
}

export const AddPurchasePage: React.FC = () => {
  const navigate = useNavigate();

  // القسم
  const [category, setCategory] = useState<'shoes' | 'bags' | 'accessories'>('shoes');

  // البيانات العامة للبضاعة
  const [description, setDescription] = useState('');
  const [purchaseCostStr, setPurchaseCostStr] = useState('');
  const [sellPriceStr, setSellPriceStr] = useState('');
  const [supplierName, setSupplierName] = useState('');

  // إدارة الألوان
  const [colorLetters, setColorLetters] = useState<Record<string, string>>(DEFAULT_SETTINGS.colorLetters);
  const [selectedColor, setSelectedColor] = useState<string>('أسود');

  // نافذة إضافة لون جديد
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorLetter, setNewColorLetter] = useState('');

  // صفوف المقاسات للأحذية
  const [sizeRows, setSizeRows] = useState<SizeRow[]>([
    { size: 37, quantity: 1 },
    { size: 38, quantity: 1 },
    { size: 39, quantity: 1 },
  ]);

  // صفوف الألوان والكميات للشنط والإكسسوارات
  const [bagRows, setBagRows] = useState<BagVariantRow[]>([
    { color: 'أسود', quantity: 2 },
  ]);

  // طريقة ومصدر الدفع
  const [paymentSource, setPaymentSource] = useState<'cash' | 'instapay' | 'wallet' | 'pocket'>('cash');

  // حالات الإرسال والرسائل
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // حالة طباعة ملصقات البضاعة المضافة
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [createdItemsForPrint, setCreatedItemsForPrint] = useState<PrintableLabelItem[]>([]);

  // حساب الأرقام ونسبة الربح
  const cost = parseArabicNumber(purchaseCostStr);
  const sell = parseArabicNumber(sellPriceStr);

  const profitMargin = useMemo(() => {
    if (cost > 0 && sell > 0) {
      return calculateProfitMargin(cost, sell);
    }
    return null;
  }, [cost, sell]);

  // إضافة لون جديد للقائمة
  const handleAddCustomColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorName.trim() || !newColorLetter.trim()) return;

    const trimmedName = newColorName.trim();
    const upperLetter = newColorLetter.trim().toUpperCase();

    setColorLetters((prev) => ({
      ...prev,
      [trimmedName]: upperLetter,
    }));
    setSelectedColor(trimmedName);
    setNewColorName('');
    setNewColorLetter('');
    setIsColorModalOpen(false);
  };

  // التحكم في صفوف المقاسات للأحذية
  const addSizeRow = () => {
    const lastSize = Number(sizeRows[sizeRows.length - 1]?.size) || 36;
    setSizeRows((prev) => [...prev, { size: lastSize + 1, quantity: 1 }]);
  };

  const removeSizeRow = (index: number) => {
    setSizeRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateSizeRow = (index: number, field: keyof SizeRow, value: any) => {
    setSizeRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // التحكم في صفوف الشنط والإكسسوارات
  const addBagRow = () => {
    setBagRows((prev) => [...prev, { color: selectedColor, quantity: 1 }]);
  };

  const removeBagRow = (index: number) => {
    setBagRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateBagRow = (index: number, field: keyof BagVariantRow, value: any) => {
    setBagRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // معاينة الأكواد التي سيتم توليدها
  const previewCodes = useMemo(() => {
    const colorCode = colorLetters[selectedColor] || selectedColor.charAt(0).toUpperCase() || 'X';

    if (category === 'shoes') {
      return sizeRows
        .filter((r) => r.quantity > 0)
        .map((r) => `S?-${colorCode}${r.size}`);
    } else {
      return bagRows
        .filter((r) => r.quantity > 0)
        .map((r) => {
          const cCode = colorLetters[r.color] || r.color.charAt(0).toUpperCase() || 'X';
          return category === 'bags' ? `B?-${cCode}` : `ACC?-${cCode}`;
        });
    }
  }, [category, sizeRows, bagRows, selectedColor, colorLetters]);

  // إجمالي الكمية وإجمالي التكلفة
  const totalQuantity = useMemo(() => {
    if (category === 'shoes') {
      return sizeRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    }
    return bagRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  }, [category, sizeRows, bagRows]);

  const totalCost = round2(totalQuantity * cost);

  // إرسال البيانات وحفظ الفاتورة
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!description.trim()) {
      setErrorMsg('يرجى كتابة وصف أو اسم الصنف (إلزامي)');
      return;
    }
    if (cost <= 0) {
      setErrorMsg('يرجى تحديد سعر شراء صحيح أكبر من صفر');
      return;
    }
    if (sell <= 0) {
      setErrorMsg('يرجى تحديد سعر بيع صحيح أكبر من صفر');
      return;
    }
    if (totalQuantity <= 0) {
      setErrorMsg('يرجى إضافة كمية صحيحة واحدة على الأقل');
      return;
    }

    try {
      setIsSubmitting(true);

      const itemsToCreate =
        category === 'shoes'
          ? sizeRows
              .filter((r) => Number(r.quantity) > 0)
              .map((r) => ({
                name: `${description.trim()} - مقاس ${r.size}`,
                category,
                color: selectedColor,
                colorLetter: colorLetters[selectedColor],
                size: r.size,
                quantity: Number(r.quantity),
                purchaseCost: cost,
                sellPrice: sell,
              }))
          : bagRows
              .filter((r) => Number(r.quantity) > 0)
              .map((r) => ({
                name: `${description.trim()} - ${r.color}`,
                category,
                color: r.color,
                colorLetter: colorLetters[r.color],
                quantity: Number(r.quantity),
                purchaseCost: cost,
                sellPrice: sell,
              }));

      const res = await createPurchase({
        supplierName: supplierName.trim() || undefined,
        paymentSource,
        paidAmount: totalCost,
        items: itemsToCreate,
      });

      // إعداد قائمة الأصناف للطباعة الفورية مع الأكواد
      const printable: PrintableLabelItem[] = itemsToCreate.map((it: any, idx: number) => ({
        code: res.codes[idx], // الكود الفعلي المحفوظ (مصدر واحد للحقيقة)
        name: it.name,
        color: it.color,
        size: it.size,
        sellPrice: it.sellPrice,
        quantity: it.quantity,
      }));

      setCreatedItemsForPrint(printable);
      setSuccessMsg(`تم حفظ بضاعة جديدة بنجاح (موديل رقم ${res.modelNo})`);
      // تفريغ النموذج بعد الحفظ لمنع تكرار الفاتورة بضغطة ثانية
      setDescription('');
      setPurchaseCostStr('');
      setSellPriceStr('');
      setSupplierName('');
      setSizeRows([
        { size: 37, quantity: 1 },
        { size: 38, quantity: 1 },
        { size: 39, quantity: 1 },
      ]);
      setBagRows([{ color: 'أسود', quantity: 2 }]);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ البضاعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* عنوان الصفحة */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-[#14b8a6]" />
            <span>إضافة بضاعة جديدة (فاتورة شراء)</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            تسجيل وصول موديل جديد وتوليد الأكواد وإضافتها إلى المخزون
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsPrintModalOpen(true)}
              className="gap-1.5 font-bold shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ملصقات لهذه الإضافة</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/items')}
              className="gap-1.5 bg-white text-slate-700 hover:bg-slate-50"
            >
              <span>الانتقال للمخزون</span>
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* اختيار القسم (تبويبات Tabs) */}
        <Card className="p-2 border-slate-200">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setCategory('shoes')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                category === 'shoes'
                  ? 'bg-[#14b8a6] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Footprints className="w-4 h-4" />
              <span>أحذية</span>
            </button>

            <button
              type="button"
              onClick={() => setCategory('bags')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                category === 'bags'
                  ? 'bg-[#14b8a6] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>شنط</span>
            </button>

            <button
              type="button"
              onClick={() => setCategory('accessories')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                category === 'accessories'
                  ? 'bg-[#14b8a6] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>إكسسوارات</span>
            </button>
          </div>
        </Card>

        {/* البيانات الأساسية للموديل والأسعار */}
        <Card className="p-5 border-slate-200 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
            بيانات الموديل والأسعار
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="الوصف / اسم الموديل (إلزامي)"
              placeholder="مثال: كوتشي جلد طبيعي مستورد"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />

            <Input
              label="اسم المورد (اختياري)"
              placeholder="مثال: مصنع النور / مستورد دبي"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <Input
              label="سعر الشراء (للقطعة الواحدة)"
              type="text"
              placeholder="0.00"
              value={purchaseCostStr}
              onChange={(e) => setPurchaseCostStr(e.target.value)}
              required
            />

            <Input
              label="سعر البيع المقترح (للقطعة)"
              type="text"
              placeholder="0.00"
              value={sellPriceStr}
              onChange={(e) => setSellPriceStr(e.target.value)}
              required
            />
          </div>

          {/* صندوق نسبة الربح يظهر فوراً عند كتابة السعرين */}
          {profitMargin !== null && (
            <div
              className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between transition-colors ${
                profitMargin >= 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span>نسبة الربح: {profitMargin}%</span>
              <span className="text-xs font-medium">
                {profitMargin >= 0
                  ? `(مكسب ${round2(sell - cost)} ج.م للقطعة)`
                  : `(خسارة ${round2(cost - sell)} ج.م للقطعة)`}
              </span>
            </div>
          )}

          {/* اختيار اللون الرئيسي (للأحذية) أو الافتراضي */}
          {category === 'shoes' && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                اللون الأساسي للحذاء
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20"
                >
                  {Object.entries(colorLetters).map(([name, letter]) => (
                    <option key={name} value={name}>
                      {name} (كود: {letter})
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsColorModalOpen(true)}
                  className="gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>لون جديد</span>
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* صفوف المقاسات أو الألوان */}
        <Card className="p-5 border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-800">
              {category === 'shoes' ? 'المقاسات والكميات' : 'الألوان والكميات'}
            </h2>

            {category === 'shoes' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSizeRow}
                className="gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة مقاس</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBagRow}
                className="gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة لون</span>
              </Button>
            )}
          </div>

          {/* محتوى صفوف الأحذية */}
          {category === 'shoes' && (
            <div className="space-y-3">
              {sizeRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="w-1/2">
                    <label className="text-xs text-slate-500 mb-1 block">المقاس</label>
                    <input
                      type="number"
                      value={row.size}
                      onChange={(e) => updateSizeRow(idx, 'size', Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center font-bold"
                    />
                  </div>

                  <div className="w-1/2">
                    <label className="text-xs text-slate-500 mb-1 block">الكمية</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateSizeRow(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center font-bold"
                    />
                  </div>

                  <div className="pt-5">
                    <button
                      type="button"
                      disabled={sizeRows.length <= 1}
                      onClick={() => removeSizeRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg transition-colors"
                      title="حذف السطر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* محتوى صفوف الشنط والإكسسوارات */}
          {category !== 'shoes' && (
            <div className="space-y-3">
              {bagRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="w-1/2">
                    <label className="text-xs text-slate-500 mb-1 block">اللون</label>
                    <select
                      value={row.color}
                      onChange={(e) => updateBagRow(idx, 'color', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium"
                    >
                      {Object.entries(colorLetters).map(([name, letter]) => (
                        <option key={name} value={name}>
                          {name} ({letter})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-1/2">
                    <label className="text-xs text-slate-500 mb-1 block">الكمية</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateBagRow(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-center font-bold"
                    />
                  </div>

                  <div className="pt-5">
                    <button
                      type="button"
                      disabled={bagRows.length <= 1}
                      onClick={() => removeBagRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg transition-colors"
                      title="حذف السطر"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* إجمالي الكميات والتكلفة */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-sm">
            <span className="text-slate-600">
              إجمالي القطع: <strong className="text-slate-900">{totalQuantity} قطعة</strong>
            </span>
            <span className="text-slate-600">
              إجمالي التكلفة المطلوبة:{' '}
              <strong className="text-[#14b8a6] text-base">{formatCurrency(totalCost)}</strong>
            </span>
          </div>
        </Card>

        {/* طريقة ومصدر الدفع */}
        <Card className="p-5 border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
            مصدر وطريقة الدفع
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'cash', label: 'نقدية (خزينة المحل)' },
              { id: 'instapay', label: 'إنستاباي (البنك)' },
              { id: 'wallet', label: 'فودافون كاش' },
              { id: 'pocket', label: 'من الجيب الشخصي' },
            ].map((method) => {
              const isSelected = paymentSource === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentSource(method.id as any)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                    isSelected
                      ? 'border-[#14b8a6] bg-[#14b8a6]/10 text-[#0d9488]'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {method.label}
                </button>
              );
            })}
          </div>
        </Card>

        {/* معاينة الأكواد التي سيتم توليدها */}
        {previewCodes.length > 0 && (
          <Card className="p-4 border-slate-200 bg-slate-50/60">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-700">
              <Eye className="w-4 h-4 text-[#14b8a6]" />
              <span>معاينة الأكواد المتوقعة للأصناف:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {previewCodes.map((code, i) => (
                <span
                  key={i}
                  className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 shadow-2xs"
                >
                  {code}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* زر الحفظ النهائي */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            className="w-full py-3.5 text-base shadow-sm gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>حفظ البضاعة وإضافتها إلى المخزون</span>
          </Button>
        </div>
      </form>

      {/* نافذة إضافة لون جديد */}
      <Modal
        isOpen={isColorModalOpen}
        onClose={() => setIsColorModalOpen(false)}
        title="إضافة لون جديد ورمزه"
      >
        <form onSubmit={handleAddCustomColor} className="space-y-4">
          <Input
            label="اسم اللون بالعربية"
            placeholder="مثال: بترولي"
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
            required
          />

          <Input
            label="رمز أو حرف اللون (بالإنجليزية)"
            placeholder="مثال: PET أو P"
            maxLength={4}
            value={newColorLetter}
            onChange={(e) => setNewColorLetter(e.target.value)}
            required
          />

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsColorModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="sm">
              إضافة اللون
            </Button>
          </div>
        </form>
      </Modal>

      {/* نافذة طباعة ملصقات البضاعة المضافة */}
      {isPrintModalOpen && createdItemsForPrint.length > 0 && (
        <LabelPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          items={createdItemsForPrint}
        />
      )}
    </div>
  );
};
