"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FiCheck, FiShoppingCart } from "react-icons/fi";
import { cartLineId, useCart, type CartInput } from "@/components/cart-provider";

/**
 * "ADD TO CART" button used on every product card.
 *
 * • Writes into the shared cart (badge + drawer update instantly, and the line
 *   is persisted to localStorage).
 * • Flashes "ADDED ✓" for ~1.8s so the customer gets feedback even with the
 *   drawer closed.
 * • `openDrawer` opens the slide-over immediately (used in the accounts
 *   quick-view modal where a confirming drawer feels natural).
 *
 * Styling reuses the store's own `.btn-outline` / `.btn-primary` classes, so
 * the cards keep their existing look.
 */
export function AddToCartButton({
  item,
  className = "",
  label = "ADD TO CART",
  addedLabel = "ADDED",
  variant = "outline",
  compact = false,
  openDrawer = false,
}: {
  item: CartInput;
  /** Extra Tailwind classes — sizing/tracking are usually overridden here. */
  className?: string;
  label?: string;
  addedLabel?: string;
  variant?: "outline" | "primary" | "ghost";
  /** Smaller padding + 10px text for dense grids (UC packages). */
  compact?: boolean;
  openDrawer?: boolean;
}) {
  const { addItem, lastAddedId } = useCart();
  const lineId = cartLineId(item.id, item.title);
  const added = lastAddedId === lineId;

  const base = compact
    ? "!py-2 !px-3.5 !text-[10px]"
    : "!py-3.5 !px-4 text-[11px] tracking-[.1em]";

  const skins: Record<string, string> = {
    outline: "btn-outline",
    primary: "btn-primary",
    ghost: "inline-flex items-center justify-center gap-2 rounded-xl border border-[#dbe2ec] bg-white font-bold text-[#0f4c81]",
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        // Product cards link/wrap interactive elements — never bubble the click.
        event.preventDefault();
        event.stopPropagation();
        addItem(item, { open: openDrawer });
      }}
      aria-label={added ? `${item.title} added to cart` : `Add ${item.title} to cart`}
      className={`${skins[variant]} group inline-flex items-center justify-center gap-2 font-black transition ${base} ${
        added ? "!border-[#0e9f6e] !bg-[#effaf5] !text-[#0e9f6e]" : ""
      } ${className}`}
    >
      <AnimatePresence initial={false} mode="wait">
        {added ? (
          <motion.span
            key="added"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="inline-flex items-center gap-2"
          >
            <FiCheck className="text-base" />
            {addedLabel}
          </motion.span>
        ) : (
          <motion.span
            key="add"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="inline-flex items-center gap-2"
          >
            <FiShoppingCart className="text-base transition-transform group-hover:-translate-y-0.5" />
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
