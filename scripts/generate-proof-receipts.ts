/**
 * Generates the seeded "delivery receipt" artwork for the Customer Proofs page.
 *
 * One SVG per seeded order id → `public/proofs/ord-xxxx.svg`. These are the
 * placeholder proof images referenced by the pre-loaded rows in
 * src/lib/proof-seed.ts; the admin can replace any of them with a real
 * invoice / payment screenshot from Admin → Customer Proofs.
 *
 * Run with:  npx tsx scripts/generate-proof-receipts.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROOF_SEED, proofImageFor } from "../src/lib/proof-seed";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "proofs");
mkdirSync(outDir, { recursive: true });

const esc = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inr = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const deliveredLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Word-wrap to at most `maxLines` lines of `width` chars, ellipsis on overflow. */
function wrap(text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (words.join(" ").length > lines.join(" ").length) {
    const last = lines[lines.length - 1].replace(/[\s.,:;+/-]+$/, "");
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.slice(0, maxLines);
}

/**
 * Title layout that adapts to the length of the product name:
 *   ≤ 34 chars → one line, large type
 *   ≤ 68 chars → two lines, large type
 *   longer     → three lines, smaller type (nothing is truncated)
 */
function titleBlock(title: string) {
  const length = title.length;
  if (length <= 34) {
    return { lines: wrap(title, 34, 1), startY: 402, step: 30, size: 21 };
  }
  if (length <= 68) {
    return { lines: wrap(title, 34, 2), startY: 390, step: 30, size: 21 };
  }
  return { lines: wrap(title, 44, 3), startY: 384, step: 24, size: 17 };
}

function receiptSvg(seed: (typeof PROOF_SEED)[number]): string {
  const { lines: titleLines, startY: titleY, step: titleStep, size: titleSize } = titleBlock(seed.productTitle);
  const titleSpans = titleLines
    .map((line, index) => `<text x="400" y="${titleY + index * titleStep}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${titleSize}" font-weight="700" fill="#e2e8f0">${esc(line)}</text>`)
    .join("\n      ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="Delivery receipt ${esc(seed.orderCode)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1f33"/>
      <stop offset="0.55" stop-color="#0f4c81"/>
      <stop offset="1" stop-color="#0b1f33"/>
    </linearGradient>
    <linearGradient id="chip" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0e9f6e"/>
      <stop offset="1" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <g opacity="0.08" stroke="#ffffff" stroke-width="1">
    <path d="M0 120H800M0 240H800M0 360H800M0 480H800"/>
    <path d="M160 0V600M320 0V600M480 0V600M640 0V600"/>
  </g>
  <rect x="36" y="36" width="728" height="528" rx="22" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.5"/>
  <text x="64" y="82" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="3" fill="#7dd3fc">BATTLEGROUNDS MOBILE INDIA STORE</text>
  <text x="736" y="82" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="2" fill="#94a3b8">DELIVERY RECEIPT</text>
  <line x1="64" y1="104" x2="736" y2="104" stroke="#ffffff" stroke-opacity="0.16"/>

  <circle cx="400" cy="168" r="34" fill="url(#chip)"/>
  <path d="M384 168l11 11 21-22" fill="none" stroke="#06281e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="400" y="238" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="4" fill="#34d399">DELIVERY CONFIRMED</text>

  <text x="400" y="286" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" letter-spacing="2" fill="#94a3b8">ORDER ID</text>
  <text x="400" y="330" text-anchor="middle" font-family="Courier New, monospace" font-size="40" font-weight="700" fill="#ffffff">${esc(seed.orderCode)}</text>

  <text x="400" y="362" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" letter-spacing="2" fill="#94a3b8">PRODUCT DELIVERED</text>
      ${titleSpans}

  <text x="400" y="478" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="800" fill="#fbbf24">${esc(inr(seed.amount))}</text>
  <text x="400" y="516" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#cbd5e1">Delivered on ${esc(deliveredLabel(seed.deliveredAt))} · 100% verified handover</text>

  <text x="400" y="556" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" letter-spacing="1.5" fill="#64748b">CUSTOMER: ${esc(seed.customerName.toUpperCase())} · VERIFIED BY THE STORE TEAM</text>
</svg>
`;
}

for (const seed of PROOF_SEED) {
  const file = join(outDir, `${seed.orderCode.replace(/^#/, "").toLowerCase()}.svg`);
  writeFileSync(file, receiptSvg(seed));
  console.log(`wrote public${proofImageFor(seed.orderCode)}  (${seed.customerName} · ${seed.orderCode})`);
}
console.log(`\n${PROOF_SEED.length} receipt images generated in public/proofs/`);
