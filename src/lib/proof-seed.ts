/**
 * Pre-loaded Customer Proofs — the "verified deliveries" shown on /proofs.
 *
 * These are the exact product titles and prices from the business brief.
 * Each seeded row pairs a title/price with an Indian customer name, a random
 * order id (#ORD-xxxx), a delivery date and a generated receipt image stored
 * in `public/proofs/` (the admin can replace any image with a real invoice /
 * payment screenshot from the Customer Proofs workspace).
 *
 * Seeded exactly once — guarded by the `customer_proofs_seeded` marker in
 * site_settings (same pattern as the points store seed in referral-tables.ts).
 */

export type ProofSeed = {
  customerName: string;
  orderCode: string;
  productTitle: string;
  amount: number;
  /** Delivery date (ISO) — shown on the public card. */
  deliveredAt: string;
  sortOrder: number;
};

/** Receipt artwork for a seeded proof — one SVG per order id in public/proofs/. */
export const proofImageFor = (orderCode: string) =>
  `/proofs/${orderCode.replace(/^#/, "").toLowerCase()}.svg`;

export const PROOF_SEED: ProofSeed[] = [
  { customerName: "Rahul Sharma", orderCode: "#ORD-4127", productTitle: "POWER PACK 900 UC Unknown Cash", amount: 500, deliveredAt: "2026-09-28", sortOrder: 100 },
  { customerName: "Amit Verma", orderCode: "#ORD-7735", productTitle: "TOP UP 1,950 UC Unknown Cash", amount: 950, deliveredAt: "2026-09-21", sortOrder: 90 },
  { customerName: "Priya Patel", orderCode: "#ORD-3092", productTitle: "ELITE 4,000 UC Unknown Cash", amount: 1900, deliveredAt: "2026-09-14", sortOrder: 80 },
  { customerName: "Sandeep Yadav", orderCode: "#ORD-6648", productTitle: "MAXIMUM 4,150 UC Unknown Cash", amount: 2000, deliveredAt: "2026-09-05", sortOrder: 70 },
  { customerName: "Neha Gupta", orderCode: "#ORD-2210", productTitle: "BEST VALUE 8,100 UC Unknown Cash", amount: 3750, deliveredAt: "2026-08-27", sortOrder: 60 },
  { customerName: "Vikram Singh", orderCode: "#ORD-8453", productTitle: "UC BUNDLE 10,800 UC Unknown Cash", amount: 5000, deliveredAt: "2026-08-18", sortOrder: 50 },
  { customerName: "Anjali Mehta", orderCode: "#ORD-5136", productTitle: "M416 GLACIER MAXOUT + 25 KILL MSG 45 LABGUNS", amount: 999, deliveredAt: "2026-08-09", sortOrder: 40 },
  { customerName: "Rohit Kumar", orderCode: "#ORD-9074", productTitle: "GODZILLA SUIT  + 30 LABGUNS LEVEL 70", amount: 2999, deliveredAt: "2026-07-30", sortOrder: 30 },
  { customerName: "Sneha Reddy", orderCode: "#ORD-1789", productTitle: "All X-suit Max Mythic Tag + 190 Gunlab", amount: 12999, deliveredAt: "2026-07-21", sortOrder: 20 },
  { customerName: "Arjun Nair", orderCode: "#ORD-6420", productTitle: "Forest elf Set + 60 Gunlab 15 kill Message", amount: 1299, deliveredAt: "2026-07-11", sortOrder: 10 },
  { customerName: "Kavya Iyer", orderCode: "#ORD-3358", productTitle: "COLLECTION LEVEL 88 (HIGH) 2025 CYBERWEEK TOP 100 TITLE PORSCHE COLLECTOR PRO", amount: 5499, deliveredAt: "2026-06-29", sortOrder: 0 },
  { customerName: "Manish Tiwari", orderCode: "#ORD-7702", productTitle: "COLLECTION LEVEL 85.5 (HIGH) TRIPLE X-SUIT LVL 7 MAX DOUBLE X-SUIT LEVEL 5", amount: 1899, deliveredAt: "2026-06-17", sortOrder: -10 },
  { customerName: "Divya Joshi", orderCode: "#ORD-2865", productTitle: "LAMBO COLLECTOR PRO TITLE PHAROH XSUIT LVL 7 MAX POSEIDON XSUIT LVL 7 MAX", amount: 1299, deliveredAt: "2026-06-05", sortOrder: -20 },
  { customerName: "Karan Malhotra", orderCode: "#ORD-5981", productTitle: "STALWART GUARDIN #6 TITLE 2025 FROST FESTIVAL TITLE SILVANUS XSUIT LVL 7 MAX", amount: 2999, deliveredAt: "2026-05-24", sortOrder: -30 },
  { customerName: "Pooja Desai", orderCode: "#ORD-4416", productTitle: "COLLECTION LEVEL 76 ALMOST PHARAOH XSUIT LVL 6 MAX TRIPLE X-SUIT LEVEL 4", amount: 6999, deliveredAt: "2026-05-12", sortOrder: -40 },
  { customerName: "Vivek Chauhan", orderCode: "#ORD-8237", productTitle: "COLLECTION LEVEL 74 HIGH RAVAN XSUIT LVL 7 MAX FULL EMOJI SET", amount: 4499, deliveredAt: "2026-04-30", sortOrder: -50 },
  { customerName: "Shreya Kulkarni", orderCode: "#ORD-1573", productTitle: "COLLECTION LEVEL 70 HIGH S29 ROYAL LEGEND TITLE FIORE X-SUIT LEVEL 4", amount: 2999, deliveredAt: "2026-04-18", sortOrder: -60 },
  { customerName: "Deepak Pandey", orderCode: "#ORD-6908", productTitle: "COLLECTION LEVEL 82 (HIGH) 2025 FROST POINT TITLE POSRCHE COLLECTOR TITLE RAVAN XSUIT LVL 7 MAX", amount: 9499, deliveredAt: "2026-04-02", sortOrder: -70 },
  { customerName: "Meera Kapoor", orderCode: "#ORD-3540", productTitle: "FULL CP TYPE ACCOUNT PHARAOH XSUIT LVL 6 MAX FOREST ELF SET (RARE) BLACK HITMAN & TUXEDO", amount: 8999, deliveredAt: "2026-03-21", sortOrder: -80 },
  { customerName: "Aditya Rao", orderCode: "#ORD-7081", productTitle: "COLLECTION LEVEL 72 HIGH SILVANUS X SUIT LEVEL 6 PHAROAH X SUIT LEVEL 4", amount: 6499, deliveredAt: "2026-03-09", sortOrder: -90 },
  { customerName: "Nisha Bhat", orderCode: "#ORD-2694", productTitle: "STALWART GUARDIN #6 TITLE SILVANUS XSUIT LVL 7 MAX TRIPLE XSUIT LEVEL 4 FOREST ELF SET", amount: 3999, deliveredAt: "2026-02-25", sortOrder: -100 },
  { customerName: "Gaurav Saxena", orderCode: "#ORD-5367", productTitle: "MCLAREN COLLECTOR (TITLE) IGNIS X-SUIT LEVEL 5 POSIEDON X-SUIT LEVEL 5", amount: 7499, deliveredAt: "2026-02-11", sortOrder: -110 },
  { customerName: "Riya Choudhary", orderCode: "#ORD-8812", productTitle: "SILVANUS XSUIT LVL 7 MAX STYGIAN XSUIT LVL 6 MAX TRIPLE X-SUIT LEVEL 4", amount: 11999, deliveredAt: "2026-01-28", sortOrder: -120 },
  { customerName: "Mohit Agarwal", orderCode: "#ORD-4450", productTitle: "2025 COLLECTION FROST TITLE S28 ULTIMATE ROYAL TITLE ALL 3 PEAKY BUNDER SET", amount: 4299, deliveredAt: "2026-01-14", sortOrder: -130 },
  { customerName: "Simran Kaur", orderCode: "#ORD-6175", productTitle: "COLLECTION LEVEL 80 (HIGH) SILVANUS XSUIT LVL 6 MAX RAVAN XSUIT LEVEL 5", amount: 8299, deliveredAt: "2025-12-30", sortOrder: -140 },
  { customerName: "Tanmay Shetty", orderCode: "#ORD-9238", productTitle: "APOLLO COLLECTOR TITLE BUGGATI COLLECTOR TITLE PHARAOH XSUIT LVL 7 MAX", amount: 10500, deliveredAt: "2025-12-15", sortOrder: -150 },
];
