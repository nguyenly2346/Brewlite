export type UserRole = 'CUSTOMER' | 'ADMIN';
export type ProductSize = 'S' | 'M' | 'L';
export type PaymentMethod = 'WALLET' | 'CARD';
export type PaymentStatus = 'SUCCESS' | 'FAILED';
export type BarStation = 'ESPRESSO_BAR' | 'COLD_BREW_BAR' | 'TEA_MATCHA_BAR';
export type OrderStatus =
  | 'PENDING'
  | 'PAID'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  loyaltyPoints: number;
}

export interface Ingredient {
  id: string;
  code: string;
  name: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
  costPerUnit: number;
  isActive: boolean;
}

export interface RecipeItem {
  id: string;
  productId: string;
  ingredientId: string;
  quantityNeeded: number;
  ingredient?: Ingredient;
}

export interface Product {
  id: string;
  code?: string;
  name: string;
  description: string;
  category: string;
  station?: BarStation;
  price: number;
  imageUrl: string;
  stock: number;
  version: number;
  isAvailable: boolean;
  recipes?: RecipeItem[];
}

export interface Topping {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface PromotionResult {
  code: string;
  description: string;
  discountPercent: number;
  maxDiscountAmount: number;
  minOrderValue: number;
  discountAmount: number;
  finalTotal: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  size: ProductSize;
  qty: number;
  sugarLevel?: string;
  iceLevel?: string;
  itemNote?: string | null;
  station?: BarStation;
  toppings: Array<{ id: string; name: string; price: number }>;
  unitPrice: number;
  lineTotal: number;
  inventoryDeducted?: boolean;
  kdsStartedAt?: string | null;
  kdsReadyAt?: string | null;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  idempotencyKey: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionRef?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderCode: string;
  userId: string;
  status: OrderStatus;
  pickupMethod?: string;
  customerNote?: string | null;
  subtotal: number;
  discountAmount: number;
  pointsUsed?: number;
  pointsDiscountAmount?: number;
  total: number;
  promotionCode?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  payments?: PaymentRecord[];
  user?: {
    id: string;
    email: string;
    fullName: string;
    loyaltyPoints?: number;
  };
}

export interface InventoryTransactionRecord {
  id: string;
  ingredientId: string;
  orderId?: string | null;
  type: 'IMPORT' | 'ORDER_DEDUCT' | 'ADJUSTMENT';
  quantityChange: number;
  balanceAfter: number;
  reason: string;
  performedBy?: string | null;
  createdAt: string;
  ingredient?: Ingredient;
}

export interface SupplierRecord {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
}

export interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  supplierId: string;
  totalAmount: number;
  status: string;
  note?: string | null;
  createdAt: string;
  supplier?: SupplierRecord;
}

export interface AdminStatsResponse {
  totalRevenue: number;
  totalOrders: number;
  activeOrdersCount: number;
  lowStockCount: number;
  lowStockProducts: Product[];
  lowStockIngredientsCount?: number;
  lowStockIngredients?: Ingredient[];
  revenueLast7Days: Array<{
    date: string;
    label: string;
    revenue: number;
    ordersCount: number;
  }>;
  statusBreakdown: Record<OrderStatus, number>;
  recentOrders: Order[];
}

export interface AdminInventoryResponse {
  ingredients: Ingredient[];
  productsWithBom: Product[];
  transactions: InventoryTransactionRecord[];
  suppliers: SupplierRecord[];
  purchaseOrders: PurchaseOrderRecord[];
}

const HTTP_LOCALHOST = ['http:', '', 'localhost:4000'].join('/');
const HTTP_LOOPBACK = ['http:', '', '127.0.0.1:4000'].join('/');

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || HTTP_LOCALHOST;

