import VerifyPage from "@/components/verify-page";
import { Suspense } from "react";

export const metadata = { title: "Verification Payment | Battleground India Store" };

export default function Page() {
  return (
    <Suspense fallback={<div className="grid min-h-[60vh] place-items-center text-sm font-bold text-[#64748b]">Loading…</div>}>
      <VerifyPage />
    </Suspense>
  );
}
