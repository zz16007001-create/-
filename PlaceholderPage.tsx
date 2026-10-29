import React from 'react';
import { Card } from '../ui/Card';
import { Wrench } from 'lucide-react';

interface PlaceholderPageProps {
  title?: string;
  description?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title = 'الصفحة قيد الإنشاء',
  description = 'جاري تطوير هذا القسم ليعمل بكفاءة وسرعة.',
}) => {
  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[60vh]">
      <Card className="max-w-md w-full text-center py-12 px-6 border-dashed border-2 border-slate-200 bg-white/70">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#14b8a6]/10 text-[#14b8a6] flex items-center justify-center mb-4">
          <Wrench className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 mb-4">{description}</p>
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
          قريباً في الخطوة القادمة
        </span>
      </Card>
    </div>
  );
};
