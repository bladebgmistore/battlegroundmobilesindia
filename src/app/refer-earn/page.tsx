import ReferEarnPage from "@/components/refer-earn-page";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Refer & Earn | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireSession("/refer-earn");
  return <ReferEarnPage />;
}
