"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FiShoppingCart } from "react-icons/fi";
import { useCart } from "@/components/cart-provider";

/**
 * Navbar cart control — live badge with the number of units in the cart.
 *
 * Mounted in the header (desktop + mobile) from `src/components/site-chrome.tsx`.
 * The badge only renders after hydration (`isReady`) so the server-rendered
 * HTML always matches the first client render.
 */
export function CartButton({ className = "" }: { className?: string }) {
  const { count, isReady, isOpen, toggleCart, lastAddedId } = useCart();
  const badge = isReady ? count : 0;
  const label = badge === 0 ? "Open cart" : `Open cart, ${badge} item${badge === 1 ? "" : "s"}`;

  return (
    <button
      type="button"
      onClick={toggleCart}
      aria-label={label}
      aria-expanded={isOpen}
      className={`relative grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] bg-white text-[#334155] transition hover:border-[#0f4c81] hover:text-[#0f4c81] ${className}`}
    >
      {/* Small nudge when something is added — pure CSS, no layout shift. */}
      <motion.span
        animate={lastAddedId ? { scale: [1, 1.22, 1] } : { scale: 1 }}
        transition={{ duration: 0.42 }}
        className="grid place-items-center text-base"
      >
        <FiShoppingCart />
      </motion.span>

      <AnimatePresence>
        {badge > 0 && (
          <motion.span
            key="cart-badge"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 22 }}
            className="absolute -right-1.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[#e11d48] px-1 text-[9px] font-black text-white shadow-sm"
          >
            {badge > 99 ? "99+" : badge}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
