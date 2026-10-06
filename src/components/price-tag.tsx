"use client";

import { DISCOUNT_PERCENT, formatINR, mrpOf } from "@/lib/store-data";

/**
 * Promotional price display.
 *
 * Shows the derived MRP struck out, the real (payable) price, and a
 * "50% OFF" badge — e.g. a ₹1,000 product renders as:
 *
 *   ~~₹2,000~~  ₹1,000  [50% OFF]
 *
 * The payable amount never changes; only the presentation does.
 */
export function PriceTag({
  price,
  /** Tailwind classes for the big payable price. */
  priceClass = "text-base font-black text-[#0f172a]",
  /** Stack the MRP row above the price (cards) or keep everything inline. */
  layout = "stacked",
  /** Right-align the stacked variant (price chips on image corners). */
  align = "end",
  /** Hide the discount badge when space is tight. */
  showBadge = true,
  className = "",
}: {
  price: number;
  priceClass?: string;
  layout?: "stacked" | "inline";
  align?: "start" | "end";
  showBadge?: boolean;
  className?: string;
}) {
  if (!price || price <= 0) {
    return <span className={priceClass}>On request</span>;
  }

  const mrp = mrpOf(price);
  const strike = (
    <s className="text-[11px] font-bold text-[#94a3b8] decoration-[#ef4444]/70 decoration-[1.5px]">
      {formatINR(mrp)}
    </s>
  );
  const badge = showBadge ? (
    <span className="rounded bg-[#eafaf2] px-1.5 py-0.5 text-[8px] font-black tracking-[.08em] text-[#0e9f6e]">
      {DISCOUNT_PERCENT}% OFF
    </span>
  ) : null;

  if (layout === "inline") {
    return (
      <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
        {strike}
        <span className={priceClass}>{formatINR(price)}</span>
        {badge}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col leading-tight ${align === "end" ? "items-end" : "items-start"} ${className}`}>
      <span className="flex items-center gap-1.5">
        {strike}
        {badge}
      </span>
      <span className={priceClass}>{formatINR(price)}</span>
    </span>
  );
}
