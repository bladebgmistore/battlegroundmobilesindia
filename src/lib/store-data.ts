export const driveImage = (id: string) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;

export const images = {
  logo: driveImage("1wXmAPUuE8rgLJNQt-9YhV-vi91ebyDF-"),
  safety: driveImage("1qmClk6VkDy2yomQJ5lDoze2lHDG_TUey"),
  uc: driveImage("10_cq7DtWvlvrIMsWv1FGAsqxiv61CPqZ"),
  cars: driveImage("1Qxmkfn4MUhf-PMtWtYm6oZ7CoZ2q6uoR"),
  xsuit: driveImage("18q6uPuszRdeLbiedtptdO6jDDPsJuJ2B"),
};

export const accountImages = {
  account1: driveImage("1Sh_Ndc1gqktIObx2H6VNsujOk7PNHq-p"),
  account2: driveImage("1WyxlXVfhFU-MCX3P8ZKhEbz8o5w_4mMR"),
  account3: driveImage("1V7iphXQE3ibYMFT0DfuZCCdAz_EpZ2kG"),
};

// Fallback for older/cached files
export const specialImages = {
  cars: driveImage("1Qxmkfn4MUhf-PMtWtYm6oZ7CoZ2q6uoR"),
  xsuit: driveImage("18q6uPuszRdeLbiedtptdO6jDDPsJuJ2B"),
};

// ─── Supercars packages ───────────────────────────────────────────────
export type CarPackage = {
  id: string;
  name: string;
  price: number;
  image: string;
  features: string[];
  badge?: string;
};

export const defaultCarPackages: CarPackage[] = [
  {
    id: "cars-3x",
    name: "3X SUPERCARS",
    price: 4999,
    image: driveImage("1Qxmkfn4MUhf-PMtWtYm6oZ7CoZ2q6uoR"),
    badge: "BEST VALUE",
    features: ["3 Premium Supercars", "Exclusive Car Skins", "Rare Vehicle Set", "Instant Delivery via WhatsApp"],
  },
  {
    id: "cars-1x",
    name: "1X SUPERCAR",
    price: 1999,
    image: driveImage("1Qxmkfn4MUhf-PMtWtYm6oZ7CoZ2q6uoR"),
    badge: "STARTER",
    features: ["1 Premium Supercar", "Exclusive Car Skin", "Rare Vehicle", "Instant Delivery via WhatsApp"],
  },
];

// ─── X-Suit packages ─────────────────────────────────────────────────
export type XSuitPackage = {
  id: string;
  name: string;
  price: number;
  image: string;
  features: string[];
  badge?: string;
};

export const defaultXSuitPackages: XSuitPackage[] = [
  {
    id: "xsuit-pkg",
    name: "X-SUIT PACKAGE",
    price: 1999,
    image: driveImage("18q6uPuszRdeLbiedtptdO6jDDPsJuJ2B"),
    badge: "EXCLUSIVE",
    features: ["1 Premium X-Suit", "Full Set Included", "Rare Costume", "Instant Delivery via WhatsApp"],
  },
];

export type AccountItem = {
  id: string;
  title: string;
  price: number;
  image: string;
  features: string[];
  badge?: string | null;
  isActive?: boolean;
};

export type UcPackageItem = {
  id: string;
  price: number;
  ucAmount: number;
  bonusLabel?: string | null;
  isActive?: boolean;
};

