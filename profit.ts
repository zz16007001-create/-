/**
 * Profit, Margins, and Mismatch detection for «محلي»
 */

import { round2 } from './money';

/**
 * حساب نسبة هامش الربح على التكلفة (Markup Percentage)
 */
export function calculateProfitMargin(cost: number, sellPrice: number): number {
  if (cost <= 0) {
    return 0;
  }
  return round2(((sellPrice - cost) / cost) * 100);
}

export interface InvoiceProfitParams {
  totalSalesNet: number;          // صافي مبيعات الفترة (بعد خصم المرتجعات)
  costOfGoodsSold: number;        // تكلفة البضاعة المباعة (بعد خصم تكلفة المرتجعات)
  stockAdjustmentImpact?: number; // فروق الجرد (زيادة + / عجز وتلف -)
  expenses: number;               // المصاريف التشغيلية
  badDebt?: number;               // ديون معدومة خلال الفترة (خسارة)
}

/**
 * ربح الفترة = صافي المبيعات - تكلفة البضاعة + فروق الجرد - المصاريف - الديون المعدومة
 * (المرتجعات تُخصم مسبقاً من المبيعات والتكلفة قبل استدعاء الدالة)
 */
export function calculateInvoiceProfit({
  totalSalesNet,
  costOfGoodsSold,
  stockAdjustmentImpact = 0,
  expenses,
  badDebt = 0,
}: InvoiceProfitParams): number {
  return round2(totalSalesNet - costOfGoodsSold + stockAdjustmentImpact - expenses - badDebt);
}

export function calculateRealProfit(
  capitalGrowth: number,
  drawings: number = 0,
  addedCapital: number = 0
): number {
  return round2(capitalGrowth + drawings - addedCapital);
}

/**
 * حساب الفرق (Mismatch) بين الربح الحقيقي وربح الفواتير
 * المعادلة: الربح الحقيقي - ربح الفواتير
 */
export function calculateMismatch(realProfit: number, invoiceProfit: number): number {
  return round2(realProfit - invoiceProfit);
}

/**
 * فحص ما إذا كان فرق الربح يستدعي تنبيهاً للمستخدم
 * ترجع true إذا كان الفرق المطلق أكبر من 50 ج.م
 */
export function shouldWarnMismatch(mismatch: number): boolean {
  return Math.abs(mismatch) > 50;
}
