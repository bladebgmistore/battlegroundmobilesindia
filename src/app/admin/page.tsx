import AdminDashboard from "@/components/admin-dashboard";
import { requireAdminArea } from "@/lib/clerk-auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Panel | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

/**
 * Staff admin area — now powered by Clerk.
 * Access is granted by Clerk identity: manavjeph800@gmail.com → owner,
 * plus any active member of the staff_members table (admin / manager / moderator).
 * Everyone else is redirected to their dashboard by requireAdminArea().
 */
export default async function Page() {
  const session = await requireAdminArea();

  return (
    <AdminDashboard
      owner={{ name: session.name, email: session.email, role: session.role, picture: session.picture }}
    />
  );
}
