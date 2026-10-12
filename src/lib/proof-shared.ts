/**
 * Client-safe Customer Proofs helpers — types, order-id generation and
 * formatting rules shared by the public /proofs page, the admin workspace and
 * the server-side data layer (src/lib/proofs.ts).
 *
 * This module MUST NOT import the database: it is imported directly by client
 * components, so anything server-only would be bundled into the browser.
 */

export type Proof = {
  id: string;
  customerName: string;
  orderCode: string;
  productTitle: string;
  amount: number;
  proofImage: string | null;
  isActive: boolean;
  deliveredAt: string | null;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ProofInput = Partial<Omit<Proof, "id" | "createdAt" | "updatedAt">>;

/** #ORD-4127 — 4+ digits, stored uppercase with the leading '#'. */
export const ORDER_CODE_PATTERN = /^#ORD-\d{4,8}$/;

/** Placeholder artwork used when a proof has no uploaded image. */
export const PLACEHOLDER_PROOF_IMAGE = "/proofs/placeholder.svg";

/** Random public order id, e.g. #ORD-4127. */
export function generateOrderCode(): string {
  return `#ORD-${1000 + Math.floor(Math.random() * 9000)}`;
}

/** Normalize admin input: trim, uppercase, guarantee the '#ORD-' form. */
export function normalizeOrderCode(value: string): string {
  let code = String(value ?? "").trim().toUpperCase();
  if (code && !code.startsWith("#")) code = `#${code}`;
  if (code.startsWith("#ORD") && !ORDER_CODE_PATTERN.test(code)) {
    // e.g. "#ORD123" → "#ORD-123"
    code = code.replace(/^#ORD-?/, "#ORD-");
  }
  return code;
}
