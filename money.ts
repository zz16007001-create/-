/**
 * Currency, Number Parsing and Rounding Utilities for «محلي»
 */

/**
 * تقريب الأرقام المالية لمنزلتين عشريتين مع إضافة epsilon (1e-8)
 * لتلافي أخطاء التمثيل العشري في محرك الجافاسكربت (Floating Point Inaccuracies).
 */
export function round2(num: number): number {
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }
  const sign = num < 0 ? -1 : 1;
  const absNum = Math.abs(num);
  const r = Math.round((absNum + 1e-8) * 100) / 100;
  return r === 0 ? 0 : sign * r; // بدون -0
}

/**
 * تنسيق المبالغ المالية بالشكل القياسي العربي وتحديد رمز العملة
 */
export function formatCurrency(amount: number, currency: string = 'ج.م'): string {
  const rounded = round2(amount);
  const formatted = rounded.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${formatted} ${currency}`;
}

/**
 * تحويل الأرقام المكتوبة بالأرقام العربية الشرقية (٠-٩)
 * والفواصل العشرية العربية (، أو ٫) إلى رقم عددي قياسي (number) صالح للحسابات.
 */
export function parseArabicNumber(input: string | number | null | undefined): number {
  if (input === null || input === undefined) {
    return 0;
  }

  if (typeof input === 'number') {
    return isNaN(input) ? 0 : round2(input);
  }

  const str = String(input).trim();
  if (!str) {
    return 0;
  }

  // جدول تحويل الأرقام الهندية/العربية المشرقية والفارسية إلى أرقام لاتينية
  const easternToArabicMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };

  let normalized = str
    .replace(/[٠-٩۰-۹]/g, (char) => easternToArabicMap[char] || char)
    .replace(/٫/g, '.')
    .replace(/\s+/g, '');

  if (/\d[eE][+-]?\d/.test(normalized)) return 0; // لا نقبل الصيغة الأسية

  // الفاصلة (, أو ،): لو بعدها 1-2 رقم في آخر النص ولا توجد نقطة فهي فاصلة عشرية ("12,5" => 12.5)
  // وإلا فهي فاصل آلاف ("1,250" => 1250)
  if (!normalized.includes('.') && /[,،]\d{1,2}$/.test(normalized)) {
    normalized = normalized.replace(/[,،](\d{1,2})$/, '.$1');
  }
  normalized = normalized.replace(/[,،]/g, '').replace(/[^0-9.-]/g, '');

  // رقم غير صالح (مثل 12-5 أو --5 أو أكثر من علامة عشرية) => 0 بدل رقم خاطئ
  if (!/^-?\d*\.?\d*$/.test(normalized)) {
    return 0;
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : round2(parsed);
}

/** توحيد رقم الهاتف: أرقام لاتينية فقط بدون مسافات أو رموز (للبحث عن العميل). */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const map: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return String(input)
    .replace(/[٠-٩]/g, (c) => map[c] || c)
    .replace(/\D/g, '');
}
