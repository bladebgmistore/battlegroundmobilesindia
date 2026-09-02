import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLogin from "@/components/admin-login";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Login | Battleground Mobile India Store",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(ADMIN_COOKIE)?.value);
  if (session) redirect("/admin/dashboard");
  return <AdminLogin />;
}
