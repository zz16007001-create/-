// اختبارات الحسابات المالية الأساسية. تشغيل: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { round2, parseArabicNumber, normalizePhone } from './money';
import { calculateInvoiceTotals, allocateInvoiceLines, calculateLineReturn, distributeDiscount } from './invoice';
import { calculateInvoiceProfit, calculateRealProfit, calculateMismatch } from './profit';
import { makeCode } from './codes';

test('round2 لا يرجع -0', () => {
  assert.ok(!Object.is(round2(-0.004), -0));
  assert.equal(round2(1.005), 1.01);
});

test('parseArabicNumber: الفاصلة العشرية وفاصل الآلاف', () => {
  assert.equal(parseArabicNumber('12,5'), 12.5);
  assert.equal(parseArabicNumber('1,250'), 1250);
  assert.equal(parseArabicNumber('1,250.50'), 1250.5);
  assert.equal(parseArabicNumber('١٢٫٥'), 12.5);
  assert.equal(parseArabicNumber('12-5'), 0);
  assert.equal(parseArabicNumber('1e3'), 0);
  assert.equal(parseArabicNumber(''), 0);
});

test('normalizePhone', () => {
  assert.equal(normalizePhone('٠١٠ ١٢٣-٤٥٦٧'), '0101234567');
  assert.equal(normalizePhone(' 0100 123 4567 '), '01001234567');
});

test('توزيع الخصم: مجموع الحصص = الخصم بالضبط', () => {
  const sh = distributeDiscount(30, 10, [{ price: 10, quantity: 1 }, { price: 10, quantity: 1 }, { price: 10, quantity: 1 }]);
  assert.deepEqual(sh, [3.33, 3.33, 3.34]);
});

test('خصم إجمالي أكبر من المجموع يُقصّ', () => {
  const items: any[] = [{ unitPrice: 100, quantity: 2, discount: 0 }];
  const t = calculateInvoiceTotals({ items, overallDiscount: 500 });
  assert.equal(t.discountTotal, 200);
  assert.equal(t.grandTotal, 0);
});

test('فاتورة 2×100 خصم 20: المرتجع حسب ما دفعه العميل (90 ثم 180)', () => {
  const items: any[] = [{ unitPrice: 100, quantity: 2, discount: 0, total: 200 }];
  const t = calculateInvoiceTotals({ items, overallDiscount: 20 });
  assert.equal(t.grandTotal, 180);
  const [line] = allocateInvoiceLines(items, 20, 0, t.taxTotal);
  assert.equal(line.lineGrand, 180);
  const r1 = calculateLineReturn(line.lineGrand, 2, 1, 0, 0);
  assert.equal(r1.refundAmount, 90);
  const r2 = calculateLineReturn(line.lineGrand, 2, 1, 1, 90);
  assert.equal(r2.refundAmount, 90);
});

test('إرجاع كل الفاتورة = إجمالي الفاتورة بالضبط (3 بنود وخصم غير قابل للقسمة)', () => {
  const items: any[] = [
    { unitPrice: 10, quantity: 1, discount: 0, total: 10 },
    { unitPrice: 10, quantity: 1, discount: 0, total: 10 },
    { unitPrice: 10, quantity: 1, discount: 0, total: 10 },
  ];
  const t = calculateInvoiceTotals({ items, overallDiscount: 10 });
  const lines = allocateInvoiceLines(items, 10, 0, t.taxTotal);
  const sum = round2(lines.reduce((s, l) => s + l.lineGrand, 0));
  assert.equal(sum, t.grandTotal);
  assert.equal(sum, 20);
});

test('الضريبة: 2×100 خصم 20 ضريبة 14% = 205.2 وتتوزع بلا فرق', () => {
  const items: any[] = [{ unitPrice: 100, quantity: 2, discount: 0, total: 200 }];
  const t = calculateInvoiceTotals({ items, overallDiscount: 20, taxRate: 14 });
  assert.equal(t.taxTotal, 25.2);
  assert.equal(t.grandTotal, 205.2);
  const [l] = allocateInvoiceLines(items, 20, 14, t.taxTotal);
  assert.equal(l.lineGrand, 205.2);
});

test('الربح: المرتجع يُخصم، والفرق صفر عندما تتطابق الأرقام', () => {
  // مبيعات 1000 - مرتجع 100 = 900 ، تكلفة 600 - 60 = 540 ، مصروف 50 ، معدوم 10
  const profit = calculateInvoiceProfit({ totalSalesNet: 900, costOfGoodsSold: 540, expenses: 50, badDebt: 10 });
  assert.equal(profit, 300);
  // رأس المال زاد 340 ، سحب 40 ، تمويل 0 => الربح الحقيقي 380؟ لا: 340 + 40 - 0 = 380 => فرق 80 (مشكلة حقيقية تظهر)
  assert.equal(calculateMismatch(calculateRealProfit(340, 40, 0), profit), 80);
  // لو رأس المال زاد 260 فقط: 260 + 40 = 300 => لا فرق
  assert.equal(calculateMismatch(calculateRealProfit(260, 40, 0), profit), 0);
});

test('الأكواد: لون مختلف = كود مختلف، والإكسسوار يحمل رقم الموديل', () => {
  const black = makeCode('shoes', { modelNumber: 12, colorLetter: 'B', size: 37 });
  const white = makeCode('shoes', { modelNumber: 12, colorLetter: 'W', size: 37 });
  assert.equal(black, 'S12-B37');
  assert.notEqual(black, white);
  assert.equal(makeCode('bags', { modelNumber: 5, colorLetter: 'BR' }), 'B5-BR');
  assert.equal(makeCode('accessories', { modelNumber: 7, colorLetter: 'BK' }), 'ACC7-BK');
  assert.notEqual(makeCode('accessories', { modelNumber: 7, colorLetter: 'BK' }), makeCode('accessories', { modelNumber: 8, colorLetter: 'BK' }));
  // لون بدون حرف لاتيني لا يُنتج حرفاً عربياً
  assert.equal(makeCode('shoes', { modelNumber: 1, color: 'أسود', size: 40 }), 'S1-X40');
});
