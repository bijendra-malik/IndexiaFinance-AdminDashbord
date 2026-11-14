import { getAdminActivity, type AdminActivityUpdate } from "./adminActivity";
import { fetchReceivedReviews, fetchReviews, reviewKey, type ReviewRecord } from "./adminReviews";
import type { AdminRole } from "./adminUsers";

/*
==========================================
Notification feed (Phase 1 — UI layer)

Abhi backend me koi /notifications endpoint nahi hai, isliye feed purane do
sources se derive hoti hai:

  /activity   -> regular admins ke notes, recommendations, flags, escalations
  /reviews    -> sub admin ke verify / return / escalate / decide states
  /reviews/mine -> regular admin ke apne updates par aaya feedback

Har role ka audience rule yahin ek jagah likha hai, component me nahi:

  super admin -> sab kuch (recommendation aur escalation priority)
  sub admin   -> sirf apne scope ke pending updates + escalations
  regular admin -> sirf apne updates par aaya feedback

Read state per admin localStorage me hai (`loan_admin_notif_read_v1:<email>`).
Ye Phase 1 ka limitation hai — Phase 2 me server `readAt` aayega, tab badge
server ke unread count se banega, loaded list se nahi.
==========================================
*/

export type NotificationKind =
  | "note"
  | "recommendation"
  | "escalation"
  | "flag"
  | "verified"
  | "returned"
  | "decided";

export type NotificationPriority = "high" | "normal";

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
  /** Stable id — refresh par duplicate row na bane. */
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  actorName: string;
  actorRole: string;
  /** Jis record par ye hua — customer name / application no. */
  recordLabel: string;
  productLabel: string;
  /** Click karne par kahan jana hai. */
  targetPath: string;
  targetLabel: string;
  createdAt: string;
  priority: NotificationPriority;
}

export interface NotificationScope {
  /** `null` = every loan product (super admin). */
  loanSlugs?: string[] | null;
  /** `"all"` or the assigned modules; entity rows isi se filter hote hain. */
  modules?: Array<"customers" | "franchises"> | "all" | null;
}

export interface NotificationFeed {
  items: AppNotification[];
  generatedAt: string;
}

/** Panel me itne se zyada rows rakhna bekaar hai — baaki /activity me hai. */
const MAX_ITEMS = 60;

