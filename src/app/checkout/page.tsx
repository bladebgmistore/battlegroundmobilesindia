import { Suspense } from "react";
import { redirect } from "next/navigation";
import CheckoutPage from "@/components/checkout-page";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout | Battleground India Store" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const params = await searchParams;

  if (!session) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (typeof val === "string") qs.set(key, val);
      else if (Array.isArray(val) && val[0]) qs.set(key, val[0]);
    }
    const target = `/checkout${qs.toString() ? `?${qs.toString()}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(target)}`);
  }

  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#eef1f6] text-xs font-black tracking-[.14em] text-[#0f4c81]">LOADING CHECKOUT…</main>}>
      <CheckoutPage />
    </Suspense>
  );
}
