import UserDashboard from "@/components/user-dashboard";
import { requireSession } from "@/lib/auth";
import { ROLE_OWNER, isAdminAreaRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Dashboard | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await requireSession("/dashboard");

  return (
    <UserDashboard
      user={{
        name: session.name,
        email: session.email,
        picture: session.picture,
        role: session.role,
        isOwner: session.role === ROLE_OWNER,
        adminAccess: isAdminAreaRole(session.role),
      }}
      forbidden={error === "forbidden"}
    />
  );
}
