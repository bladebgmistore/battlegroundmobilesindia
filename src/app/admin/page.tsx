import AdminDashboard from "@/components/admin-dashboard";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Panel | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

/**
 * Owner-only admin area.
 * Access is granted purely by Google identity: `requireOwner()` redirects
 * anyone whose email is not in the OWNER_EMAIL allow-list.
 */
export default async function Page() {
  const session = await requireOwner("/admin");

  return (
    <AdminDashboard
      owner={{ name: session.name, email: session.email, role: session.role, picture: session.picture }}
    />
  );
}
