import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Loader2,
  MessageSquare,
  ShieldCheck,
  UserCircle,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  ACTOR_LEVEL_LABEL,
  VIEWER_ROLE_LABEL,
  actorLevel,
  loadNotifications,
  loadReadIds,
  saveReadIds,
  type ActorLevel,
  type AppNotification,
  type NotificationKind,
} from "../../api/notifications";
import type { AdminRole } from "../../api/adminUsers";
import { adminLabel } from "../../utils/auditFormat";
import { getApiErrorMessage } from "../../utils/apiError";

/*
==========================================
NotificationBell — topbar inbox

Pehle yahan ek dummy bell thi: koi click handler nahi aur ek permanent red dot,
isliye har admin ko lagta tha ki ek notification pending hai. Ab ye real feed
dikhati hai — role ke hisaab se tabs, rows aur actions.

Role split (data layer `src/api/notifications.ts` me hai):
  super admin   -> sab updates + escalated reviews, decision/escalation tabs
  sub admin     -> sirf scope ke pending reviews, review queue par jaata hai
  regular admin -> sirf apne updates par aaya feedback

Phase 1 limitation: read state browser-local hai, aur unread count loaded rows
se banta hai (server me `/notifications` endpoint aane par server count hoga).
==========================================
*/

const BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";

interface NotificationTab {
  key: string;
  label: string;
  match: (item: AppNotification) => boolean;
}

