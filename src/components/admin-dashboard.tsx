"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FaWhatsapp } from "react-icons/fa";
import { FiArchive, FiBarChart2, FiBox, FiChevronRight, FiDownload, FiEdit3, FiEye, FiFolder, FiGift, FiImage, FiKey, FiLayout, FiLock, FiLogOut, FiMail, FiMapPin, FiMenu, FiPackage, FiPlus, FiSettings, FiShield, FiSliders, FiTrash2, FiUser, FiUsers, FiX } from "react-icons/fi";
import { Category, Product, formatINR, UcPackageItem } from "@/lib/store-data";
import { ImageInput } from "@/components/image-input";

type Coupon = { id: string; code: string; discountType: string; discountValue: number; usageLimit: number | null; usageCount: number; expiresAt: string | null; isActive: boolean };
type Order = { id: string; orderCode: string; customerName: string; customerWhatsapp: string; playerUid?: string | null; playerName?: string | null; productName: string; originalAmount?: number; discountAmount?: number; couponCode?: string | null; amount: number; status: string; paymentScreenshot?: string | null; buyerIp?: string | null; buyerCity?: string | null; buyerRegion?: string | null; buyerCountry?: string | null; paidAt?: string | null; createdAt: string };
type Message = { id: string; name: string; whatsapp: string; message: string; isRead: boolean; createdAt: string };
type SettingRow = { settingKey: string; value: unknown };
type SessionInfo = { username: string; role: string };
type AdminRow = { id: string; username: string; email: string; role: string; isActive: boolean };
type View = "overview" | "accounts" | "uc" | "super-cars" | "x-suits" | "categories" | "feedbacks" | "coupons" | "orders" | "messages" | "site" | "team";

type CatalogMutation = (entity: string, data: unknown) => Promise<boolean>;
type CatalogUpdate = (entity: string, id: string, data: unknown) => Promise<boolean>;
type CatalogDelete = (entity: string, id: string) => Promise<boolean>;

const menu: { view: View; label: string; icon: typeof FiBox }[] = [
  { view: "overview", label: "Overview", icon: FiBarChart2 },
  { view: "accounts", label: "Accounts", icon: FiBox },
  { view: "uc", label: "UC Packages", icon: FiPackage },
  { view: "super-cars", label: "Super Cars", icon: FiBox },
  { view: "x-suits", label: "X-Suits", icon: FiShield },
  { view: "categories", label: "Categories", icon: FiFolder },
  { view: "feedbacks", label: "Feedbacks", icon: FiMail },
  { view: "coupons", label: "Coupons", icon: FiGift },
  { view: "orders", label: "Orders", icon: FiArchive },
  { view: "messages", label: "Messages", icon: FiMail },
  { view: "site", label: "Site Controls", icon: FiSliders },
  { view: "team", label: "Team & Security", icon: FiUsers },
];

