/**
 * Invoice Calculations, Discounts, and Return handling for «محلي»
 */

import { InvoiceItem } from './types';
import { round2 } from './money';

/**
 * حساب صافي السطر: (السعر × الكمية - الخصم)
 */
export function calculateLineNet(price: number, quantity: number, discount: number = 0): number {
  return round2((price * quantity) - discount);
}

export interface LineForDiscount {
  price: number;
  quantity: number;
}

/**
 * توزيع الخصم الإجمالي النسبي على البنود، مع وضع أي كسور متبقية في السطر الأخير
 * لضمان أن مجموع الخصومات الموزعة يساوي بدقة الخصم الإجمالي المطلوب.
 */
export function distributeDiscount(
  subtotal: number,
  overallDiscount: number,
  lines: LineForDiscount[]
): number[] {
  if (lines.length === 0 || overallDiscount <= 0 || subtotal <= 0) {
    return lines.map(() => 0);
  }

  let distributedTotal = 0;
  const discounts: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    if (isLast) {
      // السطر الأخير يأخذ باقي الخصم المتبقي تماماً
      const lastDiscount = round2(overallDiscount - distributedTotal);
      discounts.push(Math.max(0, lastDiscount));
    } else {
      const lineTotal = lines[i].price * lines[i].quantity;
      const ratio = lineTotal / subtotal;
      const lineDiscount = round2(overallDiscount * ratio);
      distributedTotal = round2(distributedTotal + lineDiscount);
      discounts.push(lineDiscount);
    }
  }

  return discounts;
}

export interface InvoiceTotalsInput {
  items: InvoiceItem[];
  overallDiscount?: number;
  taxRate?: number;
  paidAmount?: number;
}

export interface InvoiceTotalsResult {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
}

/**
 * حساب الإجماليات للفاتورة كاملة
 */
export function calculateInvoiceTotals({
  items,
  overallDiscount = 0,
  taxRate = 0,
  paidAmount = 0,
}: InvoiceTotalsInput): InvoiceTotalsResult {
  const subtotal = round2(
    items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  );

  const itemsDiscounts = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  // الخصم الإجمالي لا يتجاوز ما تبقى بعد خصومات البنود
  const overall = Math.min(Math.max(0, overallDiscount), Math.max(0, subtotal - itemsDiscounts));
  const discountTotal = round2(itemsDiscounts + overall);
  const afterDiscount = Math.max(0, subtotal - discountTotal);

  const taxTotal = taxRate > 0 ? round2(afterDiscount * (taxRate / 100)) : 0;
  const grandTotal = round2(afterDiscount + taxTotal);

  const paid = round2(paidAmount);
  const remainingAmount = calculateCredit(grandTotal, paid);

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
    paidAmount: paid,
    remainingAmount,
  };
}

/**
 * حساب المبلغ المتبقي الآجل
 */
export function calculateCredit(grandTotal: number, paidAmount: number): number {
  return round2(Math.max(0, grandTotal - paidAmount));
}

export interface ReturnCalculationResult {
  unitNet: number;
  refundAmount: number;
}

/**
 * حساب المرتجع لبند من الفاتورة:
 * مهم جداً: لحساب unitNet نقسم lineNet على qty بدون عمل round2 في هذه الخطوة،
 * حتى عند الضرب في الكمية المرتجعة ترجع القيمة الأصلية بالمليم دون أي خطأ تقريب (مثلاً 500 بدلاً من 500.01).
 */
export function calculateReturn(
  lineNet: number,
  qty: number,
  returnQty: number
): ReturnCalculationResult {
  if (qty <= 0 || returnQty <= 0) {
    return { unitNet: 0, refundAmount: 0 };
  }

  // قسمة مباشرة بدون round2
  const unitNet = lineNet / qty;

  // تقريب المبلغ المرتجع الإجمالي فقط
  const refundAmount = round2(unitNet * returnQty);

  return {
    unitNet,
    refundAmount,
  };
}


/**
 * توزيع الخصم الإجمالي والضريبة على بنود الفاتورة.
 * كل بند يحصل على: net (بعد خصم البند وحصته من الخصم الإجمالي)، taxAmount، lineGrand = net + tax.
 * مجموع net + tax = إجمالي الفاتورة بالضبط (آخر بند يستوعب فروق التقريب).
 */
export function allocateInvoiceLines<T extends { total: number }>(
  items: T[],
  overallDiscount: number,
  taxRate: number,
  taxTotal: number
): (T & { net: number; taxAmount: number; lineGrand: number })[] {
  const netSubtotal = round2(items.reduce((sum, it) => sum + it.total, 0));
  const applied = Math.min(Math.max(0, round2(overallDiscount)), netSubtotal);
  const shares = distributeDiscount(
    netSubtotal,
    applied,
    items.map((it) => ({ price: it.total, quantity: 1 }))
  );
  let taxSoFar = 0;
  return items.map((it, i) => {
    const net = round2(it.total - shares[i]);
    const isLast = i === items.length - 1;
    const taxAmount = isLast ? round2(taxTotal - taxSoFar) : round2((net * (taxRate || 0)) / 100);
    taxSoFar = round2(taxSoFar + taxAmount);
    return { ...it, net, taxAmount, lineGrand: round2(net + taxAmount) };
  });
}

/**
 * قيمة مرتجع بند: نسبة من القيمة الصافية للبند (lineGrand).
 * عند إرجاع آخر كمية متبقية نرد المتبقي بالضبط لتفادي فروق التقريب.
 */
export function calculateLineReturn(
  lineGrand: number,
  soldQty: number,
  returnQty: number,
  returnedQtySoFar: number,
  returnedAmountSoFar: number
): ReturnCalculationResult {
  if (soldQty <= 0 || returnQty <= 0) {
    return { unitNet: 0, refundAmount: 0 };
  }
  if (returnQty === soldQty - returnedQtySoFar) {
    const refundAmount = round2(lineGrand - returnedAmountSoFar);
    return { unitNet: refundAmount / returnQty, refundAmount };
  }
  return calculateReturn(lineGrand, soldQty, returnQty);
}