const TABS_BY_ROLE: Record<AdminRole, NotificationTab[]> = {
  super_admin: [
    { key: "all", label: "All", match: () => true },
    { key: "decision", label: "Decisions", match: (item) => item.kind === "recommendation" },
    { key: "escalation", label: "Escalations", match: (item) => item.kind === "escalation" },
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

const KIND_META: Record<
  NotificationKind,
  { icon: typeof Bell; tile: string }
> = {
  note: { icon: MessageSquare, tile: "bg-slate-100 text-slate-500" },
  recommendation: { icon: Clock3, tile: "bg-amber-50 text-amber-600" },
  escalation: { icon: ArrowUpRight, tile: "bg-sky-50 text-sky-600" },
  flag: { icon: XCircle, tile: "bg-rose-50 text-rose-600" },
  verified: { icon: CheckCircle2, tile: "bg-emerald-50 text-emerald-600" },
  returned: { icon: XCircle, tile: "bg-rose-50 text-rose-600" },
  decided: { icon: ShieldCheck, tile: "bg-indigo-50 text-indigo-600" },
};

const FOOTER_BY_ROLE: Record<AdminRole, { to: string; label: string }> = {
  super_admin: { to: "/activity", label: "Open Admin Updates" },
  sub_admin: { to: "/review", label: "Open Review Queue" },
  admin: { to: "/dashboard", label: "Open Dashboard" },
};

/** Reporting chain — har panel me same order, taaki hierarchy clear rahe. */
const ROLE_CHAIN: ActorLevel[] = ["super_admin", "sub_admin", "admin"];

const ROLE_ICONS: Record<ActorLevel, typeof Bell> = {
  super_admin: ShieldCheck,
  sub_admin: Users,
  admin: UserCircle,
};

/** Viewer ke hisaab se ek line me uski position define. */
const ROLE_HIERARCHY_HINT: Record<AdminRole, string> = {
  super_admin:
    "Aap sabse upar ho: sub admin aapke under hai, normal admin sub admin ke under. Dono ki notifications aapke paas aati hain.",
  sub_admin:
    "Aap super admin ke under ho: normal admin ka kaam aap review karte ho, aur escalate kiya case super admin ko jaata hai.",
  admin:
    "Aap sub admin ke under ho: aapke note/recommendation ka review sub admin karta hai, feedback yahan aata hai.",
};

const timeAgo = (iso: string): string => {
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

const NotificationBell = () => {
  const { admin, role, isSuperAdmin, isSubAdmin, can, accessibleLoanTypes, canAccessModule } =
    useAuth();
  const navigate = useNavigate();

  const adminId = admin?._id ?? "";
  const adminEmail = (admin?.email ?? "").trim().toLowerCase();
  const identity = adminEmail || admin?.loginId || adminId || "anon";

  /* Sub admin jise `updates.view` nahi mila, uske liye queue fetch hi nahi. */
  const enabled = !isSubAdmin || can("updates.view");

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  /* Hierarchy chip se actor-role filter — tab ke saath combine hota hai. */
  const [roleFilter, setRoleFilter] = useState<ActorLevel | "all">("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(identity));
  const wrapRef = useRef<HTMLDivElement>(null);

  /*
  Scope ko primitive signature se memoize kiya — `accessibleLoanTypes` aur
  `canAccessModule` har render par naye hote hain, warna fetch effect loop
  me chala jaata.
  */
  const loanSlugs = accessibleLoanTypes.map((loan) => loan.slug);
  const loanKey = loanSlugs.join("|");
  const moduleKey = (["customers", "franchises"] as const)
    .filter((module) => canAccessModule(module))
    .join("|");

  const scope = useMemo(
    () => ({
      loanSlugs: isSuperAdmin ? null : (loanKey ? loanKey.split("|") : []),
      modules: isSuperAdmin
        ? ("all" as const)
        : (moduleKey ? (moduleKey.split("|") as Array<"customers" | "franchises">) : []),
    }),
    [isSuperAdmin, loanKey, moduleKey]
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadNotifications({ role, adminId, adminEmail, scope })
      .then((feed) => {
        if (cancelled) return;
        setItems(feed.items);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "Notifications load nahi ho paaye."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, role, adminId, adminEmail, scope, reloadKey]);

  /* Window focus par refresh — user doosre tab se wapas aaye to count fresh ho. */
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setReloadKey((key) => key + 1);
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 120_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  /* Outside click / Escape — dono par panel band. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const tabs = TABS_BY_ROLE[role] ?? TABS_BY_ROLE.admin;
  const activeTab = tabs.find((entry) => entry.key === tab) ?? tabs[0];

  const unreadCount = useMemo(
    () => items.reduce((count, item) => (readIds.has(item.id) ? count : count + 1), 0),
    [items, readIds]
  );

  const tabItems = useMemo(() => items.filter(activeTab.match), [items, activeTab]);

  /* Kis level se kitni notifications aayi — active tab ke andar ke counts. */
  const roleCounts = useMemo(() => {
    const base: Record<ActorLevel, number> = { super_admin: 0, sub_admin: 0, admin: 0 };
    tabItems.forEach((item) => {
      base[actorLevel(item.actorRole)] += 1;
    });
    return base;
  }, [tabItems]);

  const tabCounts = useMemo(
    () => tabs.map((entry) => items.filter(entry.match).length),
    [tabs, items]
  );

  const visible = useMemo(
    () =>
      roleFilter === "all"
        ? tabItems
        : tabItems.filter((item) => actorLevel(item.actorRole) === roleFilter),
    [tabItems, roleFilter]
  );

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    const next = new Set(readIds);
    next.add(id);
    saveReadIds(identity, next);
    setReadIds(next);
  };

  const markAllRead = () => {
    if (items.length === 0) return;
    const next = new Set(readIds);
    items.forEach((item) => next.add(item.id));
    saveReadIds(identity, next);
    setReadIds(next);
  };

  const openItem = (item: AppNotification) => {
    markRead(item.id);
    setOpen(false);
    navigate(item.targetPath);
  };

  const footer = FOOTER_BY_ROLE[role] ?? FOOTER_BY_ROLE.admin;
  const canOpenFooter =
    footer.to !== "/review" || isSuperAdmin || can("updates.review");

  const emptyCopy =
    role === "super_admin"
      ? "Abhi koi admin update nahi aaya. Note ya recommendation aate hi yahan dikhega."
      : role === "sub_admin"
        ? "Aapke scope me review ke liye kuch pending nahi hai."
        : "Abhi koi feedback nahi aaya. Aapke update par review hote hi yahan dikhega.";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
          open ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2.5 w-[21.5rem] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl sm:w-[24rem]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3.5 py-3 text-white" style={{ background: BRAND_GRADIENT }}>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Bell size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">Notifications</p>
                <p className="truncate text-[10px] leading-tight text-white/80">
                  {VIEWER_ROLE_LABEL[role]} · {unreadCount} unread
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="rounded-lg px-2 py-1 text-[10px] font-semibold text-white/90 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/15"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Hierarchy — kaun kis ke under hai; chip click karke role filter */}
          <div className="border-b border-slate-100 bg-white px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Reporting chain
              </p>
              {roleFilter === "all" ? (
                <span className="text-[9px] font-medium text-slate-300">
                  role par click karke filter karo
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setRoleFilter("all")}
                  className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-semibold text-[rgb(6,106,156)] transition hover:bg-[rgba(6,106,156,0.08)]"
                >
                  <X size={10} /> Clear filter
                </button>
              )}
            </div>

            <div className="flex items-stretch gap-1" role="group" aria-label="Filter notifications by role">
              {ROLE_CHAIN.map((level, index) => {
                const isViewer = level === role;
                const isActive = roleFilter === level;
                const Icon = ROLE_ICONS[level];
                return (
                  <Fragment key={level}>
                    {index > 0 && (
                      <ChevronRight
                        size={11}
                        aria-hidden
                        className="shrink-0 self-center text-slate-300"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setRoleFilter(isActive ? "all" : level)}
                      aria-pressed={isActive}
                      title={
                        isActive
                          ? `Clear ${ACTOR_LEVEL_LABEL[level]} filter`
                          : `Show only ${ACTOR_LEVEL_LABEL[level]} notifications`
                      }
                      className={`group flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border px-2 py-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(6,106,156,0.35)] ${
                        isActive
                          ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.1)] shadow-sm"
                          : isViewer
                            ? "border-[rgba(6,106,156,0.3)] bg-[rgba(6,106,156,0.05)] hover:bg-[rgba(6,106,156,0.09)]"
                            : "border-slate-200 bg-white hover:border-[rgba(6,106,156,0.35)] hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-1">
                        <Icon
                          size={11}
                          aria-hidden
                          className={
                            isActive
                              ? "shrink-0 text-[rgb(6,106,156)]"
                              : "shrink-0 text-slate-400 group-hover:text-slate-500"
                          }
                        />
                        <span
                          className={`truncate text-[10px] font-bold ${
                            isActive || isViewer ? "text-[rgb(6,106,156)]" : "text-slate-600"
                          }`}
                        >
                          {ACTOR_LEVEL_LABEL[level]}
                        </span>
                        {isViewer && (
                          <span className="shrink-0 rounded bg-white px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[rgb(6,106,156)]">
                            You
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-medium tabular-nums text-slate-400">
                        {roleCounts[level]} notif
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[rgb(6,106,156)]" aria-hidden />
                        )}
                      </span>
                    </button>
                  </Fragment>
                );
              })}
            </div>

            <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
              {ROLE_HIERARCHY_HINT[role]}
            </p>
          </div>

          {/* Role tabs */}
          <div className="scrollbar-hidden flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/70 px-2 pt-2">
            {tabs.map((entry, index) => {
              const active = entry.key === activeTab.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => {
                    setTab(entry.key);
                    setRoleFilter("all");
                  }}
                  aria-pressed={active}
                  className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    active ? "bg-white text-[rgb(6,106,156)]" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {entry.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${
                      active ? "bg-[rgba(6,106,156,0.1)]" : "bg-slate-200/70 text-slate-500"
                    }`}
                  >
                    {tabCounts[index]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="scrollbar-hidden max-h-[18rem] overflow-y-auto">
            {error ? (
              <div className="px-4 py-8 text-center" role="alert">
                <p className="text-xs text-rose-600">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setLoading(true);
                    setReloadKey((key) => key + 1);
                  }}
                  className="mt-2 text-[11px] font-semibold text-[rgb(6,106,156)] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Loading notifications…
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-9 text-center">
                <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                  <MessageSquare size={18} />
                </span>
                <p className="text-xs font-semibold text-slate-600">
                  {roleFilter !== "all"
                    ? `${ACTOR_LEVEL_LABEL[roleFilter]} se kuch nahi`
                    : tab === "all"
                      ? "Koi notification nahi"
                      : "Is tab me kuch nahi"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {roleFilter !== "all" ? "Doosra role chuno ya filter clear karo." : emptyCopy}
                </p>
                {roleFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setRoleFilter("all")}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <X size={10} /> Clear filter
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((item) => {
                  const meta = KIND_META[item.kind];
                  const Icon = meta.icon;
                  const unread = !readIds.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className={`flex w-full gap-2.5 px-3.5 py-3 text-left transition hover:bg-slate-50 ${
                          unread ? "bg-white" : "bg-slate-50/40"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tile}`}>
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`truncate text-xs font-semibold ${
                                unread ? "text-slate-800" : "text-slate-600"
                              }`}
                            >
                              {item.title}
                            </span>
                            {item.priority === "high" && (
                              <span className="shrink-0 rounded bg-rose-50 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-rose-600">
                                High
                              </span>
                            )}
                            <span className="ml-auto shrink-0 text-[10px] tabular-nums text-slate-400">
                              {timeAgo(item.createdAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">
                            {item.message}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                            <span className="truncate font-medium text-slate-500" title={item.actorName}>
                              {adminLabel(item.actorName)}
                            </span>
                            {item.actorRole && (
                              <span
                                className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                  actorLevel(item.actorRole) === "super_admin"
                                    ? "bg-amber-50 text-amber-700"
                                    : actorLevel(item.actorRole) === "sub_admin"
                                      ? "bg-sky-50 text-sky-700"
                                      : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {ACTOR_LEVEL_LABEL[actorLevel(item.actorRole)]}
                              </span>
                            )}
                            {item.recordLabel && (
                              <span className="truncate">· {item.recordLabel}</span>
                            )}
                            {unread && (
                              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-3.5 py-2">
            {canOpenFooter ? (
              <Link
                to={footer.to}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[rgb(6,106,156)] hover:underline"
              >
                {footer.label}
                <ArrowUpRight size={11} />
              </Link>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400">
                {footer.label} not available
              </span>
            )}
            <span className="text-[10px] tabular-nums text-slate-400">
              {items.length} loaded
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
