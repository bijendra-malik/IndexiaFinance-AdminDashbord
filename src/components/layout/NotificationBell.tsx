import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Bell, ChevronRight, Loader2, MessageSquare, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  ACTOR_LEVEL_LABEL,
  VIEWER_ROLE_LABEL,
  actorLevel,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  type ActorLevel,
  type AppNotification,
} from "../../api/notifications";
import type { AdminRole } from "../../api/adminUsers";
import {
  KIND_META,
  ROLE_CHAIN,
  ROLE_ICONS,
  TABS_BY_ROLE,
  timeAgo,
} from "../notifications/notificationMeta";
import { adminLabel } from "../../utils/auditFormat";
import { getApiErrorMessage } from "../../utils/apiError";

/*
==========================================
NotificationBell — topbar inbox

Pehle yahan ek dummy bell thi: koi click handler nahi aur ek permanent red dot,
isliye har admin ko lagta tha ki ek notification pending hai. Ab ye real feed
dikhati hai — role ke hisaab se tabs, rows aur actions.

Role split `src/api/notifications.ts` se aati hai, aur uska source server hai
(`GET /api/admin/notifications`) — client koi allow-list nahi rakhta:
  super admin   -> escalated high, baaki sab low
  sub admin     -> apne scope ke naye update / recommendation / flag
  regular admin -> apne scope ke sabhi admins ke update + apna feedback

Read state server par per admin hai, isliye unread count device-independent hai.
==========================================
*/

const BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";

/** Dropdown me sirf top 10 — poora feed `/notifications` page par. */
const PREVIEW_LIMIT = 10;
/**
 * Server se 10 se zyada rows lete hain, taaki tab/role counts poore feed ke
 * hisaab se hon (header me "10 of 33" galat nahi lagna chahiye).
 */
const FETCH_LIMIT = 50;

const FOOTER_BY_ROLE: Record<AdminRole, { to: string; label: string }> = {
  super_admin: { to: "/activity", label: "Open Admin Updates" },
  sub_admin: { to: "/review", label: "Open Review Queue" },
  admin: { to: "/dashboard", label: "Open Dashboard" },
};

/** Viewer ke hisaab se ek line me uski position define. */
const ROLE_HIERARCHY_HINT: Record<AdminRole, string> = {
  super_admin:
    "You are at the top: sub admins report to you, normal admins to them. Notifications from both levels arrive here.",
  sub_admin:
    "You report to the super admin: you review normal admins' work, and escalated cases go to the super admin.",
  admin:
    "You report to a sub admin: they review your notes and recommendations, and their feedback appears here.",
};

const NotificationBell = ({
  onUnreadChange,
}: {
  /** Topbar ke doosre badge (profile menu) ko unread count se sync rakhta hai. */
  onUnreadChange?: (count: number) => void;
}) => {
  const { role, isSuperAdmin, can } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  /* Hierarchy chip se actor-role filter — tab ke saath combine hota hai. */
  const [roleFilter, setRoleFilter] = useState<ActorLevel | "all">("all");
  const [items, setItems] = useState<AppNotification[]>([]);
  /* Server ka unread count — loaded page se bada ho sakta hai. */
  const [unread, setUnread] = useState(0);
  /* Feed ka total — dropdown sirf top 10 dikhata hai, isliye "View all" par count. */
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  /*
  Audience server decide karta hai (role + Team & Access permissions), isliye
  client par koi scope/allow-list nahi bhejni padti.
  */
  useEffect(() => {
    let cancelled = false;

    loadNotifications({ limit: FETCH_LIMIT })
      .then((feed) => {
        if (cancelled) return;
        setItems(feed.items);
        setUnread(feed.unread);
        setTotal(feed.total);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getApiErrorMessage(err, "Could not load notifications."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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

  /* Parent (profile menu badge) ko sirf count chahiye — feed yahin fetch hoti hai,
     isliye doosri request nahi lagti. */
  useEffect(() => {
    onUnreadChange?.(unread);
  }, [unread, onUnreadChange]);

  const tabItems = useMemo(() => items.filter(activeTab.match), [items, activeTab]);

  /* Kis level se kitni notifications aayi — active tab ke andar ke counts. */
  const roleCounts = useMemo(() => {
    const base: Record<ActorLevel, number> = { super_admin: 0, sub_admin: 0, admin: 0 };
    tabItems.forEach((item) => {
      if (!item.actorRole) return;
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

  /* Dropdown me top 10; poora feed "View all" par. */
  const preview = visible.slice(0, PREVIEW_LIMIT);

  /*
  Read state server par hai, isliye UI optimistic update karti hai aur API fail
  hone par agla refresh server ka sach wapas le aata hai.
  */
  const markRead = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.read) return;

    setItems((prev) => prev.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)));
    setUnread((count) => Math.max(0, count - 1));

    try {
      await markNotificationsRead([id]);
    } catch {
      /* agla fetch server state sync kar dega */
    }
  };

  const markAllRead = async () => {
    if (items.length === 0 || unread === 0) return;

    setItems((prev) => prev.map((entry) => ({ ...entry, read: true })));
    setUnread(0);

    try {
      await markAllNotificationsRead();
    } catch {
      setReloadKey((key) => key + 1);
    }
  };

  const openItem = (item: AppNotification) => {
    void markRead(item.id);
    setOpen(false);
    if (item.targetPath) navigate(item.targetPath);
  };

  const footer = FOOTER_BY_ROLE[role] ?? FOOTER_BY_ROLE.admin;
  const canOpenFooter =
    footer.to !== "/review" || isSuperAdmin || can("updates.review");

  const emptyCopy =
    role === "super_admin"
      ? "No admin updates yet. Notes and recommendations appear here as soon as they arrive."
      : role === "sub_admin"
        ? "Nothing pending review in your scope."
        : "No updates yet. Status changes and notes from other admins show up here.";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition ${
          open ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
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
                  {VIEWER_ROLE_LABEL[role]} · {unread} unread
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
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
                  click a role to filter
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
                        {roleCounts[level]} notification
                        {roleCounts[level] === 1 ? "" : "s"}
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
                    ? `No notifications from ${ACTOR_LEVEL_LABEL[roleFilter]}`
                    : tab === "all"
                      ? "No notifications"
                      : "Nothing in this tab"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  {roleFilter !== "all" ? "Pick another role or clear the filter." : emptyCopy}
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
                {preview.map((item) => {
                  const meta = KIND_META[item.kind];
                  const Icon = meta.icon;
                  const isUnread = item.read !== true;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        title={item.targetPath ? item.targetLabel : undefined}
                        className={`group flex w-full gap-2.5 px-3.5 py-3 text-left transition hover:bg-slate-50 ${
                          isUnread ? "bg-white" : "bg-slate-50/40"
                        }`}
                      >
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tile}`}>
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`truncate text-xs font-semibold group-hover:text-[rgb(6,106,156)] group-hover:underline ${
                                isUnread ? "text-slate-800" : "text-slate-600"
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
                          {item.message && (
                            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">
                              {item.message}
                            </span>
                          )}
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
                            {isUnread && (
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
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-[rgba(6,106,156,0.08)] px-2 py-1 text-[11px] font-bold text-[rgb(6,106,156)] transition hover:bg-[rgba(6,106,156,0.14)]"
            >
              View all
              {total > PREVIEW_LIMIT && (
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] tabular-nums">
                  {total}
                </span>
              )}
              <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