export function formatVND(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function getSizeUpcharge(size: ProductSize): number {
  if (size === 'M') return 6000;
  if (size === 'L') return 12000;
  return 0;
}

export function getStationLabel(station?: BarStation): string {
  if (station === 'COLD_BREW_BAR') return 'Trạm Ủ Lạnh Cold Brew';
  if (station === 'TEA_MATCHA_BAR') return 'Trạm Trà & Matcha';
  return 'Trạm Máy Espresso & Phin';
}

const unsplash = (photoId: string): string =>
  [
    'https:',
    '',
    'images.unsplash.com',
    `${photoId}?auto=format&fit=crop&w=900&q=80`,
  ].join('/');

export const FALLBACK_COFFEE_IMAGE = unsplash('photo-1509042239860-f550ce710b93');
export const HERO_BANNER_IMAGE = unsplash('photo-1495474472287-4d71bcdd2085');
export const ROASTERY_STORY_IMAGE = unsplash('photo-1442512595331-e89e73853f31');

async function requestApi<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const candidateBases = Array.from(
    new Set([API_BASE_URL, HTTP_LOCALHOST, HTTP_LOOPBACK]),
  );

  let lastHttpError: Error | null = null;

  for (const base of candidateBases) {
    try {
      const response = await fetch(`${base}${endpoint}`, {
        ...options,
        headers,
        cache: 'no-store',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const rawMsg = data?.message;
        const errorMessage = Array.isArray(rawMsg)
          ? rawMsg.join(', ')
          : typeof rawMsg === 'string'
            ? rawMsg
            : 'Yêu cầu không hợp lệ';
        lastHttpError = new Error(errorMessage);
        throw lastHttpError;
      }

      return data as T;
    } catch (err) {
      if (lastHttpError && err === lastHttpError) {
        throw lastHttpError;
      }
    }
  }

  throw new Error('Không thể kết nối máy chủ Backend NestJS (PostgreSQL), vui lòng kiểm tra dịch vụ đang chạy');
}

export const api = {
  getProducts: () =>
    requestApi<{ products: Product[]; toppings: Topping[] }>('/products'),

  getProductById: (id: string) =>
    requestApi<{ product: Product; toppings: Topping[] }>(`/products/${id}`),

  login: (payload: { email: string; password: string }) =>
    requestApi<{ accessToken: string; user: UserProfile }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  register: (payload: { email: string; password: string; fullName: string }) =>
    requestApi<{ accessToken: string; user: UserProfile }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getMe: (token: string) =>
    requestApi<UserProfile>('/auth/me', {}, token),

  applyPromotion: (payload: { code: string; subtotal: number }) =>
    requestApi<PromotionResult>(
      '/promotions/apply',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  createOrder: (
    token: string,
    payload: {
      items: Array<{
        productId: string;
        size: ProductSize;
        qty: number;
        toppingIds: string[];
        sugarLevel?: string;
        iceLevel?: string;
        itemNote?: string;
      }>;
      promotionCode?: string;
      pointsUsed?: number;
      pickupMethod?: string;
      customerNote?: string;
    },
  ) =>
    requestApi<Order>(
      '/orders',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    ),

  processPayment: (
    token: string,
    payload: {
      orderId: string;
      method: PaymentMethod;
      idempotencyKey: string;
      simulateFailure?: boolean;
    },
  ) =>
    requestApi<{
      payment: PaymentRecord;
      order: Order;
      idempotentReplay: boolean;
      pointsEarned: number;
    }>(
      '/payments',
      {
        method: 'POST',
        headers: {
          'idempotency-key': payload.idempotencyKey,
        },
        body: JSON.stringify(payload),
      },
      token,
    ),

  getMyOrders: (token: string) =>
    requestApi<Order[]>('/orders/me', {}, token),

  getOrderById: (token: string, id: string) =>
    requestApi<Order>(`/orders/${id}`, {}, token),

  updateOrderStatus: (token: string, id: string, status: OrderStatus) =>
    requestApi<Order>(
      `/orders/${id}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      },
      token,
    ),

  getAdminStats: (token: string) =>
    requestApi<AdminStatsResponse>('/admin/stats', {}, token),

  getAdminOrders: (token: string) =>
    requestApi<Order[]>('/admin/orders', {}, token),

  getAdminInventory: (token: string) =>
    requestApi<AdminInventoryResponse>('/admin/inventory', {}, token),

  adjustInventory: (
    token: string,
    payload: {
      ingredientId: string;
      quantityChange: number;
      type: 'IMPORT' | 'ADJUSTMENT';
      reason: string;
      supplierId?: string;
      unitCost?: number;
    },
  ) =>
    requestApi<{
      ingredient: Ingredient;
      transaction: InventoryTransactionRecord;
      purchaseOrder?: PurchaseOrderRecord | null;
    }>(
      '/admin/inventory/adjust',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    ),

  createIngredient: (
    token: string,
    payload: {
      code: string;
      name: string;
      unit: string;
      currentStock: number;
      minThreshold: number;
      costPerUnit: number;
    },
  ) =>
    requestApi<Ingredient>(
      '/admin/ingredients',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    ),

  updateIngredient: (
    token: string,
    id: string,
    payload: Partial<{
      name: string;
      unit: string;
      currentStock: number;
      minThreshold: number;
      costPerUnit: number;
    }>,
  ) =>
    requestApi<Ingredient>(
      `/admin/ingredients/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    ),

  deleteIngredient: (token: string, id: string) =>
    requestApi<{ deleted: boolean; id: string }>(
      `/admin/ingredients/${id}`,
      {
        method: 'DELETE',
      },
      token,
    ),

  upsertRecipeItem: (
    token: string,
    payload: {
      productId: string;
      ingredientId: string;
      quantityNeeded: number;
    },
  ) =>
    requestApi<RecipeItem>(
      '/admin/recipes',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    ),

  updateRecipeItem: (
    token: string,
    recipeId: string,
    payload: { quantityNeeded: number },
  ) =>
    requestApi<RecipeItem>(
      `/admin/recipes/${recipeId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    ),

  deleteRecipeItem: (token: string, recipeId: string) =>
    requestApi<{ deleted: boolean; id: string }>(
      `/admin/recipes/${recipeId}`,
      {
        method: 'DELETE',
      },
      token,
    ),

  createProduct: (
    token: string,
    payload: {
      name: string;
      description: string;
      category: string;
      price: number;
      imageUrl: string;
      stock: number;
      isAvailable?: boolean;
    },
  ) =>
    requestApi<Product>(
      '/products',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token,
    ),

  updateProduct: (
    token: string,
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      category: string;
      price: number;
      imageUrl: string;
      stock: number;
      isAvailable: boolean;
    }>,
  ) =>
    requestApi<Product>(
      `/products/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      token,
    ),

  deleteProduct: (token: string, id: string) =>
    requestApi<{ deleted: boolean; id: string }>(
      `/products/${id}`,
      {
        method: 'DELETE',
      },
      token,
    ),
};