export default function AdminDashboard() {
  const [view, setView] = useState<View>("overview");
  const [drawer, setDrawer] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [packs, setPacks] = useState<UcPackageItem[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [databaseError, setDatabaseError] = useState("");

  const load = async () => {
    const safeJson = async (url: string) => {
      try {
        const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    };

    try {
      const [ses, cat, ord, mgmt] = await Promise.all([
        safeJson("/api/admin/session"),
        safeJson("/api/admin/catalog"),
        safeJson("/api/orders"),
        safeJson("/api/admin/management"),
      ]);

      setSession({
        username: ses?.username ?? "MANAV",
        role: ses?.role ?? "owner",
      });
      setDatabaseError(cat ? "" : "Neon catalog could not be loaded. Verify DATABASE_URL in Vercel environment variables.");
      setCategories(cat?.categories ?? []);
      setProducts(cat?.products ?? []);
      setPacks(cat?.ucPackages ?? []);
      setCoupons(cat?.coupons ?? []);
      setOrders(ord?.orders ?? []);
      setMessages(mgmt?.messages ?? []);
      setSettings(mgmt?.settings ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toast = (message: string) => { setNotice(message); setTimeout(() => setNotice(""), 2600); };

  const signout = async () => {
    try {
      await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" });
    } catch {
      // ignore
    }
    window.location.href = "/admin";
  };

  const create: CatalogMutation = async (entity, data) => {
    try {
      const r = await fetch("/api/admin/catalog", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, data }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        toast(body?.error ?? "Could not save this item.");
        return false;
      }
      toast("Saved successfully. Public store updated.");
      await load();
      return true;
    } catch {
      toast("Network error while saving.");
      return false;
    }
  };

  const update: CatalogUpdate = async (entity, id, data) => {
    try {
      const r = await fetch("/api/admin/catalog", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id, data }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        toast(body?.error ?? "Could not save changes.");
        return false;
      }
      toast("Changes saved. Public store updated.");
      await load();
      return true;
    } catch {
      toast("Network error while updating.");
      return false;
    }
  };

  const remove: CatalogDelete = async (entity, id) => {
    if (!confirm("Delete this item permanently?")) return false;
    try {
      const r = await fetch("/api/admin/catalog", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        toast(body?.error ?? "Could not delete item.");
        return false;
      }
      toast("Item deleted. Public store updated.");
      await load();
      return true;
    } catch {
      toast("Network error while deleting.");
      return false;
    }
  };

  const setOrderStatus = async (id: string, status: string) => {
    const r = await fetch("/api/orders", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    if (r.ok) { toast("Order status updated."); await load(); }
    else toast((await r.json().catch(() => null))?.error ?? "Could not update order status.");
  };

  const saveSetting = async (key: string, value: unknown) => {
    const r = await fetch("/api/admin/management", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
    if (r.ok) { toast("Site setting updated."); await load(); }
    else toast((await r.json().catch(() => null))?.error ?? "Could not save site setting.");
  };

  const deliveredOrders = useMemo(() => orders.filter((o) => o.status === "delivered"), [orders]);
  const totalRevenue = useMemo(() => deliveredOrders.reduce((a, o) => a + o.amount, 0), [deliveredOrders]);
  const charts = useMemo(() => {
    const days: { day: string; requests: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({
        day: d.toLocaleDateString("en-IN", { weekday: "short" }),
        requests: orders.filter((o) => new Date(o.createdAt).toDateString() === d.toDateString()).length,
      });
    }
    return days;
  }, [orders]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#eef1f6]"><div className="flex items-center gap-3 text-sm font-bold text-[#0f4c81]"><span className="h-3 w-3 animate-ping rounded-full bg-[#0f4c81]" /> LOADING CONTROL CENTRE</div></main>;

  const unread = messages.filter((m) => !m.isRead).length;
  const side = <>
    <div className="flex h-[78px] items-center gap-3 border-b border-[#e5e8ef] px-5">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0f4c81]/10 text-lg text-[#0f4c81]"><FiShield /></div>
      <div><p className="text-[10px] font-black tracking-[.15em] text-[#0f4c81]">BATTLEGORUND MOBILE</p><p className="text-sm font-black text-[#0f172a]">INDIA STORE</p></div>
      <button onClick={() => setDrawer(false)} className="ml-auto text-[#64748b] lg:hidden"><FiX /></button>
    </div>
    <nav className="flex-1 space-y-1 p-3">
      {menu.map(({ view: itemView, label, icon: Icon }) => (
        <button key={itemView} onClick={() => { setView(itemView); setDrawer(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-bold transition ${view === itemView ? "bg-[#e0eefb] text-[#0f4c81]" : "text-[#0f172a]/52 hover:bg-white/[.05] hover:text-[#0f172a]"}`}><Icon className="text-base" />{label}{itemView === "messages" && unread > 0 && <span className="ml-auto rounded-full bg-[#d6f454] px-1.5 py-0.5 text-[9px] text-black">{unread}</span>}</button>
      ))}
    </nav>
    <div className="border-t border-[#e5e8ef] p-3">
      <button onClick={signout} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold text-red-600/80 hover:bg-red-50">
        <FiLogOut /> Sign out
      </button>
    </div>
  </>;

  return <main className="min-h-screen bg-[#eef1f6] text-[#0f172a]">
    <div className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#e5e8ef] bg-white lg:flex lg:flex-col">{side}</div>
    <div className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#e5e8ef] bg-white transition-transform lg:hidden ${drawer ? "translate-x-0" : "-translate-x-full"}`}>{side}</div>
    {drawer && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setDrawer(false)} />}
    <div className="lg:pl-64">
      <header className="flex h-[78px] items-center justify-between border-b border-[#e5e8ef] bg-white/75 px-5 backdrop-blur lg:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setDrawer(true)} className="grid h-10 w-10 place-items-center rounded-lg border border-[#e5e8ef] text-[#0f172a] lg:hidden"><FiMenu /></button><div><p className="text-[10px] font-black tracking-[.16em] text-[#0f4c81]">ADMIN WORKSPACE</p><h1 className="text-lg font-black">{menu.find((x) => x.view === view)?.label}</h1></div></div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-black text-[#0f172a]">{session?.username ?? "MANAV"}</p>
            <p className="text-[9px] font-bold tracking-[.12em] text-[#0f4c81]">{(session?.role ?? "owner").toUpperCase()}</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#0f4c81]/15 font-black text-[#0f4c81]">
            {(session?.username ?? "M")[0]}
          </span>
        </div>
      </header>
      <div className="p-5 lg:p-8">
        {notice && <div className="fixed right-5 top-24 z-[60] rounded-lg border border-[#0f4c81]/20 bg-[#e0eefb] px-4 py-3 text-xs font-bold text-[#0f4c81] shadow-xl">{notice}</div>}
        {databaseError && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {databaseError}
          </div>
        )}
        {view === "overview" && <Overview accounts={products.filter(p => p.categorySlug === "accounts")} packs={packs} orders={orders} messages={messages} totalRevenue={totalRevenue} deliveredCount={deliveredOrders.length} charts={charts} />}
        {view === "accounts" && <ProductsManager heading="Accounts" fixedCategorySlug="accounts" products={products.filter(p => p.categorySlug === "accounts")} categories={categories} create={create} update={update} remove={remove} />}
        {view === "uc" && <UcManager packs={packs} create={create} update={update} remove={remove} />}
        {view === "super-cars" && <ProductsManager heading="Super Cars" fixedCategorySlug="super-cars" products={products.filter(p => p.categorySlug === "super-cars")} categories={categories} create={create} update={update} remove={remove} />}
        {view === "x-suits" && <ProductsManager heading="X-Suits" fixedCategorySlug="x-suits" products={products.filter(p => p.categorySlug === "x-suits")} categories={categories} create={create} update={update} remove={remove} />}
        {view === "categories" && <CategoryWorkspace categories={categories} products={products} create={create} update={update} remove={remove} />}
        {view === "feedbacks" && <FeedbacksManager create={create} update={update} remove={remove} />}
        {view === "coupons" && <CouponManager coupons={coupons} create={create} update={update} remove={remove} />}
        {view === "orders" && <OrdersPanel orders={orders} setStatus={setOrderStatus} />}
        {view === "messages" && <MessagePanel messages={messages} refresh={load} />}
        {view === "site" && <SitePanel settings={settings} save={saveSetting} />}
        {view === "team" && <TeamPanel session={session} toast={toast} />}
      </div>
    </div>
  </main>;
}

function Overview({ accounts, packs, orders, messages, totalRevenue, deliveredCount, charts }: { accounts: Product[]; packs: UcPackageItem[]; orders: Order[]; messages: Message[]; totalRevenue: number; deliveredCount: number; charts: { day: string; requests: number }[] }) {
  const stats = [["Catalog products", accounts.length + packs.length, FiBox], ["Total orders", orders.length, FiArchive], ["Delivered", deliveredCount, FiMail], ["Delivered revenue", formatINR(totalRevenue), FiBarChart2]];
  return <div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(([label, value, Icon]) => { const IconComp = Icon as typeof FiBox; return <article className="rounded-xl border border-[#e5e8ef] bg-white p-5" key={label as string}><div className="flex items-center justify-between"><p className="text-xs font-bold text-[#64748b]">{label as string}</p><IconComp className="text-[#0f4c81]" /></div><p className="mt-5 text-3xl font-black tracking-[-.05em] text-[#0f172a]">{value as string | number}</p><p className="mt-1 text-[9px] font-black tracking-[.11em] text-[#0f4c81]">LIVE DATABASE</p></article>; })}</div><div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_.7fr]"><section className="rounded-xl border border-[#e5e8ef] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="font-black">Checkout requests</h2><p className="mt-1 text-xs text-[#64748b]">Last seven days</p></div><FiBarChart2 className="text-[#0f4c81]" /></div><div className="mt-6 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={charts}><XAxis dataKey="day" stroke="#788078" tickLine={false} axisLine={false} fontSize={11} /><YAxis allowDecimals={false} stroke="#788078" tickLine={false} axisLine={false} fontSize={11} /><Tooltip contentStyle={{ background: "#0f1b2e", border: "1px solid #ffffff18", borderRadius: 10 }} cursor={{ fill: "#0f4c8110" }} /><Bar dataKey="requests" fill="#0f4c81" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></section><section className="rounded-xl border border-[#e5e8ef] bg-white p-5"><p className="text-[10px] font-black tracking-[.15em] text-[#0f4c81]">OPERATIONS</p><h2 className="mt-3 text-xl font-black">Storefront status</h2><div className="mt-6 space-y-4">{[["Catalog API", "Operational"], ["Admin session", "Protected"], ["Payment gateway", "Maintenance"], ["Support channel", "Online"]].map(([a, b]) => <div className="flex items-center justify-between border-b border-[#e5e8ef] pb-3 text-xs" key={a}><span className="text-[#64748b]">{a}</span><span className="font-bold text-[#0f4c81]">{b}</span></div>)}</div></section></div></div>;
}

function CategoryWorkspace({ categories, products, create, update, remove }: { categories: Category[]; products: Product[]; create: CatalogMutation; update: CatalogUpdate; remove: CatalogDelete }) {
  const empty = { name: "", slug: "", description: "", image: "", sortOrder: "100" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(categories[0]?.slug ?? "");

  useEffect(() => {
    if (!selectedSlug && categories[0]) setSelectedSlug(categories[0].slug);
    if (selectedSlug && !categories.some((c) => c.slug === selectedSlug)) {
      setSelectedSlug(categories[0]?.slug ?? "");
    }
  }, [categories, selectedSlug]);

  const submit = async () => {
    let image = form.image.trim();
    const driveMatch = image.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) image = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    const data = {
      ...form,
      image,
      slug: form.slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      sortOrder: Number(form.sortOrder),
      isActive: true,
    };
    const ok = editingId
      ? await update("category", editingId, data)
      : await create("category", data);
    if (ok) {
      setForm(empty);
      setEditingId(null);
    }
  };

  const startEdit = (item: Category) => {
    setEditingId(item.id);
    setSelectedSlug(item.slug);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
      image: item.image ?? "",
      sortOrder: String(item.sortOrder ?? 100),
    });
  };

  const selectedCategory = categories.find((c) => c.slug === selectedSlug);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5">
          <PanelTitle icon={editingId ? FiEdit3 : FiPlus} title={editingId ? "Edit Category" : "Add New Category"} copy="Change the public section name, URL, image, description, and homepage order." />
          <div className="mt-5 grid gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editingId ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-") })} placeholder="Category Name" className="admin-input" />
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="URL Slug (example: super-cars)" className="admin-input" />
            <ImageInput value={form.image} onChange={(image) => setForm({ ...form, image })} label="CATEGORY IMAGE / BANNER" />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Public section description" rows={3} className="admin-input resize-none py-3" style={{ height: "auto" }} />
            <input value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} type="number" placeholder="Homepage order (10, 20, 30...)" className="admin-input" />
            <button onClick={submit} className="admin-primary">{editingId ? <FiEdit3 /> : <FiPlus />} {editingId ? "SAVE CATEGORY" : "CREATE CATEGORY"}</button>
            {editingId && <button onClick={() => { setEditingId(null); setForm(empty); }} className="text-[10px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">CANCEL EDITING</button>}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
          <ListHeader title="Public Categories" count={categories.length} />
          <div className="divide-y divide-[#e5e8ef]">
            {categories.map((c) => (
              <div className={`flex gap-3 p-4 ${selectedSlug === c.slug ? "bg-[#f1f5fb]" : ""}`} key={c.id}>
                <img src={c.image} alt={c.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 grow">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-sm text-[#0f172a]">{c.name}</p>
                    <span className="rounded bg-[#f1f5fb] px-2 py-0.5 text-[9px] text-[#64748b]">ORDER {c.sortOrder ?? 100}</span>
                  </div>
                  <p className="mt-1 text-xs font-mono text-[#0f4c81]">/{c.slug}</p>
                  <p className="mt-1 truncate text-xs text-[#64748b]">{c.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Action onClick={() => { setSelectedSlug(c.slug); startEdit(c); }} label="Edit" icon={FiEdit3} />
                    <Action onClick={() => setSelectedSlug(c.slug)} label="Manage Products" icon={FiBox} />
                    <Action onClick={() => update("category", c.id, { ...c, isActive: c.isActive === false })} label={c.isActive === false ? "Enable" : "Disable"} icon={FiSettings} />
                    <Action onClick={() => remove("category", c.id)} label="Delete" icon={FiTrash2} danger />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {selectedCategory && selectedCategory.slug !== "uc" && (
        <ProductsManager
          heading={`${selectedCategory.name} Products`}
          fixedCategorySlug={selectedCategory.slug}
          products={products.filter((p) => p.categorySlug === selectedCategory.slug)}
          categories={categories}
          create={create}
          update={update}
          remove={remove}
        />
      )}
      {selectedCategory?.slug === "uc" && (
        <div className="rounded-xl border border-[#0f4c81]/20 bg-[#f1f5fb] p-5 text-sm text-[#64748b]">
          UC products are managed in the dedicated <strong className="text-[#0f4c81]">UC Packages</strong> tab. Category name, image, URL and description are edited above.
        </div>
      )}
    </div>
  );
}

function ProductsManager({ heading, fixedCategorySlug, products, categories, create, update, remove }: { heading: string; fixedCategorySlug?: string; products: Product[]; categories: Category[]; create: CatalogMutation; update: CatalogUpdate; remove: CatalogDelete }) {
  const makeEmpty = () => ({
    categorySlug: fixedCategorySlug ?? "",
    title: "",
    price: "",
    image: "",
    badge: "",
    features: "",
    sortOrder: "0",
  });
  const [form, setForm] = useState(makeEmpty);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId && fixedCategorySlug) {
      setForm((current) => ({ ...current, categorySlug: fixedCategorySlug }));
    }
  }, [fixedCategorySlug, editingId]);

  const submit = async () => {
    let image = form.image.trim();
    const driveMatch = image.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) image = `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    const data = {
      ...form,
      image,
      categorySlug: fixedCategorySlug ?? form.categorySlug,
      price: Number(form.price),
      sortOrder: Number(form.sortOrder),
      features: form.features.split("\n").map((x) => x.trim()).filter(Boolean),
      isActive: true,
    };
    const ok = editingId
      ? await update("product", editingId, data)
      : await create("product", data);
    if (ok) {
      setForm(makeEmpty());
      setEditingId(null);
    }
  };

  const startEdit = (item: Product) => {
    setEditingId(item.id);
    setForm({
      categorySlug: item.categorySlug,
      title: item.title,
      price: String(item.price),
      image: item.image,
      badge: item.badge ?? "",
      features: item.features.join("\n"),
      sortOrder: String(item.sortOrder ?? 0),
    });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5">
        <PanelTitle icon={editingId ? FiEdit3 : FiPlus} title={editingId ? `Edit ${heading} Product` : `Add ${heading} Product`} copy="Changes save to Neon and appear on the public homepage immediately." />
        <div className="mt-5 grid gap-3">
          {!fixedCategorySlug && (
            <select value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })} className="admin-input">
              <option value="">-- Choose Category --</option>
              {categories.filter((c) => c.slug !== "uc").map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          )}
          {fixedCategorySlug && <div className="rounded-lg border border-[#0f4c81]/20 bg-[#f1f5fb] px-3 py-2 text-xs font-bold text-[#0f4c81]">Category: {heading}</div>}
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Product / Deal Title" className="admin-input" />
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder="Price in INR" className="admin-input" />
          <ImageInput value={form.image} onChange={(image) => setForm({ ...form, image })} label="PRODUCT IMAGE" />
          <input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="Badge Label (example: HOT DEAL)" className="admin-input" />
          <input value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} type="number" placeholder="Product order" className="admin-input" />
          <textarea value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Features — one per line" rows={5} className="admin-input resize-none py-3" style={{ height: "auto" }} />
          <button onClick={submit} className="admin-primary">{editingId ? <FiEdit3 /> : <FiPlus />} {editingId ? "SAVE PRODUCT" : "PUBLISH PRODUCT"}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm(makeEmpty()); }} className="text-[10px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">CANCEL EDITING</button>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <ListHeader title={`${heading} Deals`} count={products.length} />
        <div className="divide-y divide-[#e5e8ef]">
          {products.length ? products.map((p) => (
            <div className="flex gap-3 p-4" key={p.id}>
              <img src={p.image} alt={p.title} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 grow">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-black text-[#0f172a]">{p.title}</p>
                  {p.badge && <span className="rounded bg-[#0f4c81]/10 px-2 py-0.5 text-[9px] font-black text-[#0f4c81]">{p.badge}</span>}
                </div>
                <p className="mt-1 text-sm font-black text-[#0f4c81]">{formatINR(p.price)}</p>
                <p className="mt-1 text-[10px] text-[#64748b]">{p.features.length} features · Order {p.sortOrder ?? 0} · {p.isActive === false ? "Disabled" : "Live"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Action onClick={() => startEdit(p)} label="Edit" icon={FiEdit3} />
                  <Action onClick={() => update("product", p.id, { ...p, isActive: p.isActive === false })} label={p.isActive === false ? "Enable" : "Disable"} icon={FiSettings} />
                  <Action onClick={() => remove("product", p.id)} label="Delete" icon={FiTrash2} danger />
                </div>
              </div>
            </div>
          )) : <Empty text={`No ${heading} products yet. Add your first deal from the form.`} />}
        </div>
      </section>
    </div>
  );
}

function UcManager({ packs, create, update, remove }: { packs: UcPackageItem[]; create: CatalogMutation; update: CatalogUpdate; remove: CatalogDelete }) {
  const empty = { price: "", ucAmount: "", bonusLabel: "" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const submit = async () => {
    const data = { ...form, price: Number(form.price), ucAmount: Number(form.ucAmount), isActive: true };
    const ok = editingId ? await update("uc", editingId, data) : await create("uc", data);
    if (ok) { setForm(empty); setEditingId(null); }
  };
  return <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5"><PanelTitle icon={editingId ? FiEdit3 : FiPlus} title={editingId ? "Edit UC package" : "Add UC package"} copy="A package becomes visible in the UC store immediately." /><div className="mt-5 grid gap-3"><input value={form.ucAmount} onChange={(e) => setForm({ ...form, ucAmount: e.target.value })} type="number" placeholder="UC quantity" className="admin-input" /><input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder="Price in INR" className="admin-input" /><input value={form.bonusLabel} onChange={(e) => setForm({ ...form, bonusLabel: e.target.value })} placeholder="Badge label (e.g. BEST VALUE)" className="admin-input" /><button onClick={submit} className="admin-primary">{editingId ? <FiEdit3 /> : <FiPlus />} {editingId ? "SAVE CHANGES" : "ADD UC PACKAGE"}</button>{editingId && <button onClick={() => { setEditingId(null); setForm(empty); }} className="text-[10px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">CANCEL EDITING</button>}</div></section><section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white"><ListHeader title="UC packages" count={packs.length} /><div className="divide-y divide-[#e5e8ef]">{packs.length ? packs.map((p) => <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={p.id}><div><p className="text-sm font-black text-[#0f172a]">{p.ucAmount.toLocaleString("en-IN")} UC</p><p className="mt-1 text-xs font-bold text-[#0f4c81]">{formatINR(p.price)} · {p.bonusLabel ?? "STANDARD"}</p></div><div className="flex gap-2"><Action onClick={() => { setEditingId(p.id); setForm({ price: String(p.price), ucAmount: String(p.ucAmount), bonusLabel: p.bonusLabel ?? "" }); }} label="Edit" icon={FiEdit3} /><Action onClick={() => update("uc", p.id, { price: p.price, ucAmount: p.ucAmount, bonusLabel: p.bonusLabel, isActive: p.isActive === false })} label={p.isActive === false ? "Enable" : "Disable"} icon={FiSettings} /><Action onClick={() => remove("uc", p.id)} label="Delete" icon={FiTrash2} danger /></div></div>) : <Empty text="No UC packages have been added yet." />}</div></section></div>;
}

function CouponManager({ coupons, create, update, remove }: { coupons: Coupon[]; create: CatalogMutation; update: CatalogUpdate; remove: CatalogDelete }) {
  const empty = { code: "", discountValue: "", discountType: "percent", usageLimit: "", expiresAt: "" };
  const [form, setForm] = useState(empty);
  const add = async () => {
    const ok = await create("coupon", { ...form, discountValue: Number(form.discountValue), usageLimit: form.usageLimit ? Number(form.usageLimit) : null });
    if (ok) setForm(empty);
  };
  return <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]"><section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5"><PanelTitle icon={FiGift} title="Create coupon" copy="Users can apply coupon codes on the checkout page." /><div className="mt-5 grid gap-3"><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Coupon code" className="admin-input" /><div className="grid grid-cols-2 gap-3"><input value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} type="number" placeholder="Discount" className="admin-input" /><select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="admin-input"><option value="percent">Percent %</option><option value="flat">Flat INR</option></select></div><input value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} type="number" placeholder="Usage limit (optional)" className="admin-input" /><input value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} type="date" className="admin-input" /><button onClick={add} className="admin-primary"><FiPlus /> CREATE COUPON</button></div></section><section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white"><ListHeader title="Active coupons" count={coupons.length} /><div className="divide-y divide-[#e5e8ef]">{coupons.length ? coupons.map((c) => <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={c.id}><div><p className="font-mono text-sm font-black text-[#0f4c81]">{c.code}</p><p className="mt-1 text-xs text-[#64748b]">{c.discountValue}{c.discountType === "percent" ? "%" : " INR"} off · {c.usageCount}/{c.usageLimit ?? "∞"} used · {c.expiresAt ? `expires ${new Date(c.expiresAt).toLocaleDateString("en-IN")}` : "no expiry"} · {c.isActive ? "Enabled" : "Disabled"}</p></div><div className="flex gap-2"><Action onClick={() => update("coupon", c.id, { discountType: c.discountType, discountValue: c.discountValue, usageLimit: c.usageLimit, expiresAt: c.expiresAt, isActive: !c.isActive })} label={c.isActive ? "Disable" : "Enable"} icon={FiSettings} /><Action onClick={() => remove("coupon", c.id)} label="Delete" icon={FiTrash2} danger /></div></div>) : <Empty text="No promotion coupons created." />}</div></section></div>;
}

const ORDER_STATUSES = ["awaiting_contact", "payment_review", "payment_confirmed", "delivered", "cancelled"];
function OrdersPanel({ orders, setStatus }: { orders: Order[]; setStatus: (id: string, status: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<Order | null>(null);
  const allSelected = orders.length > 0 && selected.length === orders.length;
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  const toggleAll = () => setSelected(allSelected ? [] : orders.map((o) => o.id));
  const deleteSelected = async () => {
    if (!selected.length) return;
    if (!confirm(`Delete ${selected.length} selected order(s) permanently?`)) return;
    const r = await fetch('/api/orders', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected }) });
    if (r.ok) window.location.reload();
  };
  const location = (o: Order) => [o.buyerCity, o.buyerRegion, o.buyerCountry].filter(Boolean).join(", ");
  const dateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e8ef] p-5">
          <div>
            <h2 className="font-black text-[#0f172a]">Order requests</h2>
            <p className="mt-1 text-xs text-[#64748b]">Full order details with player identity, buyer IP trace & payment proof.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#f1f5fb] px-2 py-1 text-[10px] font-bold text-[#64748b]">{orders.length} ITEMS</span>
            <button disabled={!selected.length} onClick={deleteSelected} className="rounded border border-red-200 px-3 py-2 text-[10px] font-black text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40">DELETE SELECTED ({selected.length})</button>
          </div>
        </div>
        {orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1360px] text-left">
              <thead className="bg-[#f8fafc] text-[9px] font-black tracking-[.13em] text-[#64748b]">
                <tr>
                  <th className="p-4"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                  <th className="p-4">REFERENCE</th>
                  <th className="p-4">DATE / TIME</th>
                  <th className="p-4">CUSTOMER</th>
                  <th className="p-4">PRODUCT</th>
                  <th className="p-4">BGMI PLAYER</th>
                  <th className="p-4">IP & LOCATION</th>
                  <th className="p-4">PRICING</th>
                  <th className="p-4">PROOF</th>
                  <th className="p-4">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e8ef]">
                {orders.map((o) => (
                  <tr key={o.id} className={`text-xs transition-colors ${selected.includes(o.id) ? 'bg-[#e0eefb]' : 'hover:bg-[#f8fafc]'}`}>
                    <td className="p-4"><input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} /></td>
                    <td className="p-4 font-mono font-bold text-[#0f4c81]">{o.orderCode}</td>
                    <td className="p-4 text-[#64748b]">
                      <p className="font-bold text-[#0f172a]">{dateTime(o.createdAt)}</p>
                      {o.paidAt && <p className="mt-1 text-[10px] text-[#0e9f6e]">Paid: {dateTime(o.paidAt)}</p>}
                    </td>
                    <td className="p-4"><p className="font-bold text-[#0f172a]">{o.customerName}</p><p className="mt-1 text-[#64748b]">{o.customerWhatsapp}</p></td>
                    <td className="max-w-[220px] p-4 text-[#64748b]">{o.productName}{o.couponCode && <p className="mt-1 text-[#0f4c81]">Coupon: {o.couponCode}</p>}</td>
                    <td className="p-4">
                      {o.playerUid ? (
                        <div>
                          <span className="rounded bg-[#e0eefb] px-2 py-1 font-mono font-black text-[#0f4c81]">{o.playerUid}</span>
                          {o.playerName && <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black text-[#0e9f6e]"><FiUser /> {o.playerName}</p>}
                        </div>
                      ) : <span className="text-[#94a3b8]">—</span>}
                    </td>
                    <td className="max-w-[190px] p-4">
                      {o.buyerIp ? (
                        <div>
                          <p className="font-mono font-bold text-[#0f172a]">{o.buyerIp}</p>
                          <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#64748b]"><FiMapPin className="shrink-0 text-[#0f4c81]" /> {location(o) || "Location unavailable"}</p>
                        </div>
                      ) : <span className="text-[#94a3b8]">—</span>}
                    </td>
                    <td className="p-4 text-[#0f172a]"><p>Original: {formatINR(o.originalAmount ?? o.amount)}</p><p className="text-[#0f4c81]">Discount: {formatINR(o.discountAmount ?? 0)}</p><p className="font-black">Final: {formatINR(o.amount)}</p></td>
                    <td className="p-4">
                      {o.paymentScreenshot ? (
                        <button onClick={() => setPreview(o)} className="group relative block overflow-hidden rounded-lg border border-[#dbe2ec] transition-transform hover:scale-105" title="Click to preview full screenshot">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={o.paymentScreenshot} alt={`Payment proof ${o.orderCode}`} className="h-14 w-14 object-cover" />
                          <span className="absolute inset-0 grid place-items-center bg-[#0f172a]/0 text-white opacity-0 transition-all group-hover:bg-[#0f172a]/40 group-hover:opacity-100"><FiEye /></span>
                        </button>
                      ) : <span className="rounded bg-[#f1f5fb] px-2 py-1 text-[9px] font-black text-[#94a3b8]">NO PROOF</span>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-2">
                        <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)} className="admin-input !h-9 w-44 text-[10px]">{ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ").toUpperCase()}</option>)}</select>
                        <button onClick={async () => { if (!confirm('Delete this order permanently?')) return; const r = await fetch('/api/orders', { method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id }) }); if (r.ok) window.location.reload(); }} className="rounded border border-red-200 px-2 py-1 text-[9px] font-black text-red-600 transition-colors hover:bg-red-50">DELETE ORDER</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text="No checkout requests have been created." />}
      </section>

      {preview?.paymentScreenshot && (
        <div className="modal-overlay fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div onClick={(e) => e.stopPropagation()} className="modal-card w-full max-w-2xl overflow-hidden rounded-2xl border border-[#dbe2ec] bg-white shadow-[0_30px_80px_rgba(15,40,70,.35)]">
            <div className="flex items-center justify-between border-b border-[#e5e8ef] px-5 py-4">
              <div>
                <p className="text-[10px] font-black tracking-[.14em] text-[#0f4c81]">PAYMENT SCREENSHOT</p>
                <p className="mt-0.5 font-mono text-sm font-black text-[#0f172a]">{preview.orderCode} · {formatINR(preview.amount)}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={preview.paymentScreenshot} download={`payment-${preview.orderCode}.jpg`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#dbe2ec] px-3 py-2 text-[10px] font-black text-[#0f4c81] transition-colors hover:bg-[#f1f5fb]"><FiDownload /> DOWNLOAD</a>
                <button onClick={() => setPreview(null)} aria-label="Close preview" className="grid h-9 w-9 place-items-center rounded-lg border border-[#dbe2ec] text-[#64748b] transition-colors hover:bg-[#f1f5fb] hover:text-[#0f172a]"><FiX /></button>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto bg-[#f8fafc] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.paymentScreenshot} alt={`Full payment proof for ${preview.orderCode}`} className="mx-auto max-h-[64vh] rounded-xl border border-[#e5e8ef] object-contain" />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[#e5e8ef] px-5 py-3 text-[11px] text-[#64748b]">
              <span><b className="text-[#0f172a]">{preview.customerName}</b> · {preview.customerWhatsapp}</span>
              {preview.playerUid && <span>UID: <b className="font-mono text-[#0f4c81]">{preview.playerUid}</b>{preview.playerName ? ` (${preview.playerName})` : ""}</span>}
              {preview.buyerIp && <span className="inline-flex items-center gap-1"><FiMapPin className="text-[#0f4c81]" /> {preview.buyerIp}{location(preview) ? ` · ${location(preview)}` : ""}</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessagePanel({ messages, refresh }: { messages: Message[]; refresh: () => void }) {
  const read = async (id: string) => { await fetch("/api/admin/management", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: id, markRead: true }) }); refresh(); };
  return <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white"><ListHeader title="Customer inbox" count={messages.length} /><div className="divide-y divide-[#e5e8ef]">{messages.length ? messages.map((m) => <article key={m.id} className={`p-5 ${!m.isRead ? "bg-[#f1f5fb]" : ""}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black text-[#0f172a]">{m.name} <span className="ml-2 text-xs font-medium text-[#64748b]">{m.whatsapp}</span></p><p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748b]">{m.message}</p></div><div className="flex items-center gap-3"><a href={`https://wa.me/91${m.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-[#0f4c81]"><FaWhatsapp /></a>{!m.isRead && <button onClick={() => read(m.id)} className="rounded border border-[#dbe2ec] px-2 py-1 text-[9px] font-black text-[#64748b]">MARK READ</button>}</div></div></article>) : <Empty text="The customer inbox is clear." />}</div></section>;
}

function SitePanel({ settings, save }: { settings: SettingRow[]; save: (k: string, v: unknown) => void }) {
  const existing = (key: string, fallback: string) => String(settings.find((s) => s.settingKey === key)?.value ?? fallback);
  const [whatsapp, setWhatsapp] = useState(existing("whatsapp_number", "7737073654"));
  const [hero, setHero] = useState(existing("homepage_headline", "PLAY WITHOUT THE GRIND."));
  const [logo, setLogo] = useState(existing("logo_url", ""));
  const [instagram, setInstagram] = useState(existing("instagram_url", ""));
  const [youtube, setYoutube] = useState(existing("youtube_url", ""));
  const [upiId, setUpiId] = useState(existing("upi_id", "battlegroundstore@upi"));
  const [checkoutMode, setCheckoutMode] = useState(existing("checkout_mode", "qr"));
  const [maintenance, setMaintenance] = useState(existing("maintenance_mode", "false") === "true");
  const upiPreview = `upi://pay?pa=${encodeURIComponent(upiId || "battlegroundstore@upi")}&pn=${encodeURIComponent("Battleground Mobile India Store")}&am=100&cu=INR`;
  const qrPreview = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(upiPreview)}`;
  return <div className="grid gap-5 xl:grid-cols-2">
    <section className="rounded-xl border border-[#e5e8ef] bg-white p-6"><PanelTitle icon={FiLayout} title="Homepage & contact" copy="Public headline, WhatsApp & socials. Change reflects instantly on site." /><div className="mt-5 grid gap-3"><input value={hero} onChange={(e) => setHero(e.target.value)} className="admin-input" placeholder="Homepage headline" /><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="admin-input" placeholder="WhatsApp number (10-digit)" /><ImageInput value={logo} onChange={setLogo} label="LOGO IMAGE" placeholder="Logo URL or upload logo" /><input value={instagram} onChange={(e) => setInstagram(e.target.value)} className="admin-input" placeholder="Instagram URL" /><input value={youtube} onChange={(e) => setYoutube(e.target.value)} className="admin-input" placeholder="YouTube URL" /><button onClick={() => { save("homepage_headline", hero); save("whatsapp_number", whatsapp); save("logo_url", logo); save("instagram_url", instagram); save("youtube_url", youtube); }} className="admin-primary"><FiSettings /> SAVE PUBLIC SETTINGS</button></div></section>
    <section className="rounded-xl border border-[#cfe3f7] bg-gradient-to-br from-[#f3f8fe] to-white p-6">
      <PanelTitle icon={FiGift} title="Payment & Checkout Control" copy="Control Buy Now behaviour & UPI QR. Premium glassmorphism panel." />
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-[10px] font-black tracking-wide text-[#64748b]">UPI ID <span className="font-normal normal-case tracking-normal text-[#94a3b8]">QR isi se generate hoga</span>
          <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" className="admin-input font-mono text-sm" />
        </label>
        <label className="grid gap-2 text-[10px] font-black tracking-wide text-[#64748b]">BUY NOW BUTTON ACTION
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setCheckoutMode("qr")} className={`rounded-xl border px-3 py-3 text-xs font-black transition ${checkoutMode === "qr" ? "border-[#0f4c81] bg-[#0f4c81] text-white shadow-[0_6px_18px_rgba(15,76,129,.25)]" : "border-[#dbe2ec] bg-white text-[#64748b] hover:text-[#0f172a]"}`}>💳 QR PAYMENT</button>
            <button type="button" onClick={() => setCheckoutMode("whatsapp")} className={`rounded-xl border px-3 py-3 text-xs font-black transition ${checkoutMode === "whatsapp" ? "border-[#16a34a] bg-[#16a34a] text-white shadow-[0_6px_18px_rgba(22,163,74,.25)]" : "border-[#dbe2ec] bg-white text-[#64748b] hover:text-[#0f172a]"}`}>💬 WHATSAPP</button>
          </div>
          <p className="text-[10px] leading-4 text-[#64748b]">{checkoutMode === "qr" ? "✨ User details ke baad instant UPI QR generate hoga — exact payable amount ke saath. Order auto-save." : "↗️ User details ke baad direct WhatsApp redirect (old flow). QR nahi dikhega."}</p>
        </label>
        <div className="flex gap-3 rounded-xl border border-[#e5e8ef] bg-[#f8fafc] p-4 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrPreview} alt="UPI QR preview" width={80} height={80} className="h-20 w-20 rounded-lg bg-white p-1 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-widest text-[#0f4c81]">QR PREVIEW</p>
            <p className="mt-1 truncate font-mono text-xs font-black text-[#0f172a]">{upiId || "—"}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#64748b]">Har order ka QR alag amount pe auto-banta hai. Coupon discount ke baad ka final amount.</p>
          </div>
        </div>
        <button onClick={() => { save("upi_id", upiId); save("checkout_mode", checkoutMode); }} className="admin-primary w-full justify-center"><FiSettings /> SAVE PAYMENT SETTINGS</button>
      </div>
    </section>
    <section className="rounded-xl border border-[#e5e8ef] bg-white p-6 xl:col-span-2"><PanelTitle icon={FiImage} title="Operations" copy="Maintenance & content areas." /><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex flex-1 items-center justify-between rounded-lg border border-[#e5e8ef] bg-[#f8fafc] p-4 cursor-pointer"><span><span className="block text-sm font-black text-[#0f172a]">Maintenance mode</span><span className="mt-1 block text-xs text-[#64748b]">Live notice banner across storefront.</span></span><input checked={maintenance} onChange={(e) => { setMaintenance(e.target.checked); save("maintenance_mode", e.target.checked); }} type="checkbox" className="h-5 w-5 accent-[#0f4c81] cursor-pointer" /></label><p className="text-xs text-[#94a3b8] hidden sm:block">Payment settings upar alag se save hote hain</p></div></section></div>;
}

function TeamPanel({ session, toast }: { session: SessionInfo | null; toast: (m: string) => void }) {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [denied, setDenied] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "admin" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const isOwner = session?.role === "owner";

  const loadAdmins = async () => {
    if (!isOwner) return;
    try {
      const r = await fetch("/api/admin/admins", { cache: "no-store", credentials: "same-origin" });
      if (r.status === 401) { setDenied(true); return; }
      const d = await r.json();
      setAdmins(d.admins ?? []);
    } catch {
      setDenied(true);
    }
  };
  useEffect(() => { loadAdmins().catch(() => undefined); }, [isOwner]);

  const changeOwnPassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword) { toast("Fill current and new password."); return; }
    if (passwordForm.newPassword.length < 6) { toast("New password must be at least 6 characters."); return; }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast("New passwords do not match."); return; }
    const r = await fetch("/api/admin/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }) });
    const d = await r.json().catch(() => null);
    if (r.ok) { toast("Password changed successfully."); setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); }
    else toast(d?.error ?? "Could not change password.");
  };

  const addAdmin = async () => {
    if (!form.username || !form.password) { toast("Username and password are required."); return; }
    const r = await fetch("/api/admin/admins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await r.json().catch(() => null);
    if (r.ok) { toast(`Admin "${form.username}" created.`); setForm({ username: "", password: "", role: "admin" }); loadAdmins(); }
    else toast(d?.error ?? "Could not create admin.");
  };
  const changeRole = async (id: string, role: string) => { const r = await fetch("/api/admin/admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, role }) }); if (r.ok) { toast("Role updated."); loadAdmins(); } };
  const resetPassword = async (id: string, username: string) => { const password = prompt(`New password for "${username}" (min 6 chars):`); if (!password) return; if (password.length < 6) { toast("Password must be at least 6 characters."); return; } const r = await fetch("/api/admin/admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password }) }); if (r.ok) { toast(`Password updated for ${username}.`); loadAdmins(); } };
  const toggleActive = async (admin: AdminRow) => { const r = await fetch("/api/admin/admins", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }) }); if (r.ok) { toast(admin.isActive ? "Login disabled." : "Login enabled."); loadAdmins(); } };
  const deleteAdmin = async (admin: AdminRow) => { if (!confirm(`Delete admin "${admin.username}" permanently?`)) return; const r = await fetch("/api/admin/admins", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: admin.id }) }); const d = await r.json().catch(() => null); if (r.ok) { toast("Admin deleted."); loadAdmins(); } else toast(d?.error ?? "Could not delete admin."); };

  return <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
    <section className="space-y-5">
      <div className="rounded-xl border border-[#e5e8ef] bg-white p-6"><PanelTitle icon={FiLock} title="Change your password" copy="Change your password from here after login." /><div className="mt-5 grid gap-3"><input value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} type="password" placeholder="Current password" className="admin-input" /><input value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} type="password" placeholder="New password" className="admin-input" /><input value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} type="password" placeholder="Confirm new password" className="admin-input" /><button onClick={changeOwnPassword} className="admin-primary"><FiKey /> CHANGE PASSWORD</button></div></div>
      {isOwner && <div className="rounded-xl border border-[#e5e8ef] bg-white p-6"><PanelTitle icon={FiPlus} title="Add new admin" copy="Create a working login using only username, password, and role." /><div className="mt-5 grid gap-3"><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="admin-input" /><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" placeholder="Password (min 6 chars)" className="admin-input" /><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="admin-input"><option value="admin">Admin — catalog, coupons, orders</option><option value="moderator">Moderator — orders & messages</option><option value="owner">Owner — full access</option></select><button onClick={addAdmin} className="admin-primary"><FiPlus /> CREATE ADMIN</button></div></div>}
      {!isOwner && <div className="rounded-xl border border-[#e8bd45]/25 bg-[#17140c]/60 p-6 text-sm text-[#64748b]">Only the owner can add, delete, or manage other admin users. Your own password change is available above.</div>}
    </section>
    <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white"><ListHeader title="Admin accounts" count={admins.length} /><div className="divide-y divide-[#e5e8ef]">{isOwner && !denied ? admins.map((a) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#f1f5fb] text-xs font-black uppercase text-[#0f4c81]">{a.username[0]}</span><div><p className="text-sm font-black uppercase text-[#0f172a]">{a.username} {a.username === session?.username && <span className="ml-1 text-[9px] text-[#64748b]">(you)</span>}</p><p className="mt-0.5 text-xs text-[#64748b]">{a.role.toUpperCase()} · {a.isActive ? "active" : "disabled"}</p></div></div><div className="flex flex-wrap items-center gap-2"><select value={a.role} onChange={(e) => changeRole(a.id, e.target.value)} className="admin-input !h-9 w-32 text-[10px]" disabled={a.username === session?.username}><option value="owner">OWNER</option><option value="admin">ADMIN</option><option value="moderator">MODERATOR</option></select><Action onClick={() => resetPassword(a.id, a.username)} label="Password" icon={FiKey} />{a.username !== session?.username && <><Action onClick={() => toggleActive(a)} label={a.isActive ? "Disable" : "Enable"} icon={FiSettings} /><Action onClick={() => deleteAdmin(a)} label="Delete" icon={FiTrash2} danger /></>}</div></div>) : <Empty text={isOwner ? "Sign in once with MANAV / MANAV7412 to provision the owner account." : "Owner-only admin list."} />}</div></section>
  </div>;
}

function PanelTitle({ icon: Icon, title, copy }: { icon: typeof FiPlus; title: string; copy: string }) { return <div><div className="flex items-center gap-2 text-[#0f4c81]"><Icon /><p className="text-[10px] font-black tracking-[.14em]">MANAGEMENT</p></div><h2 className="mt-3 text-xl font-black text-[#0f172a]">{title}</h2><p className="mt-2 text-xs leading-5 text-[#64748b]">{copy}</p></div>; }
function ListHeader({ title, count }: { title: string; count: number }) { return <div className="flex items-center justify-between border-b border-[#e5e8ef] p-5"><h2 className="font-black text-[#0f172a]">{title}</h2><span className="rounded bg-[#f1f5fb] px-2 py-1 text-[10px] font-bold text-[#64748b]">{count} ITEMS</span></div>; }
function Empty({ text }: { text: string }) { return <p className="p-9 text-center text-sm text-[#64748b]">{text}</p>; }
function Action({ onClick, label, icon: Icon, danger }: { onClick: () => void; label: string; icon: typeof FiTrash2; danger?: boolean }) { return <button onClick={onClick} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[9px] font-black ${danger ? "border-red-200 text-red-600" : "border-[#dbe2ec] text-[#64748b]"}`}><Icon />{label}</button>; }

function FeedbacksManager({ create, update, remove }: { create: CatalogMutation; update: CatalogUpdate; remove: CatalogDelete }) {
  type FeedbackItem = { id: string; name: string; review: string; rating: number; avatar?: string | null; isActive?: boolean };
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const empty = { name: "", review: "", rating: "5", avatar: "" };
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadFeedbacks = async () => {
    try {
      const res = await fetch("/api/admin/feedbacks", { cache: "no-store", credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.feedbacks) setFeedbacks(data.feedbacks);
    } catch {}
  };

  useEffect(() => { loadFeedbacks(); }, []);

  const submit = async () => {
    const data = { ...form, rating: Number(form.rating), isActive: true };
    const res = await fetch("/api/admin/feedbacks", {
      method: editingId ? "PATCH" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...data } : data),
    });
    if (res.ok) { setForm(empty); setEditingId(null); await loadFeedbacks(); }
  };

  const startEdit = (f: FeedbackItem) => {
    setEditingId(f.id);
    setForm({ name: f.name, review: f.review, rating: String(f.rating ?? 5), avatar: f.avatar ?? "" });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
      <section className="h-fit rounded-xl border border-[#e5e8ef] bg-white p-5">
        <PanelTitle icon={editingId ? FiEdit3 : FiPlus} title={editingId ? "Edit Feedback" : "Add Player Feedback"} copy="Add/edit player reviews shown on the homepage." />
        <div className="mt-5 grid gap-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Player name" className="admin-input" />
          <textarea value={form.review} onChange={(e) => setForm({ ...form, review: e.target.value })} placeholder="Review / comment" rows={4} className="admin-input resize-none py-3" style={{ height: "auto" }} />
          <div className="grid gap-3 sm:grid-cols-[.35fr_.65fr]">
            <input value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} type="number" min="1" max="5" placeholder="Rating 1-5" className="admin-input" />
            <ImageInput value={form.avatar} onChange={(avatar) => setForm({ ...form, avatar })} label="AVATAR IMAGE" />
          </div>
          <button onClick={submit} className="admin-primary">{editingId ? <FiEdit3 /> : <FiPlus />} {editingId ? "UPDATE FEEDBACK" : "ADD FEEDBACK"}</button>
          {editingId && <button onClick={() => { setEditingId(null); setForm(empty); }} className="text-[10px] font-black tracking-[.12em] text-[#64748b] hover:text-[#0f172a]">CANCEL</button>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[#e5e8ef] bg-white">
        <ListHeader title="Player Feedbacks" count={feedbacks.length} />
        <div className="divide-y divide-[#e5e8ef]">
          {feedbacks.length ? feedbacks.map((f) => (
            <div className="flex gap-3 p-4" key={f.id}>
              {f.avatar && <img src={f.avatar} alt={f.name} className="h-12 w-12 shrink-0 rounded-full object-cover" />}
              <div className="min-w-0 grow">
                <div className="flex items-center gap-2"><p className="font-black text-sm text-[#0f172a]">{f.name}</p><span className="text-[#0f4c81]">★{f.rating}</span></div>
                <p className="mt-1 text-xs text-[#64748b] line-clamp-2">{f.review}</p>
                <div className="mt-2 flex gap-2">
                  <Action onClick={() => startEdit(f)} label="Edit" icon={FiEdit3} />
                  <Action onClick={async () => { await fetch("/api/admin/feedbacks", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id, name: f.name, review: f.review, rating: f.rating, avatar: f.avatar ?? null, isActive: f.isActive === false }) }); await loadFeedbacks(); }} label={f.isActive === false ? "Enable" : "Disable"} icon={FiSettings} />
                  <Action onClick={async () => { if (!confirm("Delete feedback permanently?")) return; await fetch("/api/admin/feedbacks", { method: "DELETE", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: f.id }) }); await loadFeedbacks(); }} label="Delete" icon={FiTrash2} danger />
                </div>
              </div>
            </div>
          )) : <Empty text="No feedbacks yet." />}
        </div>
      </section>
    </div>
  );
}
