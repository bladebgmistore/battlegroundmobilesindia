import { demoGet, demoSet, demoValues, demoDelete } from "@/lib/demo-store";

/**
 * Demo order store.
 *
 * Mirrors the `orders` table but lives in the file-backed demo store so the
 * full purchase → deliver → reveal-credentials → OTP/charge flow can be
 * demonstrated in the preview where DATABASE_URL is absent. Every order is
 * keyed by its orderCode. In production (DATABASE_URL set) the database is
 * always used instead.
 */

export type DemoOrder = Record<string, unknown> & {
  id: string;
  orderCode: string;
  userId?: string | null;
  categorySlug?: string | null;
  customerName: string;
  customerWhatsapp: string;
  playerUid?: string | null;
  playerName?: string | null;
  productName: string;
  originalAmount: number;
  discountAmount: number;
  couponCode?: string | null;
  amount: number;
  status: string;
  accountLoginType?: string | null;
  accountEmail?: string | null;
  accountPassword?: string | null;
  verificationPaid?: boolean;
  verificationScreenshot?: string | null;
  verificationPaidAt?: string | Date | null;
  paymentScreenshot?: string | null;
  buyerIp?: string | null;
  buyerCity?: string | null;
  buyerRegion?: string | null;
  buyerCountry?: string | null;
  paidAt?: string | Date | null;
  createdAt: string | Date;
};

const COLLECTION = "orders";

export function demoSaveOrder(order: DemoOrder): void {
  demoSet(COLLECTION, order.orderCode, order);
}

export function demoUpdateOrder(orderCode: string, patch: Partial<DemoOrder>): DemoOrder | null {
  const existing = demoGet<DemoOrder>(COLLECTION, orderCode);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  demoSet(COLLECTION, orderCode, updated);
  return updated;
}

export function demoGetOrderByCode(orderCode: string): DemoOrder | null {
  return demoGet<DemoOrder>(COLLECTION, orderCode) ?? null;
}

export function demoListAllOrders(): DemoOrder[] {
  return demoValues<DemoOrder>(COLLECTION).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function demoListOrdersByUser(userId: string): DemoOrder[] {
  return demoListAllOrders().filter((o) => o.userId === userId);
}

export function demoDeleteOrders(orderCodes: string[]): void {
  for (const code of orderCodes) demoDelete(COLLECTION, code);
}
