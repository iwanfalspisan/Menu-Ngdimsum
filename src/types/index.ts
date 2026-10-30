export type DimsumCategory = 'all' | 'kukus' | 'goreng' | 'spesial' | 'minuman';

export interface MenuItem {
  id: string;
  name: string;
  category: 'kukus' | 'goreng' | 'spesial' | 'minuman';
  price: number;
  description: string;
  pieces: string;
  image: string;
  isPopular?: boolean;
  isSpicy?: boolean;
  isHalal: boolean;
  isChefsPick?: boolean;
  calories?: number;
  prepTimeMinutes: number;
  inStock: boolean;
  driveFileId?: string;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
  chiliLevel?: 'Normal' | 'Extra Pedas' | 'Pisah Sambal';
}

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export type PaymentMethod = 'qris' | 'va_bca' | 'va_mandiri' | 'gopay' | 'cash';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export type OrderStatus =
  | 'menunggu_pembayaran'
  | 'diproses_dapur'
  | 'siap_saji'
  | 'dalam_pengiriman'
  | 'selesai'
  | 'dibatalkan';

export interface OrderCustomer {
  name: string;
  phone: string;
  orderType: OrderType;
  tableNumber?: string;
  deliveryAddress?: string;
  notes?: string;
}

export interface OrderItemSummary {
  id: string;
  name: string;
  price: number;
  quantity: number;
  pieces: string;
  notes?: string;
  chiliLevel?: string;
  subtotal: number;
}

export interface OrderStatusLog {
  status: OrderStatus;
  timestamp: string;
  note: string;
}

export interface Order {
  id: string;
  createdAt: string;
  customer: OrderCustomer;
  items: OrderItemSummary[];
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  discount: number;
  total: number;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    paidAt?: string;
    referenceNumber: string;
  };
  status: OrderStatus;
  estimatedTimeMinutes: number;
  statusHistory: OrderStatusLog[];
  syncedToGoogleSheet: boolean;
  googleSheetRowId?: number;
  whatsappNotified: boolean;
}

export interface GoogleSheetConfig {
  webAppUrl: string;
  spreadsheetUrl: string;
  driveFolderUrl: string;
  spreadsheetId?: string;
  spreadsheetName: string;
  driveFolderId?: string;
  autoSync: boolean;
  syncIntervalSeconds?: number;
  lastSyncAt?: string;
  syncStatus: 'idle' | 'syncing' | 'connected' | 'error';
  errorMessage?: string;
}

export interface StoreSettings {
  storeName: string;
  storeLogoUrl?: string;
  tagline: string;
  adminWhatsapp: string;
  storeAddress: string;
  openingHours: string;
  isStoreOpen: boolean;
  qrisMerchantName: string;
  customQrisImageUrl?: string;
  packagingFeeDineIn: number;
  packagingFeeTakeaway: number;
  deliveryFeeFixed: number;
  estimatedPrepTimeBase: number;
  promoEnabled?: boolean;
  promoBadge?: string;
  promoTitle?: string;
  promoDescription?: string;
  promoHighlightText?: string;
  promoImageUrl?: string;
  promoCategoryTarget?: DimsumCategory;
}
