import { Suspense } from "react";
import PaymentPage from "@/components/payment-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "UPI Payment | Battleground Mobile India Store" };

export default function Page() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#eef1f6] text-xs font-black tracking-[.15em] text-[#0f4c81]">LOADING PAYMENT...</main>}>
      <PaymentPage />
    </Suspense>
  );
}
