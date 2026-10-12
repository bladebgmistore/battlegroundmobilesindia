import RewardsPage from "@/components/rewards-page";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Points Store | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireSession("/rewards");
  return <RewardsPage />;
}
