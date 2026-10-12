"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { FiArrowRight, FiLock, FiMinus, FiPlus, FiShoppingBag, FiTrash2, FiX } from "react-icons/fi";
import { useCart } from "@/components/cart-provider";
import { formatINR } from "@/lib/store-data";
import { navigateToCheckout } from "@/lib/checkout-auth";

/**
 * Slide-over cart drawer.
 *
 * Mounted once in the root layout so it can be opened from anywhere (navbar
 * icon, "add to cart" flash, etc.). Quantities, removal and the running total
 * are all live — the same numbers the checkout page receives.
 */
export function CartDrawer() {
  const { items, count, subtotal, savings, isOpen, isReady, closeCart, increment, decrement, removeItem, clear, buildCheckoutUrl, requiresUid } =
    useCart();
  const router = useRouter();

  /* Escape closes the drawer. */
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeCart, isOpen]);

  /* Lock background scrolling while the drawer is open. */
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const checkout = async () => {
    const url = buildCheckoutUrl();
    closeCart();
    await navigateToCheckout(router, url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        /* The direct AnimatePresence child is a motion element so the exit
           animation is guaranteed to run before the subtree unmounts. */
        <motion.div
          key="cart-drawer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70]"
          role="dialog"
          aria-modal="true"
          aria-label="Shopping cart"
        >
          <div onClick={closeCart} className="absolute inset-0 bg-black/45 backdrop-blur-sm" />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[#dbe2ec] bg-white shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 border-b border-[#e5e8ef] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e0eefb] text-lg text-[#0f4c81]">
                  <FiShoppingBag />
                </span>
                <div>
                  <p className="text-[10px] font-bold tracking-[.18em] text-[#0f4c81]">YOUR CART</p>
                  <p className="text-sm font-black tracking-[-.02em] text-[#0f172a]">
                    {count === 0 ? "No items yet" : `${count} item${count === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeCart}
                aria-label="Close cart"
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-lg text-[#334155] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"
              >
                <FiX />
              </button>
            </header>

            {/* Items */}
            <div className="grow overflow-y-auto px-5 py-4">
              {!isReady ? (
                <p className="py-16 text-center text-xs font-bold tracking-[.14em] text-[#94a3b8]">LOADING CART…</p>
              ) : items.length === 0 ? (
                <div className="grid place-items-center gap-3 py-16 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl border border-[#dbe2ec] bg-[#f6f9fd] text-2xl text-[#0f4c81]">
                    <FiShoppingBag />
                  </span>
                  <p className="text-base font-black text-[#0f172a]">Your cart is empty</p>
                  <p className="max-w-[16rem] text-xs leading-5 text-[#64748b]">
                    Browse the live catalog and tap <span className="font-bold">ADD TO CART</span> on any listing.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={closeCart} className="btn-primary !py-3 !px-5 text-[10px]">
                      CONTINUE SHOPPING
                    </button>
                    <Link href="/accounts" onClick={closeCart} className="btn-outline !py-3 !px-5 text-[10px]">
                      BROWSE ACCOUNTS
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="grid gap-3">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="fade-in flex gap-3 rounded-xl border border-[#e5e8ef] bg-white p-3 shadow-sm"
                    >
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#eef1f6] bg-[#eef1f6]">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-[#94a3b8]">
                            <FiShoppingBag />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 grow">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-[12px] font-bold leading-4 text-[#0f172a]">{item.title}</p>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.title}`}
                            className="shrink-0 rounded-md p-1.5 text-[#94a3b8] transition hover:bg-red-50 hover:text-[#c62828]"
                          >
                            <FiTrash2 />
                          </button>
                        </div>

                        {item.categorySlug ? (
                          <p className="mt-1 text-[9px] font-bold tracking-[.14em] text-[#0f4c81]">
                            {item.categorySlug.replace(/-/g, " ").toUpperCase()}
                          </p>
                        ) : null}

                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => decrement(item.id)}
                              aria-label="Decrease quantity"
                              className="grid h-7 w-7 place-items-center rounded-lg border border-[#dbe2ec] text-sm text-[#334155] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"
                            >
                              <FiMinus />
                            </button>
                            <span className="min-w-[2rem] text-center text-xs font-black text-[#0f172a]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => increment(item.id)}
                              aria-label="Increase quantity"
                              className="grid h-7 w-7 place-items-center rounded-lg border border-[#dbe2ec] text-sm text-[#334155] transition hover:border-[#0f4c81] hover:text-[#0f4c81]"
                            >
                              <FiPlus />
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-[#0f172a]">{formatINR(item.price * item.quantity)}</p>
                            {item.quantity > 1 ? (
                              <p className="text-[10px] font-semibold text-[#94a3b8]">{formatINR(item.price)} each</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer / totals */}
            {isReady && items.length > 0 ? (
              <footer className="border-t border-[#e5e8ef] bg-[#f8fafc] px-5 py-4">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between text-xs text-[#64748b]">
                    <span>Subtotal ({count} item{count === 1 ? "" : "s"})</span>
                    <strong className="text-sm text-[#0f172a]">{formatINR(subtotal)}</strong>
                  </div>
                  {savings > 0 ? (
                    <div className="flex items-center justify-between text-xs text-[#0e9f6e]">
                      <span>You save</span>
                      <strong className="text-sm">{formatINR(savings)}</strong>
                    </div>
                  ) : null}
                  <div className="mt-1 flex items-center justify-between border-t border-[#e5e8ef] pt-2.5">
                    <span className="text-xs font-bold tracking-[.1em] text-[#334155]">TOTAL PAYABLE</span>
                    <strong className="text-xl font-black tracking-[-.03em] text-[#0f172a]">{formatINR(subtotal)}</strong>
                  </div>
                </div>

                {requiresUid ? (
                  <p className="mt-3 rounded-lg border border-[#d9e4f0] bg-[#f3f8fe] px-3 py-2 text-[10px] font-bold leading-4 tracking-wide text-[#0f4c81]">
                    A BGMI PLAYER UID IS REQUIRED FOR ONE OR MORE ITEMS — YOU’LL ADD IT AT CHECKOUT.
                  </p>
                ) : null}

                <button type="button" onClick={checkout} className="btn-primary mt-4 w-full !py-4 text-xs">
                  PROCEED TO CHECKOUT <FiArrowRight className="text-base" />
                </button>
                <div className="mt-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={closeCart}
                    className="text-[10px] font-bold tracking-[.12em] text-[#64748b] transition hover:text-[#0f172a]"
                  >
                    CONTINUE SHOPPING
                  </button>
                  <button
                    type="button"
                    onClick={clear}
                    className="text-[10px] font-bold tracking-[.12em] text-[#c62828] transition hover:text-[#8f2020]"
                  >
                    CLEAR CART
                  </button>
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium tracking-wide text-[#94a3b8]">
                  <FiLock /> Coupons can still be applied on the checkout page.
                </p>
              </footer>
            ) : null}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