export const defaultAccounts: AccountItem[] = [
  {
    id: "pharaoh-max",
    title: "PHARAOH XSUIT LVL 6 MAX",
    price: 1999,
    image: accountImages.account1,
    badge: "MOST WANTED",
    features: [
      "PHARAOH XSUIT LVL 6 MAX", "FOREST ELF SET (RARE)", "INFERNO HELMET (RARE)",
      "BLACK HITMAN SET", "REGAL OVERLORD SET", "QUEEN OF RICH (RARE)",
      "13 GUN MAX", "44 LAB GUNS", "160/300 MYTHIC", "1 DROP CAR", "3 SUPERCARS",
      "WARP UNIVERSE CAR", "DOUBLE MYTHIC LOBBY",
    ],
  },
  {
    id: "pharaoh-ravan",
    title: "PHARAOH + RAVAN XSUIT",
    price: 2999,
    image: accountImages.account2,
    badge: "ELITE LOADOUT",
    features: [
      "PHARAOH XSUIT LVL 6 MAX", "RAVAN XSUIT LEVEL 5", "DOLLAR SET", "INFERNO HELMET",
      "QUEEN OF RICH", "DOUBLE M416 MAX", "DOUBLE AKM MAX", "22 KILL MESSAGE", "60 LAB GUNS",
      "220/300 MYTHIC", "5 SUPERCARS", "DOUBLE MYTHIC LOBBY",
    ],
  },
  {
    id: "triple-xsuit",
    title: "TRIPLE XSUIT LVL 4 LEGEND",
    price: 3999,
    image: accountImages.account3,
    badge: "COLLECTOR'S PICK",
    features: [
      "COLLECTION LEVEL 78.5", "TRIPLE XSUIT LEVEL 4", "FOREST ELF", "ANGEL WING", "WEDDING DRESS",
      "TRIPLE M416 MAX", "16 GUN MAX", "73 LAB GUNS", "240/300 MYTHIC", "45 ULTIMATE FASHION",
      "F1 MCLEARN BUGGY", "7 SUPERCARS", "16 PARTNER POSE", "15 MYTHIC LOBBY", "130M POPULARITY",
    ],
  },
];

export const defaultUcPackages: UcPackageItem[] = [
  { id: "uc-8100", price: 750, ucAmount: 8100, bonusLabel: "BEST VALUE" },
  { id: "uc-16200", price: 1000, ucAmount: 16200, bonusLabel: "POPULAR" },
  { id: "uc-20000", price: 1250, ucAmount: 20000, bonusLabel: "POWER PACK" },
  { id: "uc-40000", price: 2000, ucAmount: 40000, bonusLabel: "TOP UP" },
  { id: "uc-80000", price: 4000, ucAmount: 80000, bonusLabel: "ELITE" },
  { id: "uc-160000", price: 8000, ucAmount: 160000, bonusLabel: "MAXIMUM" },
];

export const faqs = [
  { question: "How quickly will I receive my order?", answer: "Most requests are handled quickly after WhatsApp verification. Delivery timing is confirmed by our support team before completion." },
  { question: "Are account details transferred safely?", answer: "Yes. We guide every buyer through a controlled handover and recommend recording the entire process for your own records." },
  { question: "Can I make a payment directly on the site?", answer: "Our gateway is currently in maintenance. Use the official WhatsApp channel shown after selecting your product to complete the purchase." },
  { question: "What should I prepare before buying UC?", answer: "Keep your in-game details ready and contact support after selecting a package. Never share an OTP or recovery code with anyone." },
];

export const reviews = [
  { name: "Sahil Verma", label: "Verified buyer", body: "The delivery process was clear and the support team stayed with me through account handover. Very smooth experience.", rating: 5 },
  { name: "Aman S.", label: "Verified buyer", body: "Got the exact UC package I selected. Quick response on WhatsApp and professional instructions.", rating: 5 },
  { name: "Rohit Kumar", label: "Verified buyer", body: "The account inventory matched the details shown. Recording the handover gave me extra confidence.", rating: 5 },
];

export const formatINR = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

// ─── Special products (Supercars & X-Suit) shared type ────────────────
// Kept for compatibility with pages/components that expect this shape.
export type SpecialCategory = "car" | "xsuit";

