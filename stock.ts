/**
 * Stock balance recalculation and adjustment utilities for «محلي»
 */

import { StockAdjustment, WalletId } from './types';
import { round2 } from './money';

export interface StockAdjustmentCalcResult {
  differenceQty: number; // الفرق = المعدود - المسجل
  totalCostImpact: number; // القيمة = الفرق × سعر الشراء
}

/**
 * حساب تسوية الجرد المخزني
 * الفرق = المعدود - المسجل
 * القيمة = الفرق × سعر الشراء / التكلفة
 */
export function calculateStockAdjustment(
  countedQty: number,
  recordedQty: number,
  costPrice: number
): StockAdjustmentCalcResult {
  const differenceQty = round2(countedQty - recordedQty);
  const totalCostImpact = round2(differenceQty * costPrice);

  return {
    differenceQty,
    totalCostImpact,
  };
}

export interface RecalculateItemQtyParams {
  initialQty: number;
  activeSalesQty: number;    // مبيعات الفواتير النشطة فقط
  returnsQty: number;        // كميات المرتجعات المسترجعة للمخزن
  stockAdjustmentsQty: number; // مجموع فروق الجرد (سواء موجبة أو سالبة)
}

/**
 * إعادة احتساب رصيد صنف معين من أصل الحركات
 * الكمية = initialQty - مبيعات الفواتير النشطة + المرتجعات + فروق الجرد
 */
export function recalculateItemQty({
  initialQty,
  activeSalesQty,
  returnsQty,
  stockAdjustmentsQty,
}: RecalculateItemQtyParams): number {
  const calculated = initialQty - activeSalesQty + returnsQty + stockAdjustmentsQty;
  return round2(calculated);
}

export interface WalletTransactionEntry {
  walletId: WalletId;
  targetWalletId?: WalletId;
  amount: number;
  type: 'income' | 'expense' | 'transfer' | 'customer_payment' | 'supplier_payment' | 'sale' | 'purchase' | 'refund' | 'capital';
}

/**
 * إعادة حساب أرصدة الخزائن من السجلات وحركات القيود للمقارنة والتدقيق
 */
export function recalculateWallets(
  openingBalances: Record<WalletId, number>,
  transactions: WalletTransactionEntry[]
): Record<WalletId, number> {
  const result: Record<WalletId, number> = { ...openingBalances };

  // تهيئة الأرصدة
  Object.keys(result).forEach((wId) => {
    result[wId] = round2(result[wId] || 0);
  });

  for (const tx of transactions) {
    const amount = round2(tx.amount);
    if (!amount) continue;

    if (!result[tx.walletId]) {
      result[tx.walletId] = 0;
    }

    switch (tx.type) {
      case 'income':
      case 'customer_payment':
      case 'sale':
      case 'capital':
        result[tx.walletId] = round2(result[tx.walletId] + amount);
        break;

      case 'expense':
      case 'supplier_payment':
      case 'purchase':
      case 'refund':
        result[tx.walletId] = round2(result[tx.walletId] - amount);
        break;

      case 'transfer':
        result[tx.walletId] = round2(result[tx.walletId] - amount);
        if (tx.targetWalletId) {
          if (!result[tx.targetWalletId]) {
            result[tx.targetWalletId] = 0;
          }
          result[tx.targetWalletId] = round2(result[tx.targetWalletId] + amount);
        }
        break;
    }
  }

  return result;
}
