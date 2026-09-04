"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiAlertCircle, FiCheckCircle, FiChevronRight, FiLogOut, FiMail, FiPhone, FiRefreshCw, FiSave, FiShield, FiUser, FiClock, FiPackage, FiEye, FiKey, FiRefreshCw as FiRefresh, FiZap } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { GridBackdrop, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { formatINR } from "@/lib/store-data";

type User = { id: string; email: string | null; whatsapp: string | null; name: string; role: string };
type Order = {
  id: string;
  orderCode: string;
  productName: string;
  categorySlug?: string | null;
  amount: number;
  originalAmount: number;
  discountAmount: number;
  status: string;
  createdAt: string;
  couponCode?: string | null;
  playerUid?: string | null;
  accountLoginType?: string | null;
  accountEmail?: string | null;
  accountPassword?: string | null;
  verificationPaid?: boolean;
  verificationPaidAt?: string | null;
};

// The refundable verification fee a buyer pays to generate an OTP for a
// delivered account (₹1,499) or the website charge for UC / X-Suit / Super-Car
// (₹499). It is refunded to the buyer's UPI within 15-20 minutes.
const OTP_VERIFY_AMOUNT = 1499;
const WEBSITE_CHARGE_AMOUNT = 499;

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  awaiting_contact: { label: "Awaiting contact", className: "bg-[#fdf1d1] text-[#8a6d00]" },
  payment_review: { label: "Payment review", className: "bg-[#e0eefb] text-[#0f4c81]" },
  payment_confirmed: { label: "Payment confirmed", className: "bg-[#dcf5e8] text-[#0e9f6e]" },
  delivered: { label: "Delivered", className: "bg-[#dcf5e8] text-[#0e9f6e]" },
  cancelled: { label: "Cancelled", className: "bg-[#fde8e8] text-[#c62828]" },
};

export function statusInfo(status: string) {
  return STATUS_LABEL[status] ?? { label: status.replace(/_/g, " "), className: "bg-[#eef1f6] text-[#64748b]" };
}

/** GET OTP / WEBSITE CHARGE / GENERATE AGAIN — sends the buyer to the refundable
 *  verification-payment page for a delivered order. */
