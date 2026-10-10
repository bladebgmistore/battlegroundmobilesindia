import { Suspense } from "react";
import SupportPage from "@/components/support-page";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support Chat | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

/**
 * Order-based support ticket chat ("Chat with Admin" from My Orders).
 * Requires a signed-in buyer — the ticket is always tied to their own order.
 */
export default async function Page() {
  await requireSession("/support");
  return (
    <Suspense fallback={null}>
      <SupportPage />
    </Suspense>
  );
}
