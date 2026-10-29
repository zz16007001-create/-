/**
 * Domain Entities & Interfaces for «محلي»
 */

export type WalletId = 'cash' | 'bank' | 'vodafone_cash' | 'instapay' | 'card' | string;

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: number;
}

export interface Item {
  id: string;
  barcode: string;
  sku?: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  costPrice: number;       // سعر التكلفة / الشراء
  sellPrice: number;       // سعر البيع الأساسي
  wholesalePrice?: number; // سعر الجملة (اختياري)
  currentStock: number;    // الرصيد الحالي بالمخزن
  minStockAlert: number;   // حد الطلب / التنبيه
  unit: string;            // الوحدة (قطعة، كيلو، كرتونة...)
  taxRate?: number;        // نسبة الضريبة إن وجدت
  notes?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InvoiceItem {
  itemId: string;
  barcode?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  total: number;
}

export type PaymentMethod = 'cash' | 'credit' | 'partial' | 'wallet';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: number;
  customerId?: string;
  customerName?: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: PaymentMethod;
  walletId: WalletId;
  notes?: string;
  cashierName?: string;
  status: 'completed' | 'draft' | 'cancelled' | 'refunded';
  createdAt: number;
}

export interface PurchaseItem {
  itemId: string;
  name: string;
  quantity: number;
  purchaseCost: number;
  total: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  date: number;
  supplierId?: string;
  supplierName?: string;
  items: PurchaseItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  remainingAmount: number;
  walletId: WalletId;
  notes?: string;
  status: 'received' | 'pending' | 'cancelled';
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  currentBalance: number; // مدين موجبة، دائن سالبة
  creditLimit?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ReturnDocItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalRefund: number;
}

export type ReturnType = 'sale_return' | 'purchase_return';

export interface ReturnDoc {
  id: string;
  returnNumber: string;
  originalInvoiceId?: string;
  type: ReturnType;
  date: number;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  items: ReturnDocItem[];
  totalRefund: number;
  refundWalletId: WalletId;
  reason?: string;
  createdAt: number;
}

export type TransactionType = 'income' | 'expense' | 'customer_payment' | 'supplier_payment' | 'transfer' | 'capital';

export interface Transaction {
  id: string;
  date: number;
  type: TransactionType;
  amount: number;
  walletId: WalletId;
  targetWalletId?: WalletId; // في حال التحويل بين الخزن/الحسابات
  partyId?: string;          // عميل أو مورد
  partyName?: string;
  category: string;          // تصنيف المصروف أو الإيراد (كهرباء، إيجار، رواتب...)
  description: string;
  referenceNumber?: string;
  createdAt: number;
}

export type StockAdjustmentType = 'settlement_plus' | 'settlement_minus' | 'damage' | 'internal_use';

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  date: number;
  type: StockAdjustmentType;
  itemId: string;
  itemName: string;
  oldStock: number;
  adjustedStock: number;
  differenceQty: number; // الفرق (موجب أو سالب)
  unitCost: number;
  totalCostImpact: number;
  reason: string;
  createdByName?: string;
  createdAt: number;
}

export interface Snapshot {
  id: string;
  timestamp: number;
  type: 'daily_closing' | 'monthly_closing' | 'audit';
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  netProfitEstimate: number;
  cashInHand: Record<WalletId, number>;
  inventoryValuation: number;
  totalReceivables: number; // ديون العملاء
  totalPayables: number;    // مستحقات الموردين
  notes?: string;
}

export interface Opening {
  id: string;
  fiscalYear: string;
  date: number;
  initialCashBalances: Record<WalletId, number>;
  initialInventoryValue: number;
  initialReceivables: number;
  initialPayables: number;
  notes?: string;
  isLocked: boolean;
  createdAt: number;
}

export interface Settings {
  storeName: string;
  storeTagline?: string;
  phone: string;
  address: string;
  taxNumber?: string;
  commercialRecord?: string;
  currencySymbol: string;
  currencyCode: string;
  defaultWallet: WalletId;
  enableTax: boolean;
  defaultTaxRate: number;
  receiptFooterText?: string;
  receiptHeaderNotice?: string;
  enableNegativeInventory: boolean;
  lowStockThresholdDefault: number;
  printPaperWidth: '80mm' | '58mm' | 'A4';
  autoBackupLocal: boolean;
  language: 'ar';
}
