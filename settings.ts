/**
 * Store settings and configuration for «محلي»
 */

import { WalletId } from '../domain/types';

export interface WalletDefinition {
  id: WalletId;
  name: string;
  isDefault?: boolean;
}

export interface StoreSettings {
  storeName: string;
  storeTagline?: string;
  phone: string;
  address: string;
  taxNumber?: string;
  commercialRecord?: string;
  currencySymbol: string;
  currencyCode: string;
  defaultWallet: WalletId;
  wallets: WalletDefinition[];
  colorLetters: Record<string, string>;
  mismatchThreshold: number; // حد التنبيه لفرق الربح (المتفق عليه 50 ج.م)
  lowStockThreshold: number;
  enableTax: boolean;
  defaultTaxRate: number;
  printPaperWidth: '80mm' | '58mm' | 'A4';
  autoBackupLocal: boolean;
  language: 'ar';
}

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'محلي للأحذية والشنط',
  storeTagline: 'أفضل الخامات بأفضل الأسعار',
  phone: '01000000000',
  address: 'الفرع الرئيسي',
  taxNumber: '',
  commercialRecord: '',
  currencySymbol: 'ج.م',
  currencyCode: 'EGP',
  defaultWallet: 'cash',
  wallets: [
    { id: 'cash', name: 'خزينة المحل (كاش)', isDefault: true },
    { id: 'bank', name: 'الحساب البنكي' },
    { id: 'wallet', name: 'محفظة إلكترونية / فودافون كاش' },
  ],
  colorLetters: {
    'أسود': 'B',
    'أبيض': 'W',
    'بني': 'BR',
    'بيج': 'BE',
    'كحلي': 'N',
    'رمادي': 'G',
    'أحمر': 'R',
    'كافيه': 'C',
    'ذهبي': 'GL',
    'فضي': 'S',
    'هافان': 'H',
    'زيتي': 'OL',
  },
  mismatchThreshold: 50, // 50 جنيه
  lowStockThreshold: 5,
  enableTax: false,
  defaultTaxRate: 14,
  printPaperWidth: '80mm',
  autoBackupLocal: true,
  language: 'ar',
};
