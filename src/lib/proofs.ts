import { db } from "@/db";
import { customerProofs } from "@/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { ensureProofTables } from "@/lib/proof-tables";
import { generateOrderCode, normalizeOrderCode, ORDER_CODE_PATTERN, type Proof, type ProofInput } from "@/lib/proof-shared";
import { isUuid } from "@/lib/referrals";
import { isUniqueViolation } from "@/lib/sql-rows";

export type { Proof, ProofInput } from "@/lib/proof-shared";
export { generateOrderCode, normalizeOrderCode } from "@/lib/proof-shared";

/**
 * Customer Proofs — CRUD + validation for the public /proofs page and the
 * Admin → Customer Proofs workspace.
 *
 * Business rules
 *  - order_code looks like #ORD-4127 and is UNIQUE; when the admin leaves it
 *    blank a random free one is generated (with a retry on collision).
 *  - amount is stored in whole rupees; the public card renders it with the
 *    Indian ₹ format (formatINR in store-data.ts).
 *  - proof_image accepts a /public path, an http(s) URL or a Base64 data URL
 *    (the admin form compresses uploads client-side before sending).
 *  - Only is_active = true proofs are returned by the public listing.
 */

const iso = (value: unknown): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** Map a database row onto the shared, JSON-safe Proof shape. */
const toProof = (row: typeof customerProofs.$inferSelect): Proof => ({
  id: row.id,
  customerName: row.customerName,
  orderCode: row.orderCode,
  productTitle: row.productTitle,
  amount: row.amount,
  proofImage: row.proofImage ?? null,
  isActive: row.isActive,
  deliveredAt: iso(row.deliveredAt),
  sortOrder: row.sortOrder,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
});

const MAX_IMAGE_CHARS = 3_000_000; // compressed Base64 screenshots stay well under this

/**
 * Validate admin input for create (all fields) or patch (only supplied
 * fields). `orderCode` may be omitted on create — a random one is generated.
 */
export function parseProofInput(data: Record<string, unknown>, partial: boolean): { value?: ProofInput; error?: string } {
  const value: ProofInput = {};

  if (!partial || data.customerName !== undefined) {
    const customerName = String(data.customerName ?? "").trim().slice(0, 120);
    if (customerName.length < 2) return { error: "Customer name is required (at least 2 characters)." };
    value.customerName = customerName;
  }

  if (data.orderCode !== undefined && String(data.orderCode).trim() !== "") {
    const orderCode = normalizeOrderCode(String(data.orderCode));
    if (!ORDER_CODE_PATTERN.test(orderCode)) {
      return { error: "Order ID must look like #ORD-1234 (e.g. #ORD-4127). Leave it blank to auto-generate." };
    }
    value.orderCode = orderCode;
  } else if (!partial) {
    value.orderCode = ""; // signal: auto-generate on insert
  }

  if (!partial || data.productTitle !== undefined) {
    const productTitle = String(data.productTitle ?? "").trim().slice(0, 300);
    if (productTitle.length < 3) return { error: "Product title is required (at least 3 characters)." };
    value.productTitle = productTitle;
  }

  if (!partial || data.amount !== undefined) {
    const amount = Number(data.amount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10_000_000) {
      return { error: "Amount must be a whole number of rupees between ₹1 and ₹1,00,00,000." };
    }
    value.amount = amount;
  }

  if (data.proofImage !== undefined) {
    const proofImage = String(data.proofImage ?? "").trim();
    if (proofImage) {
      const ok =
        proofImage.startsWith("data:image/") ||
        proofImage.startsWith("https://") ||
        proofImage.startsWith("http://") ||
        proofImage.startsWith("/");
      if (!ok) return { error: "Proof image must be an uploaded image, an image URL or a /public path." };
      if (proofImage.length > MAX_IMAGE_CHARS) return { error: "Proof image is too large — please upload a smaller screenshot." };
      value.proofImage = proofImage;
    } else {
      value.proofImage = null;
    }
  }

  if (data.isActive !== undefined) {
    value.isActive = Boolean(data.isActive);
  }

  if (data.deliveredAt !== undefined) {
    const raw = String(data.deliveredAt ?? "").trim();
    if (raw) {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return { error: "Delivery date is not a valid date." };
      value.deliveredAt = date.toISOString();
    } else {
      value.deliveredAt = null;
    }
  }

  if (data.sortOrder !== undefined) {
    const sortOrder = Number(data.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < -100000 || sortOrder > 100000) {
      return { error: "Sort order must be a whole number." };
    }
    value.sortOrder = sortOrder;
  }

  return { value };
}

