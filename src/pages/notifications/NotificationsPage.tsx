import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  CheckCheck,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import PageHeader from "../../components/common/PageHeader";
import {
  KIND_META,
  ROLE_CHAIN,
  ROLE_ICONS,
  TABS_BY_ROLE,
  timeAgo,
} from "../../components/notifications/notificationMeta";
import { useAuth } from "../../context/AuthContext";
import { adminLabel, formatDateTime } from "../../utils/auditFormat";
import { getApiErrorMessage } from "../../utils/apiError";
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

/*
==========================================
Notifications page — /notifications

Bell dropdown sirf top 10 dikhata hai; yahan poora role-scoped feed aata hai.
Audience server decide karta hai (role + Team & Access permissions), isliye
client koi allow-list nahi rakhta:

  super admin -> sabki activity, escalated / decided reviews
  sub admin   -> apne scope ke normal admins ka kaam + escalations
  normal admin-> apne updates par aaya feedback

Read state server par per admin hai, isliye device badalne par unread count
wahi rehta hai.
==========================================
*/

const MAX_FEED = 200;

const ROLE_CHIP: Record<ActorLevel, string> = {
  super_admin: "bg-amber-50 text-amber-700",
  sub_admin: "bg-sky-50 text-sky-700",
  admin: "bg-slate-100 text-slate-600",
};

const NotificationsPage = () => {
  const { role } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("all");
  const [roleFilter, setRoleFilter] = useState<ActorLevel | "all">("all");
  const [query, setQuery] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadNotifications({ days: 30, limit: MAX_FEED })
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

  const tabs = TABS_BY_ROLE[role] ?? TABS_BY_ROLE.admin;
  const activeTab = tabs.find((entry) => entry.key === tab) ?? tabs[0];

  const tabItems = useMemo(() => items.filter(activeTab.match), [items, activeTab]);

  const tabCounts = useMemo(
    () => tabs.map((entry) => items.filter(entry.match).length),
    [tabs, items]
  );

  /* Kis level se kitni notifications — active tab ke andar. */
  const roleCounts = useMemo(() => {
    const base: Record<ActorLevel, number> = { super_admin: 0, sub_admin: 0, admin: 0 };
    tabItems.forEach((entry) => {
      base[actorLevel(entry.actorRole)] += 1;
    });
    return base;
  }, [tabItems]);

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      tabItems.filter((item) => {
        if (roleFilter !== "all" && actorLevel(item.actorRole) !== roleFilter) return false;
        if (!needle) return true;
        return [item.title, item.message, item.actorName, item.recordLabel, item.productLabel]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      }),
    [tabItems, roleFilter, needle]
  );

  const markRead = async (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.read) return;

    setItems((prev) => prev.map((entry) => (entry.id === id ? { ...entry, read: true } : entry)));
    setUnread((count) => Math.max(0, count - 1));

    try {
      await markNotificationsRead([id]);
    } catch {
      /* agla refresh server state sync kar dega */
    }
  };

  const openItem = (item: AppNotification) => {
    void markRead(item.id);
    if (item.targetPath) navigate(item.targetPath);
  };

  const markAllRead = async () => {
    if (unread === 0 || markingAll) return;
    setMarkingAll(true);
    setItems((prev) => prev.map((entry) => ({ ...entry, read: true })));
    setUnread(0);

    try {
      await markAllNotificationsRead();
    } catch {
      setReloadKey((key) => key + 1);
    } finally {
      setMarkingAll(false);
    }
  };

  const emptyCopy =
    role === "super_admin"
      ? "No admin updates yet. Notes, recommendations and status changes appear here as soon as they arrive."
      : role === "sub_admin"
        ? "Nothing pending review in your scope."
        : "No feedback yet. Once your update or status change is reviewed, it shows up here.";

  return (
    <AdminLayout>
      <PageHeader
        icon={Bell}
        title="Notifications"
        subtitle={`${VIEWER_ROLE_LABEL[role]} · ${unread} unread of ${total}`}
        onRefresh={() => {
          setLoading(true);
          setReloadKey((key) => key + 1);
        }}
        refreshing={loading}
        actions={
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unread === 0 || markingAll}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Mark all read
          </button>
        }
      />

      {/* Tabs + role filter + search */}
      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
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
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.08)] text-[rgb(6,106,156)]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {entry.label}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    active ? "bg-white text-[rgb(6,106,156)]" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {tabCounts[index]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {ROLE_CHAIN.map((level) => {
            const Icon = ROLE_ICONS[level];
            const active = roleFilter === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setRoleFilter(active ? "all" : level)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.08)] text-[rgb(6,106,156)]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={12} />
                {ACTOR_LEVEL_LABEL[level]}
                <span className="tabular-nums text-slate-400">{roleCounts[level]}</span>
              </button>
            );
          })}

          {(roleFilter !== "all" || query) && (
            <button
              type="button"
              onClick={() => {
                setRoleFilter("all");
                setQuery("");
              }}
              className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              <X size={11} /> Clear
            </button>
          )}

          <label className="relative">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notifications"
              aria-label="Search notifications"
              className="w-56 rounded-xl border border-slate-200 bg-white py-1.5 pl-7 pr-2.5 text-xs text-slate-700 outline-none focus:border-[rgb(6,106,156)]"
            />
          </label>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {activeTab.label}
          </p>
          <p className="text-[11px] tabular-nums text-slate-400">
            Showing {visible.length} of {tabItems.length}
          </p>
        </div>

        {error ? (
          <div className="px-4 py-16 text-center" role="alert">
            <p className="text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setReloadKey((key) => key + 1);
              }}
              className="mt-2 text-xs font-semibold text-[rgb(6,106,156)] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Loading notifications…
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <MessageSquare size={20} />
            </span>
            <p className="text-sm font-semibold text-slate-600">No notifications</p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
              {needle || roleFilter !== "all"
                ? "No notification matches this filter. Clear it to see everything."
                : emptyCopy}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((item) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const isUnread = item.read !== true;
              const actor = actorLevel(item.actorRole);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 ${
                      isUnread ? "bg-white" : "bg-slate-50/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tile}`}
                    >
                      <Icon size={15} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-sm font-semibold ${
                            isUnread ? "text-slate-800" : "text-slate-600"
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.priority === "high" && (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600">
                            High
                          </span>
                        )}
                        {isUnread && (
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
                        )}
                        <span
                          className="ml-auto shrink-0 text-[11px] tabular-nums text-slate-400"
                          title={formatDateTime(item.createdAt)}
                        >
                          {timeAgo(item.createdAt)}
                        </span>
                      </span>

                      {item.message && (
                        <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                          {item.message}
                        </span>
                      )}

                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="font-medium text-slate-600" title={item.actorName}>
                          {adminLabel(item.actorName)}
                        </span>
                        {item.actorRole && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${ROLE_CHIP[actor]}`}
                          >
                            {ACTOR_LEVEL_LABEL[actor]}
                          </span>
                        )}
                        {item.recordLabel && <span>· {item.recordLabel}</span>}
                        {item.productLabel && item.productLabel !== item.recordLabel && (
                          <span>· {item.productLabel}</span>
                        )}
                        {item.targetPath && (
                          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[rgb(6,106,156)]">
                            {item.targetLabel}
                            <ArrowUpRight size={11} />
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AdminLayout>
  );
};

export default NotificationsPage;
