import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { isAdminAreaRole, ROLE_OWNER } from "@/lib/rbac";
import { effectiveRoleForEmail, resolveLoginRole } from "@/lib/staff";

export const dynamic = "force-dynamic";

/**
 * Public endpoint: who am I? Used by header and client components.
 * Now powered by Clerk — replaces old custom session cookie.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    null;

  if (!primaryEmail) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const email = primaryEmail.toLowerCase();
  const baseRole = await resolveLoginRole(email);
  const role = await effectiveRoleForEmail(email, baseRole);

  const name =
    user.fullName ||
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    email.split("@")[0];

  return NextResponse.json({
    authenticated: true,
    user: {
      id: userId,
      name,
      email,
      picture: user.imageUrl ?? null,
      role,
      isOwner: role === ROLE_OWNER,
      adminAccess: isAdminAreaRole(role),
    },
  });
}