const clamp = (text: string | null | undefined, max = 150): string => {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

const readable = (value?: string | null, fallback = "Admin") =>
  (value ?? "").trim() || fallback;

/** High priority pehle, phir newest. Invalid date sabse neeche. */
const sortItems = (items: AppNotification[]): AppNotification[] =>
  [...items].sort((left, right) => {
    if (left.priority !== right.priority) return left.priority === "high" ? -1 : 1;
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });

/* ── Target routes — AdminUpdates ke targetFor() jaisa hi rule ─────────────── */

const targetForUpdate = (
  update: AdminActivityUpdate,
  fallbackPath: string
): { path: string; label: string } => {
  if (update.entity === "customer") {
    return {
      path: `/customers?customer=${encodeURIComponent(update.entityId || update.applicationId)}`,
      label: "Open customer",
    };
  }
  if (update.entity === "franchise") {
    return {
      path: `/franchises/${update.entityId || update.applicationId}`,
      label: "Open franchise",
    };
  }
  if (update.slug && update.applicationId) {
    return { path: `/applications/${update.slug}/${update.applicationId}`, label: "Open application" };
  }
  return { path: fallbackPath, label: "Open updates" };
};

const targetForReview = (
  record: ReviewRecord,
  fallbackPath: string
): { path: string; label: string } => {
  if (record.entity === "customer" && record.applicationId) {
    return {
      path: `/customers?customer=${encodeURIComponent(record.applicationId)}`,
      label: "Open customer",
    };
  }
  if (record.entity === "franchise" && record.applicationId) {
    return { path: `/franchises/${record.applicationId}`, label: "Open franchise" };
  }
  if (record.slug && record.applicationId) {
    return { path: `/applications/${record.slug}/${record.applicationId}`, label: "Open application" };
  }
  return { path: fallbackPath, label: "Open record" };
};

/* ── Activity row -> notification ─────────────────────────────────────────── */

const activityKind = (
  update: AdminActivityUpdate
): { kind: NotificationKind; title: string; priority: NotificationPriority } => {
  if (update.kind === "recommendation") {
    return { kind: "recommendation", title: "Decision pending", priority: "high" };
  }
  if (update.tag === "escalation") {
    return { kind: "escalation", title: "Escalation raised", priority: "high" };
  }
  if (update.tag === "flag") {
    return { kind: "flag", title: "Flag raised", priority: "high" };
  }
  return { kind: "note", title: "New admin note", priority: "normal" };
};

const activityMessage = (update: AdminActivityUpdate): string => {
  const body = clamp(update.text);
  if (update.kind === "recommendation" && update.suggestedStatus) {
    return `${update.suggestedStatus} suggested${body ? ` — ${body}` : ""}`;
  }
  return body || "Record par ek update add kiya gaya.";
};

const activityRecordLabel = (update: AdminActivityUpdate): string =>
  readable(
    update.customerName || update.applicationNo || update.label,
    update.entity === "customer" ? "Customer" : update.entity === "franchise" ? "Franchise" : "Record"
  );

const activityProductLabel = (update: AdminActivityUpdate): string => {
  if (update.entity === "customer") return "Customer";
  if (update.entity === "franchise") return "Franchise";
  return readable(update.label, "Loan application");
};

const notificationFromUpdate = (
  update: AdminActivityUpdate,
  options: { title?: string; fallbackPath: string }
): AppNotification => {
  const meta = activityKind(update);
  const target = targetForUpdate(update, options.fallbackPath);
  return {
    id: `activity:${update.entity ?? "loan"}:${update.applicationId}:${update.id}`,
    kind: meta.kind,
    title: options.title ?? meta.title,
    message: activityMessage(update),
    actorName: readable(update.adminName),
    actorRole: update.adminRole,
    recordLabel: activityRecordLabel(update),
    productLabel: activityProductLabel(update),
    targetPath: target.path,
    targetLabel: target.label,
    createdAt: update.addedAt,
    priority: meta.priority,
  };
};

/* ── Super admin: poori organisation ──────────────────────────────────────── */

const buildSuperAdminFeed = (
  updates: AdminActivityUpdate[],
  reviews: Record<string, ReviewRecord>,
  selfId: string,
  adminEmail: string
): AppNotification[] => {
  /* Final decisions already end state hain — unki notification noise hai. */
  const fromActivity = updates
    .filter((update) => update.kind !== "status")
    .filter((update) => !selfId || update.adminId !== selfId)
    .map((update) => notificationFromUpdate(update, { fallbackPath: "/activity" }));

  /* Sub admin ne escalate kiya — super admin ka decision pending. */
  const fromReviews = Object.values(reviews).flatMap((record) => {
    if (record.state !== "escalated") return [];
    if (record.reviewedBy?.trim().toLowerCase() === adminEmail) return [];
    const target = targetForReview(record, "/review");
    return [
      {
        id: `review:${record.key}`,
        kind: "escalation" as const,
        title: "Escalated for your decision",
        message: clamp(record.note) || "Sub admin ne ye case aapke decision ke liye bheja hai.",
        actorName: readable(record.reviewedByName, "Sub admin"),
        actorRole: record.reviewedByRole,
        recordLabel: readable(record.applicationId, "Record"),
        productLabel: record.entity === "customer" ? "Customer" : record.entity === "franchise" ? "Franchise" : "Loan application",
        targetPath: target.path,
        targetLabel: target.label,
        createdAt: record.reviewedAt,
        priority: "high" as const,
      },
    ];
  });

  return sortItems([...fromActivity, ...fromReviews]).slice(0, MAX_ITEMS);
};

/* ── Sub admin: sirf apna scope, sirf pending kaam ────────────────────────── */

const buildSubAdminFeed = (
  updates: AdminActivityUpdate[],
  reviews: Record<string, ReviewRecord>,
  scope: NotificationScope,
  adminEmail: string
): AppNotification[] => {
  const allowedSlug = (slug?: string) =>
    !slug || scope.loanSlugs == null || scope.loanSlugs.includes(slug);

  const allowedEntity = (entity?: string) => {
    if (entity !== "customer" && entity !== "franchise") return true;
    if (scope.modules === "all") return true;
    const moduleKey = entity === "customer" ? "customers" : "franchises";
    return Array.isArray(scope.modules) && scope.modules.includes(moduleKey);
  };

  const fromQueue = updates.flatMap((update) => {
    if (update.kind === "status") return [];
    if (!allowedSlug(update.slug) || !allowedEntity(update.entity)) return [];

    const record = reviews[reviewKey(update)];
    const state = record?.state ?? "pending";
    if (state !== "pending") return [];
    if (record?.reviewedBy?.trim().toLowerCase() === adminEmail) return [];

    /* Queue row ka title "Needs review" hai — recommendation yahan decision
       nahi, sirf review ka signal hai. */
    const notification = notificationFromUpdate(update, {
      title: "Needs review",
      fallbackPath: "/review",
    });
    return [
      {
        ...notification,
        priority: update.kind === "recommendation" ? "high" : notification.priority,
      },
    ];
  });

  /* Kisi doosre supervisor ne escalate kiya — scope me ho to dikhe. */
  const fromEscalations = Object.values(reviews).flatMap((record) => {
    if (record.state !== "escalated") return [];
    if (record.reviewedBy?.trim().toLowerCase() === adminEmail) return [];
    if (!allowedSlug(record.slug)) return [];
    if (!allowedEntity(record.entity)) return [];
    const target = targetForReview(record, "/review");
    return [
      {
        id: `review:${record.key}`,
        kind: "escalation" as const,
        title: "Escalated to super admin",
        message: clamp(record.note) || "Case super admin ke decision ke liye bheja gaya.",
        actorName: readable(record.reviewedByName, "Sub admin"),
        actorRole: record.reviewedByRole,
        recordLabel: readable(record.applicationId, "Record"),
        productLabel: record.entity === "customer" ? "Customer" : record.entity === "franchise" ? "Franchise" : "Loan application",
        targetPath: target.path,
        targetLabel: target.label,
        createdAt: record.reviewedAt,
        priority: "normal" as const,
      },
    ];
  });

  return sortItems([...fromQueue, ...fromEscalations]).slice(0, MAX_ITEMS);
};

/* ── Regular admin: sirf apne updates par aaya feedback ───────────────────── */

const FEEDBACK_META: Record<
  Exclude<ReviewRecord["state"], "pending">,
  { kind: NotificationKind; title: string; priority: NotificationPriority; fallback: string }
> = {
  verified: {
    kind: "verified",
    title: "Update verified",
    priority: "normal",
    fallback: "Aapka update verify ho gaya.",
  },
  returned: {
    kind: "returned",
    title: "Correction required",
    priority: "high",
    fallback: "Wajah ke saath wapas bheja gaya — dobara check karo.",
  },
  escalated: {
    kind: "escalation",
    title: "Escalated to super admin",
    priority: "normal",
    fallback: "Aapka update super admin ke paas decision ke liye gaya.",
  },
  decided: {
    kind: "decided",
    title: "Decision recorded",
    priority: "normal",
    fallback: "Record par final decision record ho gaya.",
  },
};

const buildAdminFeedback = (
  records: ReviewRecord[],
  adminEmail: string
): AppNotification[] => {
  const items = records.flatMap((record) => {
    if (!record.state || record.state === "pending") return [];
    if (record.reviewedBy?.trim().toLowerCase() === adminEmail) return [];

    const meta = FEEDBACK_META[record.state];
    const target = targetForReview(record, "/dashboard");
    return [
      {
        id: `feedback:${record.key}`,
        kind: meta.kind,
        title: meta.title,
        message: clamp(record.note) || meta.fallback,
        actorName: readable(record.reviewedByName, "Reviewer"),
        actorRole: record.reviewedByRole,
        recordLabel:
          record.entity === "customer"
            ? "Customer record"
            : record.entity === "franchise"
              ? "Franchise record"
              : readable(record.applicationId, "Aapka update"),
        productLabel:
          record.entity === "customer" ? "Customer" : record.entity === "franchise" ? "Franchise" : "Loan application",
        targetPath: target.path,
        targetLabel: target.label,
        createdAt: record.reviewedAt,
        priority: meta.priority,
      },
    ];
  });

  return sortItems(items).slice(0, MAX_ITEMS);
};

/* ── Entry point ──────────────────────────────────────────────────────────── */

export const loadNotifications = async (params: {
  role: AdminRole;
  adminId?: string;
  adminEmail?: string;
  scope?: NotificationScope;
}): Promise<NotificationFeed> => {
  const adminEmail = (params.adminEmail ?? "").trim().toLowerCase();
  const scope = params.scope ?? {};
  const generatedAt = new Date().toISOString();

  if (params.role === "admin") {
    const records = await fetchReceivedReviews();
    return { items: buildAdminFeedback(records, adminEmail), generatedAt };
  }

  const [activity, reviews] = await Promise.all([
    getAdminActivity({ days: 30, limit: 500 }),
    fetchReviews(),
  ]);

  if (params.role === "super_admin") {
    return {
      items: buildSuperAdminFeed(activity.updates, reviews, params.adminId ?? "", adminEmail),
      generatedAt,
    };
  }

  return {
    items: buildSubAdminFeed(activity.updates, reviews, scope, adminEmail),
    generatedAt,
  };
};

/* ── Read state (Phase 1: browser-local) ──────────────────────────────────── */

const READ_KEY_PREFIX = "loan_admin_notif_read_v1";
const MAX_READ_IDS = 400;

const storageKey = (identity: string) =>
  `${READ_KEY_PREFIX}:${(identity || "anon").trim().toLowerCase()}`;

export const loadReadIds = (identity: string): Set<string> => {
  try {
    const raw = localStorage.getItem(storageKey(identity));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
    );
  } catch {
    return new Set();
  }
};

export const saveReadIds = (identity: string, ids: Set<string>): void => {
  try {
    localStorage.setItem(storageKey(identity), JSON.stringify([...ids].slice(-MAX_READ_IDS)));
  } catch {
    /* quota / private mode — session ke andar state phir bhi sahi rahegi */
  }
};
