import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useItems } from '../../hooks/useItems';
import { normalizeAr } from '../../domain/arabic';
import { formatCurrency } from '../../domain/money';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import {
  PackagePlus,
  Search,
  AlertTriangle,
  Boxes,
  Tag,
  Palette,
  Ruler,
  Archive,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'الكل' },
  { id: 'shoes', label: 'أحذية' },
  { id: 'bags', label: 'شنط' },
  { id: 'accessories', label: 'إكسسوارات' },
];

export const ItemsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, loading } = useItems();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showArchived, setShowArchived] = useState(false);

  // تصفية وترشيح الأصناف
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizeAr(searchTerm.trim());

    return items.filter((item) => {
      // فلتر الأرشفة
      if (!showArchived && !item.isActive) {
        return false;
      }
      if (showArchived && item.isActive) {
        return false;
      }

      // فلتر التصنيف
      if (selectedCategory !== 'all') {
        const itemCat = normalizeAr(item.categoryId || item.categoryName || '');
        if (selectedCategory === 'shoes' && !itemCat.includes('shoe') && !itemCat.includes('حذاء') && !itemCat.includes('احذي')) {
          return false;
        }
        if (selectedCategory === 'bags' && !itemCat.includes('bag') && !itemCat.includes('شنط') && !itemCat.includes('حقائب')) {
          return false;
        }
        if (selectedCategory === 'accessories' && !itemCat.includes('access') && !itemCat.includes('اكسسوار')) {
          return false;
        }
      }

      // فلتر البحث بالاسم والكود واللون والمقاس
      if (normalizedQuery) {
        const itemSearch = item.search || normalizeAr(`${item.code} ${item.name} ${item.color} ${item.size}`);
        if (!itemSearch.includes(normalizedQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [items, searchTerm, selectedCategory, showArchived]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* الشريط العلوي والأزرار */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-[#14b8a6]" />
            <span>المخزون والأصناف</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            إجمالي الأصناف المسجلة: {items.length} صنف
          </p>
        </div>

        <Button
          onClick={() => navigate('/purchase')}
          variant="primary"
          className="shadow-sm self-start sm:self-auto gap-2"
        >
          <PackagePlus className="w-4 h-4" />
          <span>إضافة بضاعة جديدة</span>
        </Button>
      </div>

      {/* شريط البحث والفلترة */}
      <Card className="p-4 space-y-4 border-slate-200">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* حقل البحث */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالكود، اسم الصنف، اللون، أو المقاس..."
              dir="rtl"
              className="w-full rounded-xl border border-slate-300 bg-white pr-10 pl-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 transition-all"
            />
            <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* تبديل عرض المؤرشف */}
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors ${
              showArchived
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{showArchived ? 'عرض النشط' : 'عرض المؤرشف فقط'}</span>
          </button>
        </div>

        {/* فلاتر التصنيف */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          <span className="text-xs text-slate-400 ml-1 shrink-0">التصنيف:</span>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-[#14b8a6] text-white shadow-2xs font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* محتوى القائمة */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 mt-4">جاري تحميل الأصناف والمخزون...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        /* Empty State */
        <Card className="py-16 text-center border-dashed border-2 border-slate-200">
          <Boxes className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">لا توجد أصناف مطابقة للبحث</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            جرّب تغيير كلمات البحث أو التصنيف، أو قم بإضافة بضاعة جديدة للمخزن.
          </p>
          <Button
            onClick={() => navigate('/purchase')}
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5"
          >
            <PackagePlus className="w-3.5 h-3.5" />
            <span>إضافة بضاعة</span>
          </Button>
        </Card>
      ) : (
        /* Grid of Items */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const isLowStock = item.currentStock <= item.minStockAlert;

            return (
              <Card
                key={item.id}
                onClick={() => navigate(`/items/${item.id}`)}
                className="p-4 flex flex-col justify-between hover:shadow-md transition-all border-slate-200 cursor-pointer hover:border-[#14b8a6]/50 group"
              >
                <div>
                  {/* الرأس: الكود والتصنيف */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 group-hover:border-[#14b8a6]/40 transition-colors">
                      {item.code || item.barcode}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {item.categoryName || item.categoryId || 'عام'}
                    </span>
                  </div>

                  {/* اسم الصنف / الوصف */}
                  <h3 className="font-bold text-slate-900 text-sm mb-3 line-clamp-2 group-hover:text-[#14b8a6] transition-colors">
                    {item.name}
                  </h3>

                  {/* المواصفات: اللون والمقاس */}
                  <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-slate-600">
                    {item.color && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200">
                        <Palette className="w-3 h-3 text-slate-400" />
                        <span>{item.color}</span>
                      </span>
                    )}
                    {item.size && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200">
                        <Ruler className="w-3 h-3 text-slate-400" />
                        <span>مقاس {item.size}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* الجزء السفلي: الكمية المتاحة وسعر البيع فقط (بدون سعر شراء) */}
                <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">الرصيد المتاح</span>
                    <div
                      className={`inline-flex items-center gap-1 text-sm font-bold ${
                        isLowStock ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {isLowStock && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                      <span>{item.currentStock}</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        {item.unit || 'قطعة'}
                      </span>
                    </div>
                  </div>

                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block mb-0.5">سعر البيع</span>
                    <span className="text-base font-extrabold text-[#14b8a6]">
                      {formatCurrency(item.sellPrice)}
                    </span>
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