/** Public listing — only active proofs, newest deliveries first. */
export async function listPublicProofs(limit = 60): Promise<Proof[] | null> {
  if (!(await ensureProofTables())) return null;
  try {
    const rows = await db
      .select()
      .from(customerProofs)
      .where(eq(customerProofs.isActive, true))
      .orderBy(desc(customerProofs.deliveredAt), desc(customerProofs.createdAt), asc(customerProofs.sortOrder))
      .limit(limit);
    return rows.map(toProof);
  } catch {
    return null;
  }
}

/** Admin listing — every proof, active or hidden. */
export async function listAllProofs(): Promise<Proof[] | null> {
  if (!(await ensureProofTables())) return null;
  try {
    const rows = await db
      .select()
      .from(customerProofs)
      .orderBy(desc(customerProofs.deliveredAt), desc(customerProofs.createdAt), asc(customerProofs.sortOrder));
    return rows.map(toProof);
  } catch {
    return null;
  }
}

/** Insert a proof; auto-generates a unique order code when none is supplied. */
export async function createProof(input: ProofInput): Promise<Proof | null> {
  if (!(await ensureProofTables())) return null;
  const base = {
    customerName: String(input.customerName ?? "").trim(),
    productTitle: String(input.productTitle ?? "").trim(),
    amount: Number(input.amount),
    proofImage: input.proofImage ?? null,
    isActive: input.isActive ?? true,
    deliveredAt: input.deliveredAt ? new Date(input.deliveredAt) : null,
    sortOrder: input.sortOrder ?? 0,
  };

  // Up to 10 attempts — a random #ORD-xxxx collision is astronomically rare,
  // but the unique index is the final guard (isUniqueViolation → retry).
  for (let attempt = 0; attempt < 10; attempt++) {
    const orderCode = input.orderCode?.trim() || generateOrderCode();
    try {
      const [created] = await db
        .insert(customerProofs)
        .values({ ...base, orderCode })
        .returning();
      return created ? toProof(created) : null;
    } catch (error) {
      if (isUniqueViolation(error) && !input.orderCode?.trim()) continue; // regenerate
      throw error;
    }
  }
  throw new Error("Could not allocate a unique order id — please try again.");
}

/** Patch a proof (only the supplied fields change). */
export async function updateProof(id: string, input: ProofInput): Promise<Proof | "not_found" | null> {
  if (!(await ensureProofTables())) return null;
  if (!isUuid(id)) return "not_found";

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.customerName !== undefined) patch.customerName = input.customerName;
  if (input.orderCode !== undefined) patch.orderCode = normalizeOrderCode(input.orderCode);
  if (input.productTitle !== undefined) patch.productTitle = input.productTitle;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.proofImage !== undefined) patch.proofImage = input.proofImage;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.deliveredAt !== undefined) patch.deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : null;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  try {
    const [updated] = await db
      .update(customerProofs)
      .set(patch)
      .where(eq(customerProofs.id, id))
      .returning();
    return updated ? toProof(updated) : "not_found";
  } catch {
    return null;
  }
}

/** Remove a proof permanently. */
export async function deleteProof(id: string): Promise<boolean | null> {
  if (!(await ensureProofTables())) return null;
  if (!isUuid(id)) return false;
  try {
    const removed = await db
      .delete(customerProofs)
      .where(and(eq(customerProofs.id, id)))
      .returning({ id: customerProofs.id });
    return removed.length > 0;
  } catch {
    return null;
  }
}
