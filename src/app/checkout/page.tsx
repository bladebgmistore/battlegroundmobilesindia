import { Suspense } from "react";
import CheckoutPage from "@/components/checkout-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout | Battleground India Store" };

export default function Page() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#eef1f6] text-xs font-black tracking-[.14em] text-[#0f4c81]">LOADING CHECKOUT…</main>}>
      <CheckoutPage />
    </Suspense>
  );
}
