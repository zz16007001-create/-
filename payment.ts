/**
 * Payment distribution and debt allocation utilities for «محلي»
 */

import { round2 } from './money';

export interface InvoiceDebtItem {
  id: string;
  invoiceNumber?: string;
  date: number;
  remainingAmount: number; // المبلغ المتبقي الآجل (debtRemaining)
  status?: string;
}

export interface DebtAllocation {
  invoiceId: string;
  allocatedAmount: number;
  previousDebt: number;
  remainingDebt: number;
}

export interface CollectionResult {
  allocations: DebtAllocation[];
  totalAllocated: number;
  unallocated: number; // المبلغ الفائض بعد تسديد كافة الفواتير
}

/**
 * توزيع مبلغ التحصيل على فواتير العميل المستحقة
 * - الترتيب: من الأقدم للأحدث حسب تاريخ الفاتورة
 * - الشروط: الفواتير النشطة فقط التي عليها متبقٍ آجل (remainingAmount > 0)
 * - النتيجة: قائمة التوزيع مع المبلغ غير الموزع (unallocated)
 */
export function distributeCollection(
  invoices: InvoiceDebtItem[],
  collectionAmount: number
): CollectionResult {
  let remainingToAllocate = round2(Math.max(0, collectionAmount));
  const allocations: DebtAllocation[] = [];
  let totalAllocated = 0;

  // ترشيح الفواتير المستحقة وترتيبها تصاعدياً من الأقدم للأحدث
  const sortedInvoices = [...invoices]
    .filter((inv) => inv.remainingAmount > 0 && inv.status !== 'cancelled')
    .sort((a, b) => a.date - b.date);

  for (const inv of sortedInvoices) {
    if (remainingToAllocate <= 0) {
      break;
    }

    const currentDebt = round2(inv.remainingAmount);
    const pay = round2(Math.min(currentDebt, remainingToAllocate));

    if (pay > 0) {
      const remainingForThisInvoice = round2(currentDebt - pay);
      allocations.push({
        invoiceId: inv.id,
        allocatedAmount: pay,
        previousDebt: currentDebt,
        remainingDebt: remainingForThisInvoice,
      });

      totalAllocated = round2(totalAllocated + pay);
      remainingToAllocate = round2(remainingToAllocate - pay);
    }
  }

  return {
    allocations,
    totalAllocated,
    unallocated: remainingToAllocate,
  };
}

/**
 * توزيع إعدام الديون المعدومة (Bad Debt)
 * نفس الآلية المحاسبية للتحصيل بإطفاء الديون الأقدم للأحدث دون التأثير على رصيد الخزينة
 */
export function distributeBadDebt(
  invoices: InvoiceDebtItem[],
  badDebtAmount: number
): CollectionResult {
  return distributeCollection(invoices, badDebtAmount);
}
