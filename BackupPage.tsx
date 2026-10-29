import React, { useState, useRef, useMemo } from 'react';
import { exportBackup, importBackup, createOpening } from '../../lib/data';
import { formatCurrency, parseArabicNumber, round2 } from '../../domain/money';
import { getCairoDate, getDayKey } from '../../domain/dates';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Banknote,
  CreditCard,
  Smartphone,
  Boxes,
  Users,
  ShieldCheck,
  Building,
} from 'lucide-react';

export const BackupPage: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isOpeningSubmitting, setIsOpeningSubmitting] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // مدخلات بداية جديدة (إعادة تأسيس)
  const [openCash, setOpenCash] = useState('');
  const [openBank, setOpenBank] = useState('');
  const [openWallet, setOpenWallet] = useState('');
  const [openInventoryVal, setOpenInventoryVal] = useState('');
  const [openReceivables, setOpenReceivables] = useState('');
  const [openLiabilities, setOpenLiabilities] = useState('');
  const [openNotes, setOpenNotes] = useState('');

  // حساب رأس المال الافتتاحي في الوقت الفعلي
  const calculatedCapital = useMemo(() => {
    const cash = parseArabicNumber(openCash);
    const bank = parseArabicNumber(openBank);
    const wallet = parseArabicNumber(openWallet);
    const inv = parseArabicNumber(openInventoryVal);
    const rec = parseArabicNumber(openReceivables);
    const liab = parseArabicNumber(openLiabilities);

    const totalWallets = cash + bank + wallet;
    return round2(totalWallets + inv + rec - liab);
  }, [openCash, openBank, openWallet, openInventoryVal, openReceivables, openLiabilities]);

  // تصدير نسخة احتياطية
  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      setErrorMsg(null);

      const jsonString = await exportBackup();
      const today = getDayKey(getCairoDate());
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mahally_backup_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg('تم تصدير وتحميل النسخة الاحتياطية بنجاح.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تصدير النسخة الاحتياطية');
    } finally {
      setIsExporting(false);
    }
  };

  // اختيار ملف النسخة واستيراده
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !window.confirm(
        'تحذير هام: سيتم مسح كافة البيانات الحالية واستبدالها بالبيانات الموجودة في ملف النسخة الاحتياطية. هل تريد المتابعة؟'
      )
    ) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsImporting(true);
      setErrorMsg(null);

      const text = await file.text();
      await importBackup(text);

      setSuccessMsg('تم استيراد كافة البيانات بنجاح واستعادة النظام.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل استيراد النسخة الاحتياطية');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // تأكيد بداية جديدة
  const handleCreateOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !window.confirm(
        `تأكيد البداية الجديدة: سيتم حفظ الرصيد الافتتاحي برأس مال ${formatCurrency(
          calculatedCapital
        )} وتحديث الخزائن. هل ترغب في بدء العمل؟`
      )
    ) {
      return;
    }

    try {
      setIsOpeningSubmitting(true);
      const capital = await createOpening({
        cash: parseArabicNumber(openCash),
        bank: parseArabicNumber(openBank),
        wallet: parseArabicNumber(openWallet),
        inventoryValue: parseArabicNumber(openInventoryVal),
        receivables: parseArabicNumber(openReceivables),
        liabilities: parseArabicNumber(openLiabilities),
        notes: openNotes.trim() || undefined,
      });

      setSuccessMsg(
        `تم تأسيس البداية الجديدة بنجاح ورأس المال الافتتاحي هو ${formatCurrency(capital)}.`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تأسيس البداية الجديدة');
    } finally {
      setIsOpeningSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* رأس الصفحة */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-[#14b8a6]" />
          <span>النسخ الاحتياطي وبداية جديدة</span>
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          حفظ وتصدير بياناتك محلياً بصيغة JSON، أو إعادة تأسيس الأرصدة الافتتاحية للمحل
        </p>
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

      {/* 1. قسم النسخ الاحتياطي (تصدير واستيراد) */}
      <Card className="p-6 border-slate-200 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-[#14b8a6]" />
          <div>
            <h2 className="text-base font-bold text-slate-900">النسخ الاحتياطي لبيانات النظام</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              احتفظ بنسخة من كافة الفواتير، الأصناف، العملاء، والخزائن على جهازك بأمان
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* تصدير نسخة */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="font-bold text-slate-800 text-sm block mb-1">
                تصدير نسخة احتياطية كاملة
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                تحميل ملف JSON كامل يحتوي على كل السجلات المحاسبية والمخزون حتى اللحظة.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleExportBackup}
              isLoading={isExporting}
              className="w-full gap-2 font-bold shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>تصدير وتحميل الملف</span>
            </Button>
          </div>

          {/* استيراد نسخة */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
            <div>
              <span className="font-bold text-slate-800 text-sm block mb-1">
                استيراد واستعادة نسخة احتياطية
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">
                رفع ملف JSON تم تصديره سابقاً لاسترجاع كافة البيانات واستبدال السجلات.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              isLoading={isImporting}
              className="w-full gap-2 font-bold bg-white text-slate-800 hover:bg-slate-100 border-slate-300"
            >
              <Upload className="w-4 h-4 text-[#14b8a6]" />
              <span>اختيار ملف والاستيراد</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. قسم بداية جديدة (إعادة تأسيس) */}
      <Card className="p-6 border-slate-200 space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <RefreshCw className="w-5 h-5 text-[#14b8a6]" />
          <div>
            <h2 className="text-base font-bold text-slate-900">بداية جديدة (إعادة تأسيس الأرصدة)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تهيئة الأرصدة الافتتاحية للمحل للبدء برأس مال تشغيلي جديد ومضبوط
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateOpening} className="space-y-5">
          {/* أرصدة الخزائن الافتتاحية */}
          <div>
            <span className="text-xs font-bold text-slate-700 block mb-2">
              الأرصدة النقدية الافتتاحية في الخزائن:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  <span>خزينة المحل (كاش)</span>
                </label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={openCash}
                  onChange={(e) => setOpenCash(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>البنك / إنستاباي</span>
                </label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={openBank}
                  onChange={(e) => setOpenBank(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-rose-600" />
                  <span>فودافون كاش</span>
                </label>
                <input
                  type="text"
                  placeholder="0.00"
                  value={openWallet}
                  onChange={(e) => setOpenWallet(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                />
              </div>
            </div>
          </div>

          {/* المخزون والديون والالتزامات */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-slate-400" />
                <span>قيمة المخزون الحالي (ج.م) — للعلم فقط، أضف الأصناف من شاشة الشراء بالدفع «من الجيب»:</span>
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={openInventoryVal}
                onChange={(e) => setOpenInventoryVal(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                <span>ديون العملاء المستحقة (ج.م) — للعلم فقط، سجّل كل عميل من شاشة العملاء:</span>
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={openReceivables}
                onChange={(e) => setOpenReceivables(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-rose-600" />
                <span>الالتزامات على المحل (ج.م):</span>
              </label>
              <input
                type="text"
                placeholder="0.00"
                value={openLiabilities}
                onChange={(e) => setOpenLiabilities(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
              />
            </div>
          </div>

          <Input
            label="ملاحظات التأسيس (اختياري)"
            placeholder="مثال: جرد بداية العام الجديد 2026..."
            value={openNotes}
            onChange={(e) => setOpenNotes(e.target.value)}
          />

          {/* عرض رأس المال الافتتاحي المحسوب */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-2xs">
            <div>
              <span className="text-xs text-slate-400 block mb-0.5">
                رأس المال الافتتاحي المحسوب (Capital):
              </span>
              <span className="text-xl sm:text-2xl font-black text-[#14b8a6]">
                {formatCurrency(calculatedCapital)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 text-left max-w-[200px] hidden sm:block">
              الخزائن + المخزون + الديون - الالتزامات
            </p>
          </div>

          {/* زر بدء العمل */}
          <Button
            type="submit"
            variant="primary"
            isLoading={isOpeningSubmitting}
            className="w-full py-4 text-base font-bold shadow-sm gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>بدء العمل وتثبيت الأرصدة الافتتاحية</span>
          </Button>
        </form>
      </Card>
    </div>
  );
};