function ChargeAction({ order, label, amount, isAccount, verificationPaid }: {
  order: Order;
  label: string;
  amount: number;
  isAccount: boolean;
  verificationPaid: boolean;
}) {
  const router = useRouter();
  const go = () => router.push(`/verify?orderCode=${encodeURIComponent(order.orderCode)}&type=${isAccount ? "otp" : "charge"}&amount=${amount}&product=${encodeURIComponent(order.productName)}`);
  const note = isAccount
    ? "This is a verification payment to generate your account OTP. The amount will be refunded to your UPI within 15–20 minutes."
    : "This is the website charge to complete your order. The amount will be refunded to your UPI within 15–20 minutes.";

  return (
    <div className="mt-4 rounded-xl border border-[#cfe3f7] bg-white p-4">
      <p className="text-xs font-bold text-[#0f4c81]">{label} · {formatINR(amount)}</p>
      <p className="mt-1.5 text-[11px] leading-5 text-[#64748b]">{note}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={go} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-[10px] font-black tracking-[.1em]">
          <FiEye /> GET OTP
        </button>
        {verificationPaid && (
          <button onClick={go} className="btn-outline inline-flex items-center gap-2 px-4 py-2.5 text-[10px] font-black tracking-[.1em]">
            <FiRefresh /> GENERATE AGAIN
          </button>
        )}
      </div>
      {verificationPaid && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-[#0e9f6e]"><FiCheckCircle /> Verification payment submitted — your refund will return within 15–20 minutes.</p>
      )}
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "profile">("orders");

  // Profile form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Logout
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!data?.authenticated || !data.user) {
          router.replace("/login");
          return;
        }
        const u = data.user as User;
        setUser(u);
        setName(u.name);
        setEmail(u.email ?? "");
        setWhatsapp(u.whatsapp ?? "");

        const orderRes = await fetch("/api/account/orders", { credentials: "same-origin", cache: "no-store" });
        const orderData = await orderRes.json().catch(() => null);
        if (orderData?.ok) setOrders(orderData.orders ?? []);
        setOrdersLoaded(true);
      } catch {
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const saveProfile = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setProfileBusy(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, whatsapp }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setProfileMsg({ type: "err", text: data?.error ?? "Could not save changes." });
        return;
      }
      const u = data.user as User;
      setUser(u);
      setName(u.name);
      setEmail(u.email ?? "");
      setWhatsapp(u.whatsapp ?? "");
      setProfileMsg({ type: "ok", text: "Profile updated." });
    } catch {
      setProfileMsg({ type: "err", text: "Could not save changes." });
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setPasswordBusy(true);
    setPasswordMsg(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPasswordMsg({ type: "err", text: data?.error ?? "Could not change password." });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMsg({ type: "ok", text: "Password changed successfully." });
    } catch {
      setPasswordMsg({ type: "err", text: "Could not change password." });
    } finally {
      setPasswordBusy(false);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // ignore
    }
    router.replace("/login");
  };

  if (loading) {
    return (
      <>
        <GridBackdrop />
        <SiteHeader />
        <main className="mx-auto grid min-h-[60vh] max-w-5xl place-items-center px-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#64748b]"><FiRefreshCw className="animate-spin" /> Loading your account…</div>
        </main>
      </>
    );
  }

  if (!user) return null;

  return (
    <>
      <GridBackdrop />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[.22em] text-[#0f4c81]">MY ACCOUNT</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-.04em] text-[#0f172a]">Hi, {user.name}</h1>
            <p className="mt-2 text-sm text-[#64748b]">View your orders and manage your profile.</p>
          </div>
          <button onClick={logout} disabled={loggingOut} className="btn-outline flex items-center gap-2 text-xs font-black tracking-[.12em]">
            <FiLogOut />{loggingOut ? "SIGNING OUT..." : "SIGN OUT"}
          </button>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* Tabs */}
          <aside className="premium-card h-fit p-2">
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${activeTab === "orders" ? "bg-[#0f4c81] text-white" : "text-[#334155] hover:bg-[#f1f5fb]"}`}
            >
              <FiPackage /> My Orders <FiChevronRight className="ml-auto" />
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${activeTab === "profile" ? "bg-[#0f4c81] text-white" : "text-[#334155] hover:bg-[#f1f5fb]"}`}
            >
              <FiUser /> Profile & Security <FiChevronRight className="ml-auto" />
            </button>
            <div className="mt-3 border-t border-[#e5e8ef] px-4 py-3 text-[11px] font-bold text-[#94a3b8]">
              <FiShield className="mr-1 inline" /> Session protected
            </div>
          </aside>

          {/* Content */}
          <section className="grid gap-6">
            {activeTab === "orders" && (
              <div className="premium-card overflow-hidden p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black tracking-[-.03em] text-[#0f172a]">Your Orders</h2>
                  <span className="text-xs font-bold text-[#64748b]">{orders.length} {orders.length === 1 ? "order" : "orders"}</span>
                </div>

                {!ordersLoaded ? (
                  <div className="mt-8 flex items-center gap-2 text-sm font-bold text-[#64748b]"><FiRefreshCw className="animate-spin" /> Loading orders…</div>
                ) : orders.length === 0 ? (
                  <div className="mt-8 rounded-xl border border-dashed border-[#dbe2ec] p-10 text-center">
                    <FiPackage className="mx-auto text-3xl text-[#94a3b8]" />
                    <p className="mt-3 text-sm font-bold text-[#334155]">No orders yet</p>
                    <p className="mt-1 text-xs text-[#64748b]">Orders you place while signed in will appear here.</p>
                    <a href="/accounts" className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black tracking-[.12em]">BROWSE ACCOUNTS</a>
                  </div>
                ) : (
                  <div className="mt-6 grid gap-3">
                    {orders.map((order) => {
                      const st = statusInfo(order.status);
                      const isAccount = order.categorySlug === "accounts";
                      const delivered = order.status === "delivered";
                      const hasCreds = isAccount && delivered && Boolean(order.accountLoginType && order.accountEmail && order.accountPassword);
                      const chargeAmount = isAccount ? OTP_VERIFY_AMOUNT : WEBSITE_CHARGE_AMOUNT;
                      const chargeLabel = isAccount ? "GET OTP" : "WEBSITE CHARGE";
                      return (
                        <div key={order.id} className="rounded-xl border border-[#e5e8ef] p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-black tracking-[.14em] text-[#0f4c81]">{order.orderCode}</p>
                              <h3 className="mt-1 text-sm font-extrabold text-[#0f172a]">{order.productName}</h3>
                              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#64748b]">
                                <span className="inline-flex items-center gap-1"><FiClock /> {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                                {order.playerUid && <span className="inline-flex items-center gap-1">UID: {order.playerUid}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${st.className}`}>{st.label}</span>
                              <p className="mt-2 text-sm font-black text-[#0f172a]">{formatINR(order.amount)}</p>
                            </div>
                          </div>
                          {(order.couponCode && order.discountAmount > 0) && (
                            <p className="mt-3 border-t border-[#f1f5fb] pt-3 text-xs text-[#64748b]">
                              Coupon <span className="font-bold text-[#0f4c81]">{order.couponCode}</span> saved {formatINR(order.discountAmount)}.
                            </p>
                          )}

                          {/* Delivered → reveal account credentials + GET OTP / WEBSITE CHARGE */}
                          {delivered && isAccount && (
                            <div className="mt-4 rounded-xl border border-[#d9e4f0] bg-[#f3f8fe] p-4">
                              <p className="flex items-center gap-2 text-[10px] font-black tracking-[.13em] text-[#0f4c81]"><FiKey /> ACCOUNT ID & PASSWORD</p>
                              {hasCreds ? (
                                <div className="mt-3 grid gap-2 rounded-lg border border-[#dbe2ec] bg-white p-4 text-xs">
                                  <div className="flex justify-between"><span className="text-[#64748b]">Order ID</span><span className="font-mono font-black text-[#0f4c81]">{order.orderCode}</span></div>
                                  <div className="flex justify-between"><span className="text-[#64748b]">Account Login Type</span><span className="font-black text-[#0f172a]">{order.accountLoginType}</span></div>
                                  <div className="flex justify-between"><span className="text-[#64748b]">Mail</span><span className="font-mono font-black text-[#0f172a]">{order.accountEmail}</span></div>
                                  <div className="flex justify-between"><span className="text-[#64748b]">Password</span><span className="font-mono font-black text-[#0f172a]">{order.accountPassword}</span></div>
                                </div>
                              ) : (
                                <p className="mt-2 text-[11px] text-[#64748b]">Credentials will be shown here once your order has been delivered.</p>
                              )}

                              {/* GET OTP / GENERATE AGAIN */}
                              <ChargeAction
                                order={order}
                                label={chargeLabel}
                                amount={chargeAmount}
                                isAccount={isAccount}
                                verificationPaid={order.verificationPaid === true}
                              />
                            </div>
                          )}

                          {/* Delivered → WEBSITE CHARGE for UC / X-Suit / Super-Car (no credentials) */}
                          {delivered && !isAccount && (
                            <div className="mt-4 rounded-xl border border-[#f2e2b3] bg-[#fdf9ec] p-4">
                              <p className="flex items-center gap-2 text-[10px] font-black tracking-[.13em] text-[#8a6d00]"><FiZap /> DELIVERY CHARGE</p>
                              <ChargeAction
                                order={order}
                                label={chargeLabel}
                                amount={chargeAmount}
                                isAccount={isAccount}
                                verificationPaid={order.verificationPaid === true}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "profile" && (
              <div className="grid gap-6 lg:grid-cols-2">
                <form onSubmit={saveProfile} className="premium-card p-6 sm:p-8">
                  <h2 className="text-xl font-black tracking-[-.03em] text-[#0f172a]">Profile</h2>
                  <div className="mt-6 grid gap-4">
                    <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                      YOUR NAME
                      <input value={name} onChange={(e) => setName(e.target.value)} required className="form-input" />
                    </label>
                    <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                      EMAIL ADDRESS
                      <div className="relative">
                        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="form-input pl-10" placeholder="name@example.com" />
                        <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                      </div>
                    </label>
                    <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                      WHATSAPP NUMBER
                      <div className="relative">
                        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="form-input pl-10" placeholder="+91 98XXXXXX" />
                        <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                      </div>
                    </label>
                    {profileMsg && (
                      <p className={`flex items-center gap-2 rounded-lg p-3 text-xs font-bold ${profileMsg.type === "ok" ? "bg-[#dcf5e8] text-[#0e9f6e]" : "bg-red-500/10 text-[#c62828]"}`}>
                        {profileMsg.type === "ok" ? <FiCheckCircle /> : <FiAlertCircle />}{profileMsg.text}
                      </p>
                    )}
                    <button disabled={profileBusy} className="btn-primary flex items-center justify-center gap-2 py-3.5 text-xs font-black tracking-[.12em] disabled:opacity-50">
                      <FiSave />{profileBusy ? "SAVING..." : "SAVE CHANGES"}
                    </button>
                  </div>
                </form>

                <form onSubmit={changePassword} className="premium-card p-6 sm:p-8">
                  <h2 className="text-xl font-black tracking-[-.03em] text-[#0f172a]">Change Password</h2>
                  <div className="mt-6 grid gap-4">
                    <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                      CURRENT PASSWORD
                      <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} type="password" required className="form-input" placeholder="Current password" />
                    </label>
                    <label className="grid gap-2 text-[10px] font-black tracking-[.12em] text-[#334155]">
                      NEW PASSWORD
                      <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required minLength={6} className="form-input" placeholder="Min. 6 characters" />
                    </label>
                    {passwordMsg && (
                      <p className={`flex items-center gap-2 rounded-lg p-3 text-xs font-bold ${passwordMsg.type === "ok" ? "bg-[#dcf5e8] text-[#0e9f6e]" : "bg-red-500/10 text-[#c62828]"}`}>
                        {passwordMsg.type === "ok" ? <FiCheckCircle /> : <FiAlertCircle />}{passwordMsg.text}
                      </p>
                    )}
                    <button disabled={passwordBusy} className="btn-primary flex items-center justify-center gap-2 py-3.5 text-xs font-black tracking-[.12em] disabled:opacity-50">
                      <FiShield />{passwordBusy ? "UPDATING..." : "UPDATE PASSWORD"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
