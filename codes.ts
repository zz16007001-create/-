/**
 * Code generation utilities and device prefixes for «محلي»
 */

const DEVICE_PREFIX_KEY = 'mahally_device_prefix';

/**
 * الحصول على بادئة الجهاز الحالية أو توليد حرف عشوائي A-Z وتخزينه في localStorage
 */
export function getDevicePrefix(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'A';
  }

  const existing = localStorage.getItem(DEVICE_PREFIX_KEY);
  if (existing && existing.length === 1 && /^[A-Z]$/.test(existing)) {
    return existing;
  }

  // توليد حرف عشوائي بين A و Z
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomChar = letters.charAt(Math.floor(Math.random() * letters.length));
  localStorage.setItem(DEVICE_PREFIX_KEY, randomChar);
  return randomChar;
}

export interface CodeOptions {
  modelNumber?: number | string;
  color?: string;
  colorLetter?: string; // حرف/حروف لاتينية للون (من الإعدادات)
  size?: number | string;
  seq?: number;
}

/** حرف اللون في الكود: يُفضَّل الحرف اللاتيني من الإعدادات، وإلا 'X' (لا نستخدم الحرف العربي). */
function colorPart(options: CodeOptions): string {
  const letter = (options.colorLetter || '').trim().toUpperCase();
  return /^[A-Z0-9]+$/.test(letter) ? letter : 'X';
}

/**
 * توليد كود الصنف. هذه هي الدالة الوحيدة لتوليد الأكواد في النظام:
 * - حذاء:   S{موديل}-{لون}{مقاس}   مثال S12-B37
 * - شنطة:   B{موديل}-{لون}         مثال B5-BR
 * - إكسسوار: ACC{موديل}-{لون}      مثال ACC7-BK
 */
export function makeCode(
  category: 'shoes' | 'bags' | 'accessories' | 'general' | string,
  options: CodeOptions = {}
): string {
  const cat = (category || 'general').toLowerCase();
  const model = options.modelNumber ?? 1;

  if (cat === 'shoes' || cat.includes('حذاء') || cat.includes('احذية')) {
    return `S${model}-${colorPart(options)}${options.size ? options.size : ''}`;
  }

  if (cat === 'bags' || cat.includes('شنط') || cat.includes('حقائب')) {
    return `B${model}-${colorPart(options)}`;
  }

  if (cat === 'accessories' || cat.includes('اكسسوار') || cat.includes('إكسسوار')) {
    return `ACC${model}-${colorPart(options)}`;
  }

  const prefix = cat.charAt(0).toUpperCase() || 'ITEM';
  const suffix = options.seq ? options.seq : model;
  return `${prefix}${model}-${suffix}`;
}
