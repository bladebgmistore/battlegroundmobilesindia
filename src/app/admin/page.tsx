import AdminDashboard from "@/components/admin-dashboard";
import { requireAdminArea } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Panel | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

/**
 * Staff admin area.
 * Access is granted by Google identity: OWNER_EMAIL → owner, plus any active
 * member of the staff_members table (admin / manager / moderator). Everyone
 * else is redirected to their dashboard by `requireAdminArea()`.
 */
export default async function Page() {
  const session = await requireAdminArea("/admin");

  return (
    <AdminDashboard
      owner={{ name: session.name, email: session.email, role: session.role, picture: session.picture }}
    />
  );
}
