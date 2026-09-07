/** Sales channel determines which product and modifier prices are used. */
export const SALES_CHANNELS = ["STORE", "APP"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["CASH", "QR", "CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const WASTE_REASONS = [
  "EXPIRED",
  "DAMAGED",
  "PREPARATION",
  "UNSOLD",
  "QUALITY",
  "OTHER",
] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export const EXPENSE_CATEGORIES = [
  "INGREDIENT",
  "PACKAGING",
  "LABOR",
  "RENT",
  "UTILITIES",
  "MARKETING",
  "DELIVERY_FEE",
  "MAINTENANCE",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Money is represented as a number in the UI. API/database boundaries should
 * convert Prisma Decimal values explicitly before returning frontend data.
 */
export interface Product {
  id: string;
  sku: string | null;
  categoryId: string | null;
  category: Category | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePriceStore: number;
  basePriceApp: number;
  baseCost: number;
  isActive: boolean;
  sortOrder: number;
  modifierGroups: ModifierGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ModifierGroup {
  id: string;
  productId: string;
  name: string;
  isRequired: boolean;
  maxSelect: number;
  sortOrder: number;
  items: ModifierItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ModifierItem {
  id: string;
  modifierGroupId: string;
  name: string;
  extraPriceStore: number;
  extraPriceApp: number;
  extraCost: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Immutable modifier data captured when an order is created. */
export interface SelectedModifierSnapshot {
  modifierGroupId: string;
  modifierGroupName: string;
  modifierItemId: string;
  modifierItemName: string;
  extraPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  salesChannel: SalesChannel;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  totalAmount: number;
  costAmount: number;
  grossProfit: number;
  receivedAmount: number;
  changeAmount: number;
  note: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitBasePrice: number;
  modifierUnitTotal: number;
  unitPrice: number;
  lineTotal: number;
  unitCost: number;
  lineCost: number;
  selectedModifiers: SelectedModifierSnapshot[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A cart line before it has been persisted as an OrderItem. */
export interface CartItem {
  cartItemId: string;
  product: Product;
  quantity: number;
  unitBasePrice: number;
  selectedModifiers: ModifierItem[];
  modifierUnitTotal: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
}

export interface CreateOrderInput {
  salesChannel: SalesChannel;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  receivedAmount?: number;
  customerName?: string;
  customerPhone?: string;
  note?: string;
  items: Array<{
    productId: string;
    quantity: number;
    modifierItemIds: string[];
    note?: string;
  }>;
}

export interface InventoryItem {
  id: string;
  sku: string | null;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost: number;
  stockValue: number;
  isLowStock: boolean;
  isActive: boolean;
  updatedAt: string;
}

export interface WasteRecord {
  id: string;
  inventoryItemId: string | null;
  productId: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  reason: WasteReason;
  note: string | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  note: string | null;
  expenseAt: string;
}

export interface DashboardMetrics {
  revenue: number;
  orderCount: number;
  itemsSold: number;
  averageOrderValue: number;
  costOfGoods: number;
  grossProfit: number;
  grossMarginPercentage: number;
  expenses: number;
  wasteCost: number;
  netProfit: number;
  storeRevenue: number;
  appRevenue: number;
  previousRevenue: number;
  revenueGrowthPercentage: number;
}

export interface ProductPerformance {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPercentage: number;
  classification: "STAR" | "WORKHORSE" | "PUZZLE" | "DOG";
}

export interface DailySalesPoint {
  date: string;
  revenue: number;
  profit: number;
  orders: number;
}

export function getProductPrice(product: Product, channel: SalesChannel): number {
  return channel === "STORE" ? product.basePriceStore : product.basePriceApp;
}

export function getModifierPrice(item: ModifierItem, channel: SalesChannel): number {
  return channel === "STORE" ? item.extraPriceStore : item.extraPriceApp;
}
