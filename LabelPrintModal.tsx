import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { BarcodeSVG } from '../../components/ui/BarcodeSVG';
import { formatCurrency } from '../../domain/money';
import { Printer, Copy, Tag, Check, Eye } from 'lucide-react';

export interface PrintableLabelItem {
  id?: string;
  code: string;
  name: string;
  color?: string;
  size?: number | string;
  sellPrice?: number;
  quantity?: number;
}

export interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PrintableLabelItem[];
  defaultShowPrice?: boolean;
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({
  isOpen,
  onClose,
  items,
  defaultShowPrice = false,
}) => {
  // عدد النسخ لكل صنف
  const [copies, setCopies] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    items.forEach((it, idx) => {
      const key = it.id || it.code || String(idx);
      init[key] = it.quantity || 1;
    });
    return init;
  });

  const [showPrice, setShowPrice] = useState(defaultShowPrice);

  const updateCopies = (key: string, count: number) => {
    setCopies((prev) => ({
      ...prev,
      [key]: Math.max(1, count),
    }));
  };

  // توليد قائمة الملصقات المكررة للطباعة
  const labelsToPrint = React.useMemo(() => {
    const result: PrintableLabelItem[] = [];
    items.forEach((it, idx) => {
      const key = it.id || it.code || String(idx);
      const count = copies[key] || 1;
      for (let i = 0; i < count; i++) {
        result.push(it);
      }
    });
    return result;
  }, [items, copies]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ستايل الطباعة لعزل الملصقات فقط وإخفاء باقي التطبيق */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-labels-area, #printable-labels-area * {
            visibility: visible !important;
          }
          #printable-labels-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .label-sticker {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="طباعة ملصقات الباركود"
      >
        <div className="space-y-5">
          {/* خيارات الطباعة */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-[#14b8a6]" />
                <span>إظهار سعر البيع على الملصق:</span>
              </span>

              <button
                type="button"
                onClick={() => setShowPrice(!showPrice)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showPrice ? 'bg-[#14b8a6]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showPrice ? '-translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* تحديد عدد النسخ لكل صنف */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 block">
                تحديد عدد الملصقات لكل صنف:
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                {items.map((it, idx) => {
                  const key = it.id || it.code || String(idx);
                  return (
                    <div
                      key={key}
                      className="pt-1.5 flex items-center justify-between text-xs"
                    >
                      <div className="truncate max-w-[200px]">
                        <span className="font-bold text-slate-800">{it.name}</span>
                        <span className="text-slate-400 font-mono text-[10px] block">
                          {it.code}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-500">عدد النسخ:</label>
                        <input
                          type="number"
                          min="1"
                          value={copies[key] || 1}
                          onChange={(e) => updateCopies(key, parseInt(e.target.value) || 1)}
                          className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* معاينة الملصق على الشاشة */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#14b8a6]" />
                <span>معاينة الملصق (إجمالي الملصقات: {labelsToPrint.length}):</span>
              </span>
            </div>

            <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
              <div
                id="printable-labels-area"
                className="grid grid-cols-2 gap-3"
              >
                {labelsToPrint.map((lbl, i) => (
                  <div
                    key={i}
                    className="label-sticker p-2.5 bg-white border-2 border-slate-300 rounded-lg text-center flex flex-col items-center justify-center space-y-1 shadow-2xs"
                    style={{ minHeight: '110px' }}
                  >
                    <div className="text-[11px] font-bold text-slate-900 leading-tight truncate w-full px-1">
                      {lbl.name}
                    </div>

                    <div className="flex items-center justify-center gap-2 text-[10px] text-slate-600 font-medium">
                      {lbl.color && <span>{lbl.color}</span>}
                      {lbl.size && <span>مقاس {lbl.size}</span>}
                    </div>

                    <div className="w-full flex justify-center py-0.5">
                      <BarcodeSVG
                        code={lbl.code}
                        width={1.4}
                        height={32}
                        displayValue={true}
                        fontSize={10}
                      />
                    </div>

                    {showPrice && lbl.sellPrice && (
                      <div className="text-xs font-black text-slate-900 border-t border-slate-100 w-full pt-0.5">
                        {formatCurrency(lbl.sellPrice)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              إغلاق
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="gap-2 px-5 font-bold"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ({labelsToPrint.length} ملصق)</span>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
