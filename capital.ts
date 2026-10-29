/**
 * Capital and equity calculations for «محلي»
 */

import { Customer, Item } from './types';
import { round2 } from './money';

/**
 * حساب إجمالي قيمة المخزون الحالي بسعر التكلفة
 */
export function calculateInventoryValue(items: Item[]): number {
  const total = items.reduce((sum, item) => {
    if (item.currentStock > 0 && item.costPrice > 0) {
      return sum + (item.currentStock * item.costPrice);
    }
    return sum;
  }, 0);

  return round2(total);
}

/**
 * حساب ديون العملاء المستحقة للمحل (الأرصدة الموجبة - مدين)
 */
export function calculateReceivables(customers: Customer[]): number {
  const total = customers.reduce((sum, customer) => {
    return customer.currentBalance > 0 ? sum + customer.currentBalance : sum;
  }, 0);

  return round2(total);
}

/**
 * حساب أرصدة العملاء الدائنة (دفعات مقدمة / أمانات لصالح العملاء)
 */
export function calculateCustomerCredits(customers: Customer[]): number {
  const total = customers.reduce((sum, customer) => {
    return customer.currentBalance < 0 ? sum + Math.abs(customer.currentBalance) : sum;
  }, 0);

  return round2(total);
}

/**
 * حساب رأس المال التشغيلي الصافي
 * المعادلة: الخزائن + المخزون + الديون - أرصدة العملاء - الالتزامات (مستحقات الموردين/الغير)
 */
export function calculateCapital(
  walletsTotal: number,
  inventoryValue: number,
  receivables: number,
  customerCredits: number,
  payables: number = 0
): number {
  return round2(walletsTotal + inventoryValue + receivables - customerCredits - payables);
}
