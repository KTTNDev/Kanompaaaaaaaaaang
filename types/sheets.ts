export type QuickSalesChannel = "STORE" | "APP";
export type QuickPaymentMethod = "CASH" | "QR" | "CARD" | "OTHER";

export interface QuickProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  appPrice: number;
  cost: number;
  imageUrl: string;
  active: boolean;
  sortOrder: number;
  trackStock: boolean;
  currentStock: number;
  minStock: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuickOrderItem {
  id: string;
  orderNumber: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  lineCost: number;
}

export interface QuickOrder {
  orderNumber: string;
  createdAt: string;
  channel: QuickSalesChannel;
  paymentMethod: QuickPaymentMethod;
  subtotal: number;
  discount: number;
  total: number;
  cost: number;
  profit: number;
  itemCount: number;
  receivedAmount: number;
  changeAmount: number;
  status: "COMPLETED" | "CANCELLED";
  items: QuickOrderItem[];
}

export interface QuickExpense {
  id: string;
  createdAt: string;
  category: string;
  title: string;
  amount: number;
  note: string;
}

export interface QuickWaste {
  id: string;
  createdAt: string;
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  reason: string;
  note: string;
}

export interface QuickSettings {
  storeName: string;
  currency: string;
  defaultChannel: QuickSalesChannel;
}

export interface QuickBootstrap {
  products: QuickProduct[];
  orders: QuickOrder[];
  expenses: QuickExpense[];
  waste: QuickWaste[];
  settings: QuickSettings;
  source: "GOOGLE_SHEETS" | "LOCAL_DEMO";
}
