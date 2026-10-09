/**
 * Role Based Access Control — shared, dependency-free definitions.
 *
 * Safe to import from BOTH server code (route handlers, pages) and client
 * components (the admin dashboard menu): this module has no Node/DB imports.
 *
 * Role hierarchy:
 *   owner     — from the OWNER_EMAIL env allow-list only. Full access,
 *               including the "Team & Roles" manager (add/remove staff).
 *   admin     — full access EXCEPT team management.
 *   manager   — day-to-day store ops: catalog, orders, referrals & points,
 *               coupons, messages, feedbacks, users list.
 *   moderator — support role: messages + feedback moderation (+ overview).
 *   customer  — regular signed-in buyer, no admin area.
 *
 * Staff roles (admin / manager / moderator) are assigned by the owner from
 * the admin panel and stored in the `staff_members` table — see staff.ts.
 */

export const ROLE_OWNER = "owner";
export const ROLE_ADMIN = "admin";
export const ROLE_MANAGER = "manager";
export const ROLE_MODERATOR = "moderator";
export const ROLE_CUSTOMER = "customer";

/** Roles an owner can grant from the Team & Roles panel. */
export const STAFF_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_MODERATOR] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Every role that may open the /admin area at all. */
export const ADMIN_AREA_ROLES: string[] = [ROLE_OWNER, ...STAFF_ROLES];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function isAdminAreaRole(role: string | null | undefined): boolean {
  return !!role && ADMIN_AREA_ROLES.includes(role);
}

/**
 * Dashboard capabilities. Each admin view + every admin API maps to exactly
 * one scope, so the menu a staff member sees always matches what the APIs
 * will let them do.
 */
export type AdminScope =
  | "overview"
  | "catalog" // accounts / UC / super cars / x-suits / categories / coupons
  | "orders"
  | "referrals" // Refer & Earn: referral tree, commission logs, redemptions, points store items
  | "proofs" // Customer Proofs: verified order deliveries published on /proofs
  | "messages"
  | "feedbacks"
  | "logs" // visitor logs (IP + location data)
  | "users" // registered users list
  | "site" // site controls / payment settings
  | "team"; // add / edit / remove staff — owner only

export const SCOPE_ROLES: Record<AdminScope, string[]> = {
  overview: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MODERATOR],
  catalog: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER],
  orders: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER],
  referrals: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER],
  proofs: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER],
  messages: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MODERATOR],
  feedbacks: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MODERATOR],
  logs: [ROLE_OWNER, ROLE_ADMIN],
  users: [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MODERATOR],
  site: [ROLE_OWNER, ROLE_ADMIN],
  team: [ROLE_OWNER],
};

export function roleHasScope(role: string | null | undefined, scope: AdminScope): boolean {
  return !!role && SCOPE_ROLES[scope].includes(role);
}

/** Human-friendly labels + descriptions used across the admin UI. */
export const ROLE_META: Record<string, { label: string; tagline: string; badge: string }> = {
  owner: {
    label: "Owner",
    tagline: "Full control — catalog, orders, settings, visitors, team.",
    badge: "bg-[#0f4c81] text-white",
  },
  admin: {
    label: "Admin",
    tagline: "Everything except team management & order deletion.",
    badge: "bg-[#7c3aed] text-white",
  },
  manager: {
    label: "Manager",
    tagline: "Runs the store — products, orders, coupons, inbox, reviews.",
    badge: "bg-[#0e9f6e] text-white",
  },
  moderator: {
    label: "Moderator",
    tagline: "Support desk — customer messages & review moderation.",
    badge: "bg-[#f59e0b] text-white",
  },
  customer: {
    label: "Customer",
    tagline: "Regular buyer account.",
    badge: "bg-[#f1f5fb] text-[#64748b]",
  },
};

export function roleLabel(role: string | null | undefined): string {
  return ROLE_META[role ?? ""]?.label ?? "Customer";
}

/** Scopes each staff role unlocks — used for the "what this role can do" chips. */
export const ROLE_SCOPES: Record<StaffRole, AdminScope[]> = {
  admin: ["overview", "catalog", "orders", "referrals", "proofs", "messages", "feedbacks", "logs", "users", "site"],
  manager: ["overview", "catalog", "orders", "referrals", "proofs", "messages", "feedbacks", "users"],
  moderator: ["overview", "messages", "feedbacks", "users"],
};
