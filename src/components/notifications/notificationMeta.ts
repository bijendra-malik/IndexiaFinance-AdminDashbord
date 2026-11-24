import {
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  MessageSquare,
  ShieldCheck,
  UserCircle,
  Users,
  XCircle,
} from "lucide-react";
import type { AdminRole } from "../../api/adminUsers";
import type { ActorLevel, AppNotification, NotificationKind } from "../../api/notifications";

/*
==========================================
Notification UI meta

Bell dropdown aur `/notifications` page dono ek hi tabs/icons/format use karte
hain, isliye wo yahan ek jagah rehte hain — warna dono jagah copy alag ho jaati.
==========================================
*/

export interface NotificationTab {
  key: string;
  label: string;
  match: (item: AppNotification) => boolean;
}

export const TABS_BY_ROLE: Record<AdminRole, NotificationTab[]> = {
  super_admin: [
    { key: "all", label: "All", match: () => true },
    {
      key: "decision",
      label: "Decisions",
      match: (item) => item.kind === "recommendation" || item.kind === "decided",
    },
    { key: "escalation", label: "Escalations", match: (item) => item.kind === "escalation" },
    { key: "franchise", label: "Franchise", match: (item) => item.kind === "franchise" },
  ],
  sub_admin: [
    { key: "all", label: "All", match: () => true },
    {
      key: "queue",
      label: "Needs review",
      match: (item) => item.kind !== "escalation" && item.kind !== "decided",
    },
    { key: "escalation", label: "Escalations", match: (item) => item.kind === "escalation" },
  ],
  admin: [
    { key: "all", label: "All", match: () => true },
    { key: "returned", label: "Returned", match: (item) => item.kind === "returned" },
    { key: "decided", label: "Decisions", match: (item) => item.kind === "decided" },
  ],
};

export const KIND_META: Record<NotificationKind, { icon: typeof Bell; tile: string }> = {
  note: { icon: MessageSquare, tile: "bg-slate-100 text-slate-500" },
  recommendation: { icon: Clock3, tile: "bg-amber-50 text-amber-600" },
  escalation: { icon: ArrowUpRight, tile: "bg-sky-50 text-sky-600" },
  verified: { icon: CheckCircle2, tile: "bg-emerald-50 text-emerald-600" },
  returned: { icon: XCircle, tile: "bg-rose-50 text-rose-600" },
  decided: { icon: ShieldCheck, tile: "bg-indigo-50 text-indigo-600" },
  franchise: { icon: Building2, tile: "bg-violet-50 text-violet-600" },
};

/** Reporting chain — har panel me same order, taaki hierarchy clear rahe. */
export const ROLE_CHAIN: ActorLevel[] = ["super_admin", "sub_admin", "admin"];

export const ROLE_ICONS: Record<ActorLevel, typeof Bell> = {
  super_admin: ShieldCheck,
  sub_admin: Users,
  admin: UserCircle,
};

/*
Notification ka record scope — yahi ek jagah decide hota hai. Page ki row
colour/chips, bell ki filtering aur module guards sab isi ka use karte hain,
taaki ek jagah rule badalne se sab consistent rahe.

Order matter karta hai: franchise activity → franchise, franchise-customer
markers → franchise customer, `/franchises/...` → franchise, direct customer →
customer, baaki sab loan (jisme `/applications/...` bhi hai).
*/
export type NotificationScope = "franchise" | "franchise_customer" | "customer" | "loan";

export const notificationScope = (item: AppNotification): NotificationScope => {
  if (item.kind === "franchise" || item.targetLabel === "Open franchise") return "franchise";
  if (item.channel === "franchise" || /\/franchises?\//i.test(item.targetPath)) return "franchise";

  if (
    item.channel === "franchise-customer" ||
    item.isFranchiseCustomer === true ||
    Boolean(item.franchiseRef) ||
    /* Franchise actor ka loan franchise-customer ka record hota hai. */
    /franchise/i.test(item.actorRole) ||
    /franchise[-_]?customers?/i.test(item.targetPath) ||
    /^FCUST/i.test(item.recordLabel)
  ) {
    return "franchise_customer";
  }

  if (item.channel === "customer" || item.targetLabel === "Open customer") return "customer";
  if (/^CUST/i.test(item.recordLabel)) return "customer";
  return "loan";
};

/** Franchise side (account, activity, ya franchise ka customer) — module-gated. */
export const isFranchiseScoped = (item: AppNotification): boolean => {
  const scope = notificationScope(item);
  return scope === "franchise" || scope === "franchise_customer";
};

/** Direct customer record — customers module-gated. */
export const isCustomerScoped = (item: AppNotification): boolean =>
  notificationScope(item) === "customer";

/** Loan application — loan access gated. */
export const isLoanScoped = (item: AppNotification): boolean =>
  notificationScope(item) === "loan";

export const timeAgo = (iso: string): string => {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const diff = Date.now() - time;
  const minute = 60_000;
  if (diff < minute) return "abhi";
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h`;
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};
