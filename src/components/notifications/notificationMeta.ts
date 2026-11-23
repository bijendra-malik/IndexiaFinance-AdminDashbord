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