export type SpecialProductItem = {
  id: string;
  category: SpecialCategory | string;
  title: string;
  price: number;
  image: string;
  features: string[];
  badge?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export const defaultSpecialProducts: SpecialProductItem[] = [
  ...defaultCarPackages.map((pkg, index) => ({
    id: pkg.id,
    category: "car" as SpecialCategory,
    title: pkg.name,
    price: pkg.price,
    image: pkg.image,
    features: pkg.features,
    badge: pkg.badge ?? null,
    sortOrder: index,
    isActive: true,
  })),
  ...defaultXSuitPackages.map((pkg, index) => ({
    id: pkg.id,
    category: "xsuit" as SpecialCategory,
    title: pkg.name,
    price: pkg.price,
    image: pkg.image,
    features: pkg.features,
    badge: pkg.badge ?? null,
    sortOrder: index,
    isActive: true,
  })),
];

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  sortOrder?: number;
  isActive?: boolean;
};

export const defaultCategories: Category[] = [
  {
    id: "cat-accounts",
    name: "Premium Accounts",
    slug: "accounts",
    description: "Find the high-tier BGMI account that matches your play style.",
    image: accountImages.account1,
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "cat-uc",
    name: "UC Purchase",
    slug: "uc",
    description: "High-value UC packages for your next BGMI upgrade.",
    image: images.uc,
    sortOrder: 20,
    isActive: true,
  },
  {
    id: "cat-super-cars",
    name: "Super Cars",
    slug: "super-cars",
    description: "Premium limited-edition supercars with specialized card packs.",
    image: specialImages.cars,
    sortOrder: 30,
    isActive: true,
  },
  {
    id: "cat-x-suits",
    name: "X-Suits",
    slug: "x-suits",
    description: "Legendary BGMI X-Suits with secure guided delivery.",
    image: specialImages.xsuit,
    sortOrder: 40,
    isActive: true,
  },
];

export type Product = {
  id: string;
  categorySlug: string;
  title: string;
  price: number;
  image: string;
  features: string[];
  badge?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export const defaultProducts: Product[] = [
  // Accounts
  ...defaultAccounts.map((a, i) => ({
    id: a.id,
    categorySlug: "accounts",
    title: a.title,
    price: a.price,
    image: a.image,
    features: a.features,
    badge: a.badge ?? null,
    sortOrder: i,
    isActive: true,
  })),
  // Super Cars
  ...defaultCarPackages.map((pkg, i) => ({
    id: pkg.id,
    categorySlug: "super-cars",
    title: pkg.name,
    price: pkg.price,
    image: pkg.image,
    features: pkg.features,
    badge: pkg.badge ?? null,
    sortOrder: i,
    isActive: true,
  })),
  // X-Suits
  ...defaultXSuitPackages.map((pkg, i) => ({
    id: pkg.id,
    categorySlug: "x-suits",
    title: pkg.name,
    price: pkg.price,
    image: pkg.image,
    features: pkg.features,
    badge: pkg.badge ?? null,
    sortOrder: i,
    isActive: true,
  })),
];

export const DEFAULT_WHATSAPP_NUMBER = "7737073654";
export const DEFAULT_UPI_ID = "battlegroundstore@upi";
export const DEFAULT_CHECKOUT_MODE: CheckoutMode = "qr";
export type CheckoutMode = "whatsapp" | "qr";

export const buildWhatsappUrl = (number: string, text?: string) => {
  const digits = String(number).replace(/\D/g, "").replace(/^0+/, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
export const whatsappUrl = buildWhatsappUrl(DEFAULT_WHATSAPP_NUMBER);

export function buildUpiUrl(opts: { upiId: string; amount: number; orderCode: string; productName: string; payeeName?: string }) {
  const payee = opts.payeeName || "Battleground Mobile India Store";
  const note = `Order ${opts.orderCode} - ${opts.productName}`.slice(0, 80);
  const params = new URLSearchParams({
    pa: opts.upiId,
    pn: payee,
    am: String(opts.amount),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

export function buildQrImageUrl(upiUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(upiUrl)}`;
}

export function isUidRequiredProduct(productName: string) {
  const lower = productName.toLowerCase();
  return lower.includes("uc") || lower.includes("super") || lower.includes("car") || lower.includes("x-suit") || lower.includes("xsuit") || lower.includes("x suit");
}
