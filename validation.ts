/**
 * Validation rules and schemas for «محلي»
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface PurchaseLineValidationInput {
  itemId?: string;
  name?: string;
  size?: number | string;
  quantity: number;
  purchaseCost: number;
}

export interface PurchaseValidationInput {
  items: PurchaseLineValidationInput[];
  paidAmount?: number;
  grandTotal?: number;
}

/**
 * التحقق من صحة فاتورة الشراء:
 * - التحقق من وجود بنود
 * - التحقق من عدم تكرار المقاسات لنفس الموديل إن وجدت
 * - التحقق من أن الكميات موجبة وأسعار الشراء صحيحة وغير سالبة
 */
export function validatePurchase(purchase: PurchaseValidationInput): ValidationResult {
  const errors: string[] = [];

  if (!purchase.items || purchase.items.length === 0) {
    errors.push('يجب إضافة بند واحد على الأقل في فاتورة الشراء');
    return { isValid: false, errors };
  }

  const seenItemsAndSizes = new Set<string>();

  purchase.items.forEach((item, index) => {
    const rowNum = index + 1;

    if (!item.quantity || item.quantity <= 0) {
      errors.push(`الكمية في السطر ${rowNum} يجب أن تكون أكبر من صفر`);
    }

    if (item.purchaseCost === undefined || item.purchaseCost === null || item.purchaseCost < 0) {
      errors.push(`سعر الشراء في السطر ${rowNum} لا يمكن أن يكون سالباً`);
    }

    // التحقق من تكرار المقاس لنفس الصنف
    if (item.itemId || item.name) {
      const key = `${item.itemId || item.name}___${item.size || 'default'}`;
      if (seenItemsAndSizes.has(key)) {
        errors.push(`تكرار في الصنف أو المقاس في السطر ${rowNum}`);
      } else {
        seenItemsAndSizes.add(key);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface InvoiceValidationInput {
  items: Array<{
    itemId?: string;
    name?: string;
    quantity: number;
    unitPrice: number;
  }>;
  grandTotal: number;
  paidAmount: number;
  remainingAmount?: number;
  customerName?: string;
}

/**
 * التحقق من صحة فاتورة البيع:
 * - بنود غير فارغة
 * - المدفوع لا يزيد عن الإجمالي
 * - الاسم إلزامي إذا كان هناك آجل (remainingAmount > 0)
 */
export function validateInvoice(invoice: InvoiceValidationInput): ValidationResult {
  const errors: string[] = [];

  if (!invoice.items || invoice.items.length === 0) {
    errors.push('لا يمكن إنشاء فاتورة بيع بدون بنود');
    return { isValid: false, errors };
  }

  invoice.items.forEach((item, idx) => {
    const rowNum = idx + 1;
    if (!item.quantity || item.quantity <= 0) {
      errors.push(`الكمية في البند ${rowNum} يجب أن تكون أكبر من صفر`);
    }
    if (item.unitPrice === undefined || item.unitPrice < 0) {
      errors.push(`سعر البيع في البند ${rowNum} لا يمكن أن يكون سالباً`);
    }
  });

  // التحقق من أن المدفوع لا يتجاوز الإجمالي بفارق ملحوظ
  if (invoice.paidAmount > invoice.grandTotal + 0.01) {
    errors.push('المبلغ المدفوع لا يمكن أن يزيد عن إجمالي الفاتورة');
  }

  // حساب المتبقي الآجل
  const debt = invoice.remainingAmount !== undefined
    ? invoice.remainingAmount
    : Math.max(0, invoice.grandTotal - invoice.paidAmount);

  // الاسم إلزامي في حال وجود باقي آجل
  if (debt > 0.01) {
    if (!invoice.customerName || invoice.customerName.trim().length === 0) {
      errors.push('اسم العميل إلزامي عند وجود مبلغ آجل أو متبقٍ على الفاتورة');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface ReturnValidationInput {
  invoiceStatus: 'completed' | 'draft' | 'cancelled' | 'refunded' | string;
  originalSoldQty: number;
  alreadyReturnedQty: number;
  requestedReturnQty: number;
}

/**
 * التحقق من صحة طلب المرتجع:
 * - الفاتورة نشطة (ليست ملغاة أو مسودة)
 * - الكمية المرتجعة لا تتجاوز (المباع - المرتجع سابقاً)
 */
export function validateReturn(input: ReturnValidationInput): ValidationResult {
  const errors: string[] = [];

  if (input.invoiceStatus === 'cancelled') {
    errors.push('لا يمكن عمل مرتجع على فاتورة ملغاة');
  }

  if (input.requestedReturnQty <= 0) {
    errors.push('الكمية المرتجعة يجب أن تكون أكبر من صفر');
  }

  const maxAllowed = Math.max(0, input.originalSoldQty - input.alreadyReturnedQty);
  if (input.requestedReturnQty > maxAllowed + 1e-8) {
    errors.push(`الكمية المرتجعة (${input.requestedReturnQty}) تتجاوز الحد الأقصى المتاح للإرجاع (${maxAllowed})`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
