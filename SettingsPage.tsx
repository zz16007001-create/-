import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { DEFAULT_SETTINGS, StoreSettings } from '../../lib/settings';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import {
  Settings as SettingsIcon,
  Store,
  Wallet,
  Sliders,
  DollarSign,
  Palette,
  Lock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';

interface LiabilityItem {
  id: string;
  name: string;
  amount: number;
}

interface WalletConfigItem {
  id: string;
  name: string;
  enabled: boolean;
}

export const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. بيانات المحل
  const [storeName, setStoreName] = useState(DEFAULT_SETTINGS.storeName);
  const [storePhone, setStorePhone] = useState(DEFAULT_SETTINGS.phone);
  const [storeAddress, setStoreAddress] = useState(DEFAULT_SETTINGS.address);

  // 2. الخزائن
  const [wallets, setWallets] = useState<WalletConfigItem[]>([
    { id: 'cash', name: 'خزينة المحل (نقدية / كاش)', enabled: true },
    { id: 'bank', name: 'الحساب البنكي / إنستاباي', enabled: true },
    { id: 'wallet', name: 'محفظة إلكترونية / فودافون كاش', enabled: true },
  ]);
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');

  // 3. إعدادات عامة
  const [lowStockDefault, setLowStockDefault] = useState(DEFAULT_SETTINGS.lowStockThreshold);
  const [mismatchThreshold, setMismatchThreshold] = useState(DEFAULT_SETTINGS.mismatchThreshold);

  // 4. الالتزامات (مستحقات على المحل)
  const [liabilities, setLiabilities] = useState<LiabilityItem[]>([]);

  // 5. حروف الألوان
  const [colorLetters, setColorLetters] = useState<Record<string, string>>(
    DEFAULT_SETTINGS.colorLetters
  );
  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorLetter, setNewColorLetter] = useState('');

  // 6. الشهر المقفول حالياً (Read-only)
  const [lockedThroughMonth, setLockedThroughMonth] = useState<string>('لا يوجد أشهر مقفلة');

  useEffect(() => {
    setLoading(true);
    // جلب مستند الإعدادات meta/settings
    const settingsRef = doc(db, 'meta', 'settings');

    const unsubscribe = onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.storeName) setStoreName(data.storeName);
          if (data.phone) setStorePhone(data.phone);
          if (data.address) setStoreAddress(data.address);
          if (data.lowStockDefault !== undefined) setLowStockDefault(Number(data.lowStockDefault));
          if (data.mismatchThreshold !== undefined) setMismatchThreshold(Number(data.mismatchThreshold));
          if (data.wallets) setWallets(data.wallets);
          if (data.liabilities) setLiabilities(data.liabilities);
          if (data.colorLetters) setColorLetters(data.colorLetters);
          if (data.lockedThroughMonth) setLockedThroughMonth(data.lockedThroughMonth);
        } else {
          // جلب أيضاً من settings/general كـ fallback
          const genRef = doc(db, 'settings', 'general');
          onSnapshot(genRef, (genSnap) => {
            if (genSnap.exists()) {
              const genData = genSnap.data();
              if (genData.lockedThroughMonth) setLockedThroughMonth(genData.lockedThroughMonth);
            }
          });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Settings listener error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // إضافة خزينة جديدة
  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;

    const id = `wallet_${Date.now()}`;
    setWallets((prev) => [...prev, { id, name: newWalletName.trim(), enabled: true }]);
    setNewWalletName('');
    setIsAddWalletModalOpen(false);
  };

  // تبديل تفعيل الخزينة
  const toggleWallet = (id: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  // إدارة الالتزامات
  const addLiability = () => {
    setLiabilities((prev) => [
      ...prev,
      { id: `liab_${Date.now()}`, name: '', amount: 0 },
    ]);
  };

  const removeLiability = (id: string) => {
    setLiabilities((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLiability = (id: string, field: 'name' | 'amount', value: any) => {
    setLiabilities((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  // إدارة الألوان
  const updateColorLetter = (colorName: string, letter: string) => {
    setColorLetters((prev) => ({
      ...prev,
      [colorName]: letter.trim().toUpperCase(),
    }));
  };

  const handleAddColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorName.trim() || !newColorLetter.trim()) return;

    setColorLetters((prev) => ({
      ...prev,
      [newColorName.trim()]: newColorLetter.trim().toUpperCase(),
    }));
    setNewColorName('');
    setNewColorLetter('');
    setIsAddColorModalOpen(false);
  };

  const removeColor = (colorName: string) => {
    setColorLetters((prev) => {
      const copy = { ...prev };
      delete copy[colorName];
      return copy;
    });
  };

  // حفظ الإعدادات في Firestore (meta/settings و settings/general)
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        storeName: storeName.trim(),
        phone: storePhone.trim(),
        address: storeAddress.trim(),
        lowStockDefault: Number(lowStockDefault) || 5,
        mismatchThreshold: Number(mismatchThreshold) || 50,
        wallets,
        liabilities: liabilities.filter((l) => l.name.trim() && l.amount > 0),
        colorLetters,
        updatedAt: Date.now(),
      };

      // الحفظ في meta/settings مع merge
      await setDoc(doc(db, 'meta', 'settings'), payload, { merge: true });

      // تزامن مع settings/general
      await setDoc(doc(db, 'settings', 'general'), payload, { merge: true });

      setSuccessMsg('تم حفظ كافة الإعدادات بنجاح');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-4">جاري تحميل إعدادات النظام...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* رأس الصفحة وزر الحفظ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-[#14b8a6]" />
            <span>إعدادات النظام</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            تخصيص بيانات المتجر، الخزائن، الحسابات، وقواعد التنبيه
          </p>
        </div>

        <Button
          onClick={handleSaveSettings}
          isLoading={isSaving}
          variant="primary"
          className="shadow-sm gap-2 self-start sm:self-auto py-3 px-6"
        >
          <Save className="w-4 h-4" />
          <span>حفظ الإعدادات</span>
        </Button>
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

      {/* 1. بيانات المحل */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Store className="w-5 h-5 text-[#14b8a6]" />
          <h2 className="text-sm font-bold text-slate-800">بيانات المحل الأساسية</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="اسم المحل / المتجر"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            required
          />

          <Input
            label="رقم الهاتف للتواصل"
            value={storePhone}
            onChange={(e) => setStorePhone(e.target.value)}
          />

          <div className="sm:col-span-2">
            <Input
              label="العنوان / الفرع"
              value={storeAddress}
              onChange={(e) => setStoreAddress(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* 2. الخزائن */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#14b8a6]" />
            <h2 className="text-sm font-bold text-slate-800">الخزائن وطرق الدفع</h2>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddWalletModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة خزينة جديدة</span>
          </Button>
        </div>

        <div className="space-y-2">
          {wallets.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">{w.name}</span>
                <span className="font-mono text-xs text-slate-400">({w.id})</span>
              </div>

              {/* مفتاح Toggle لتفعيل/تعطيل الخزينة */}
              <button
                type="button"
                onClick={() => toggleWallet(w.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  w.enabled ? 'bg-[#14b8a6]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    w.enabled ? '-translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. إعدادات عامة وتنبيهات الأمان */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Sliders className="w-5 h-5 text-[#14b8a6]" />
          <h2 className="text-sm font-bold text-slate-800">حدود التنبيهات والأمان</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Input
              label="حد التنبيه الافتراضي لرصيد الصنف بالمخزن (lowStockDefault)"
              type="number"
              min="1"
              value={lowStockDefault}
              onChange={(e) => setLowStockDefault(Number(e.target.value))}
              hint="الأصناف التي يقل رصيدها عن هذا الرقم تظهر باللون الأحمر"
            />
          </div>

          <div>
            <Input
              label="حد تنبيه فرق الربح المسموح به (mismatchThreshold)"
              type="number"
              min="0"
              value={mismatchThreshold}
              onChange={(e) => setMismatchThreshold(Number(e.target.value))}
              hint="القيمة الافتراضية 50 ج.م؛ عند تجاوز الفرق يظهر تنبيه الميسماتش"
            />
          </div>
        </div>
      </Card>

      {/* 4. الالتزامات (Liabilities) */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#14b8a6]" />
            <h2 className="text-sm font-bold text-slate-800">الالتزامات والديون على المحل</h2>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLiability}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة التزام</span>
          </Button>
        </div>

        {liabilities.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            لا توجد التزامات مسجلة على المحل حالياً.
          </p>
        ) : (
          <div className="space-y-2">
            {liabilities.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="اسم الالتزام (مثال: مستحق لمورد أو قسط)"
                  value={item.name}
                  onChange={(e) => updateLiability(item.id, 'name', e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-[#14b8a6]"
                />
                <div className="w-36">
                  <input
                    type="number"
                    min="0"
                    placeholder="المبلغ (ج.م)"
                    value={item.amount || ''}
                    onChange={(e) =>
                      updateLiability(item.id, 'amount', Number(e.target.value) || 0)
                    }
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:border-[#14b8a6]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLiability(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 5. حروف الألوان */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#14b8a6]" />
            <h2 className="text-sm font-bold text-slate-800">حروف ورموز الألوان التلقائية</h2>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddColorModalOpen(true)}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>لون جديد</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Object.entries(colorLetters).map(([name, letter]) => (
            <div
              key={name}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
            >
              <span className="text-xs font-bold text-slate-800">{name}</span>
              <input
                type="text"
                maxLength={4}
                value={letter}
                onChange={(e) => updateColorLetter(name, e.target.value)}
                className="w-12 text-center font-mono font-bold bg-white border border-slate-300 rounded-lg px-1 py-1 text-xs uppercase focus:outline-none focus:border-[#14b8a6]"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* 6. الشهر المقفول حالياً (Read-only) */}
      <Card className="p-5 border-slate-200 bg-slate-50/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200/80 text-slate-600 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block">
              حالة قفل الفترات المحاسبية (عرض فقط)
            </span>
            <span className="text-sm font-extrabold text-slate-800">
              الشهر المقفول حالياً: {lockedThroughMonth}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full">
          مقفل عبر شاشة صورة المحل
        </span>
      </Card>

      {/* رابط النسخ الاحتياطي وبداية جديدة */}
      <Card className="p-5 border-[#14b8a6]/30 bg-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">النسخ الاحتياطي وبداية جديدة</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            تصدير واستيراد ملفات JSON لقاعدة البيانات وتأسيس الأرصدة الافتتاحية
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.location.hash = '#/backup'}
          className="bg-white text-[#0d9488] border-[#14b8a6] hover:bg-[#14b8a6]/10 font-bold"
        >
          الانتقال للنسخ الاحتياطي
        </Button>
      </Card>

      {/* زر الحفظ السفلي */}
      <div className="pt-2">
        <Button
          onClick={handleSaveSettings}
          isLoading={isSaving}
          variant="primary"
          className="w-full py-4 text-base font-bold shadow-sm gap-2"
        >
          <Save className="w-5 h-5" />
          <span>حفظ وتطبيق كافة الإعدادات</span>
        </Button>
      </div>

      {/* نافذة إضافة خزينة جديدة */}
      <Modal
        isOpen={isAddWalletModalOpen}
        onClose={() => setIsAddWalletModalOpen(false)}
        title="إضافة خزينة أو حساب جديد"
      >
        <form onSubmit={handleAddWallet} className="space-y-4">
          <Input
            label="اسم الخزينة أو الحساب"
            placeholder="مثال: الخزينة الفرعية، فودافون كاش 2..."
            value={newWalletName}
            onChange={(e) => setNewWalletName(e.target.value)}
            required
          />

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddWalletModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="sm">
              إضافة
            </Button>
          </div>
        </form>
      </Modal>

      {/* نافذة إضافة لون جديد */}
      <Modal
        isOpen={isAddColorModalOpen}
        onClose={() => setIsAddColorModalOpen(false)}
        title="إضافة لون ورمزه"
      >
        <form onSubmit={handleAddColor} className="space-y-4">
          <Input
            label="اسم اللون بالعربية"
            placeholder="مثال: زيتوني"
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
            required
          />

          <Input
            label="رمز أو حرف اللون (بالإنجليزية)"
            placeholder="مثال: OL"
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
              onClick={() => setIsAddColorModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="sm">
              إضافة اللون
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
