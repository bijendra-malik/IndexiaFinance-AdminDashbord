import axiosInstance from "./axiosInstance";
import type { AdminRole } from "./adminUsers";

/*
==========================================
Notifications — backend API

Feed server par banti hai (`GET /api/admin/notifications`), isliye audience wahi
Team & Access permissions se decide hoti hai:

  super admin -> escalated cases high priority, baaki sab low
  sub admin   -> apne scope ke naye update / recommendation / flag
  normal admin-> apne scope ke sabhi admins ke update + apna feedback

Read state server par per admin rehti hai (`NotificationRead`), isliye device
badalne par bhi unread count wahi rehta hai. Client par koi allow-list nahi —
role/permission ka faisla server karta hai.
==========================================
*/

export type NotificationKind =
  | "note"
  | "recommendation"
  | "escalation"
  | "verified"
  | "returned"
  | "decided"
  | "franchise";

export type NotificationPriority = "high" | "normal" | "low";

/**
 * Actor ka position — backend `SuperAdmin` / `SubAdmin` / `Admin` bhejta hai.
 * Panel me "Admin" ki jagah "Normal admin" likha jaata hai, warna do role
 * ek jaise lagte hain aur hierarchy samajh nahi aati.
 */
export type ActorLevel = "super_admin" | "sub_admin" | "admin";

export const ACTOR_LEVEL_LABEL: Record<ActorLevel, string> = {
  super_admin: "Super admin",
  sub_admin: "Sub admin",
  admin: "Normal admin",
};

/** Signed-in admin ka apna level — header aur hierarchy strip me. */
export const VIEWER_ROLE_LABEL: Record<AdminRole, string> = {
  super_admin: "Super admin",
  sub_admin: "Sub admin",
  admin: "Normal admin",
};

export const actorLevel = (role?: string | null): ActorLevel => {
  const raw = (role ?? "").replace(/[_-]+/g, " ").trim();
  if (/sub\s*admin/i.test(raw)) return "sub_admin";
  if (/super\s*admin/i.test(raw)) return "super_admin";
  return "admin";
};

export interface AppNotification {
  /** Backend ka stable key — refresh par duplicate row nahi banti. */
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  actorName: string;
  actorRole: string;
  /** Jis record par ye hua — application no. / product. */
  recordLabel: string;
  productLabel: string;
  /** Click karne par kahan jana hai (server ne path diya hai). */
  targetPath: string;
  targetLabel: string;
  createdAt: string;
  priority: NotificationPriority;
  /** Server ka read state — per admin, device-independent. */
  read: boolean;
  /** Franchise row ka type: application milestone ya read activity. */
  activityType?: "franchise_application" | "franchise_read";
  /** Franchise ne ye notification padhi ya nahi. */
  viewed?: boolean;
  viewedAt?: string;
  /**
   * Record kis channel ka hai — server `channel` (ya `entity` / customerType)
   * bheje to wahi, warna khaali. Franchise-customer rows ko `/customers/:id`
   * se alag pehchaanne ka reliable source yahi hai; URL par guess nahi karte.
   */
  channel?: "customer" | "franchise-customer" | "franchise";
}

export interface NotificationFeed {
  items: AppNotification[];
  /** Server count — loaded page se bada ho sakta hai. */
  unread: number;
  /** Server par kitni notifications hain — `limit` se bada ho sakta hai. */
  total: number;
  generatedAt: string;
}

interface RawNotification {
  key?: string;
  kind?: string;
  priority?: string;
  title?: string;
  body?: string;
  actorName?: string;
  actorRole?: string;
  entity?: string;
  applicationNo?: string | null;
  productLabel?: string;
  path?: string;
  createdAt?: string;
  read?: boolean;
  activityType?: string;
  viewed?: boolean;
  viewedAt?: string | null;
  channel?: string;
  customerType?: string;
}

interface RawFeed {
  notifications?: RawNotification[];
  unread?: number;
  total?: number;
  generatedAt?: string;
}

/*
`status` = timeline me record hua final decision, `escalated` = review ka state —
dono ko UI ke kinds me map karte hain, warna "Needs review" tab me decision rows
bhi aa jaati hain.
*/
const KIND_MAP: Record<string, NotificationKind> = {
  note: "note",
  recommendation: "recommendation",
  status: "decided",
  escalation: "escalation",
  escalated: "escalation",
  verified: "verified",
  returned: "returned",
  decided: "decided",
  franchise: "franchise",
};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const toPriority = (value: unknown): NotificationPriority =>
  value === "high" || value === "low" ? value : "normal";

const CHANNELS = ["customer", "franchise-customer", "franchise"] as const;
type NotificationChannel = (typeof CHANNELS)[number];

const toChannel = (raw: RawNotification): NotificationChannel | undefined => {
  const value = asString(raw.channel || raw.entity || raw.customerType)
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return CHANNELS.find((channel) => channel === value);
};

const TARGET_LABEL: Record<string, string> = {
  loan: "Open application",
  customer: "Open customer",
  franchise: "Open franchise",
};

const toNotification = (raw: RawNotification): AppNotification | null => {
  const key = asString(raw.key);
  if (!key) return null;

  return {
    id: key,
    kind: KIND_MAP[asString(raw.kind)] ?? "note",
    title: asString(raw.title, "Notification"),
    message: asString(raw.body),
    actorName: asString(raw.actorName, "Admin"),
    actorRole: asString(raw.actorRole),
    recordLabel: asString(raw.applicationNo) || asString(raw.productLabel),
    productLabel: asString(raw.productLabel),
    targetPath: asString(raw.path),
    targetLabel: TARGET_LABEL[asString(raw.entity)] ?? "Open record",
    createdAt: asString(raw.createdAt),
    priority: toPriority(raw.priority),
    read: raw.read === true,
    channel: toChannel(raw),
    activityType:
      raw.activityType === "franchise_read" || raw.activityType === "franchise_application"
        ? raw.activityType
        : undefined,
    viewed: raw.viewed === true,
    viewedAt: asString(raw.viewedAt ?? ""),
  };
};

export const loadNotifications = async (
  params: { days?: number; limit?: number } = {}
): Promise<NotificationFeed> => {
  const { data } = await axiosInstance.get<RawFeed>("/notifications", {
    params: { days: params.days ?? 30, limit: params.limit ?? 60 },
  });

  const items = (data?.notifications ?? [])
    .map(toNotification)
    .filter((item): item is AppNotification => item !== null);

  return {
    items,
    unread: typeof data?.unread === "number" ? data.unread : items.filter((item) => !item.read).length,
    total: typeof data?.total === "number" ? data.total : items.length,
    generatedAt: asString(data?.generatedAt) || new Date().toISOString(),
  };
};

/** Clicked rows ko read mark karo — server-side, isliye doosre device par bhi. */
export const markNotificationsRead = async (keys: string[]): Promise<number> => {
  if (keys.length === 0) return 0;
  const { data } = await axiosInstance.post<{ unread?: number }>("/notifications/read", { keys });
  return typeof data?.unread === "number" ? data.unread : 0;
};

/** Poora feed read — "Mark all read" button. */
export const markAllNotificationsRead = async (): Promise<number> => {
  const { data } = await axiosInstance.post<{ unread?: number }>("/notifications/read-all");
  return typeof data?.unread === "number" ? data.unread : 0;
};
