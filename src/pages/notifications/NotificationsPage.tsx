import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  CheckCheck,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import PageHeader from "../../components/common/PageHeader";
import FilterSelect from "../../components/common/FilterSelect";
import {
  KIND_META,
  ROLE_CHAIN,
  ROLE_ICONS,
  TABS_BY_ROLE,
  isCustomerScoped,
  isFranchiseScoped,
  isLoanScoped,
  notificationScope,
  timeAgo,
  type NotificationScope,
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
  type NotificationKind,
} from "../../api/notifications";

/*
==========================================
Notifications page — /notifications

Bell dropdown sirf top 10 dikhata hai; yahan poora role-scoped feed aata hai.
Audience server decide karta hai (role + Team & Access permissions), isliye
client koi allow-list nahi rakhta:

  super admin -> sabki activity, escalated / decided reviews
  sub admin   -> apne scope ke normal admins ka kaam + escalations
  normal admin-> apne scope ke sabhi admins ka update + apna feedback

Read state server par per admin hai, isliye device badalne par unread count
wahi rehta hai.

Feed ek hi table me render hota hai — har tab (All / Decisions / Escalations /
Franchise) ke rows ka same structure rehta hai, taaki columns align rahein aur
franchise + admin activity mix hone par bhi padhne me gadbad na ho.
==========================================
*/

const MAX_FEED = 200;

const ROLE_CHIP: Record<ActorLevel, string> = {
  super_admin: "bg-amber-50 text-amber-700",
  sub_admin: "bg-sky-50 text-sky-700",
  admin: "bg-slate-100 text-slate-600",
};

const KIND_LABEL: Record<NotificationKind, string> = {
  note: "Note",
  recommendation: "Recommendation",
  escalation: "Escalation",
  verified: "Verified",
  returned: "Returned",
  decided: "Decision",
  franchise: "Franchise",
};

const KIND_BADGE: Record<NotificationKind, string> = {
  note: "bg-slate-100 text-slate-600",
  recommendation: "bg-amber-50 text-amber-700",
  escalation: "bg-sky-50 text-sky-700",
  verified: "bg-emerald-50 text-emerald-700",
  returned: "bg-rose-50 text-rose-700",
  decided: "bg-indigo-50 text-indigo-700",
  franchise: "bg-violet-50 text-violet-700",
};

/* Scope badge pehle hi "Franchise" bolta hai, is liye yahan sirf nature likhte hain. */
const typeLabel = (item: AppNotification): string => {
  if (item.kind !== "franchise") return KIND_LABEL[item.kind];
  return item.activityType === "franchise_read" ? "Activity" : "Application";
};

/* Franchise rows me actor ek franchise/customer hoti hai; baaki rows me admin. */
const isAdminActor = (item: AppNotification): boolean =>
  /admin/i.test(item.actorRole) || (!item.actorRole && /^admin/i.test(item.actorName));

/* Non-admin actor ka tag — franchise customer ko plain customer na dikhaye. */
const actorTag = (item: AppNotification) => {
  if (/franchise[-_ ]?customer/i.test(item.actorRole)) {
    return { label: "Franchise customer", className: "bg-amber-50 text-amber-700" };
  }
  if (/customer/i.test(item.actorRole)) {
    return { label: "Customer", className: "bg-emerald-50 text-emerald-700" };
  }
  return { label: "Franchise", className: "bg-violet-50 text-violet-700" };
};

/* Scope detection notificationMeta me hai; page sirf usi ko colour/chip deta hai. */

const SCOPE_META: Record<
  NotificationScope,
  { label: string; row: string; accent: string; chip: string; dot: string; active: string }
> = {
  franchise: {
    label: "Franchise",
    row: "bg-violet-50/40 hover:bg-violet-50/70",
    accent: "border-l-violet-400",
    chip: "border-violet-200 bg-violet-50 text-violet-700",
    dot: "bg-violet-500",
    active: "border-violet-400 bg-violet-50 text-violet-700",
  },
  franchise_customer: {
    label: "Franchise customer",
    row: "bg-amber-50/40 hover:bg-amber-50/70",
    accent: "border-l-amber-400",
    chip: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
    active: "border-amber-400 bg-amber-50 text-amber-700",
  },
  customer: {
    label: "Customer",
    row: "bg-emerald-50/40 hover:bg-emerald-50/70",
    accent: "border-l-emerald-400",
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
    active: "border-emerald-400 bg-emerald-50 text-emerald-700",
  },
  loan: {
    label: "Loan",
    row: "bg-white hover:bg-slate-50",
    accent: "border-l-sky-300",
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    dot: "bg-sky-400",
    active: "border-sky-400 bg-sky-50 text-sky-700",
  },
};

/* Filter ki order — feed me sabse zyada loan rows hoti hain, franchise sabse kam. */
const SCOPE_ORDER: NotificationScope[] = ["loan", "customer", "franchise_customer", "franchise"];

const NotificationsPage = () => {
  const { role, isSuperAdmin, canAccessModule, accessibleLoanTypes } = useAuth();
  /*
  Module scope: franchise module na ho to franchise rows/chips nahi, aur
  customers module na ho to direct-customer rows/chips nahi. Isse franchise-
  only normal admin ko sirf franchise details dikhti hain.
  */
  const canSeeFranchises = isSuperAdmin || canAccessModule("franchises");
  const canSeeCustomers = isSuperAdmin || canAccessModule("customers");
  /* Loan rows sirf tab jab koi product assigned ho (franchise-only admin ke paas nahi hota). */
  const canSeeLoans = isSuperAdmin || accessibleLoanTypes.length > 0;
  const navigate = useNavigate();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState("all");
  const [roleFilter, setRoleFilter] = useState<ActorLevel | "all">("all");
  /* Record type filter — loan / customer / franchise customer / franchise mix na ho. */
  const [scopeFilter, setScopeFilter] = useState<NotificationScope | "all">("all");
  /* Ek admin chun kar sirf uske kiye updates dekhna. */
  const [actorFilter, setActorFilter] = useState("all");
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

  /* Module scope — feed me aane wali franchise rows ko yahin hata dete hain. */
  const scopedItems = useMemo(
    () =>
      items.filter(
        (item) =>
          (canSeeFranchises || !isFranchiseScoped(item)) &&
          (canSeeCustomers || !isCustomerScoped(item)) &&
          (canSeeLoans || !isLoanScoped(item))
      ),
    [items, canSeeFranchises, canSeeCustomers, canSeeLoans]
  );

  const tabs = TABS_BY_ROLE[role] ?? TABS_BY_ROLE.admin;
  const activeTab = tabs.find((entry) => entry.key === tab) ?? tabs[0];

  const tabItems = useMemo(() => scopedItems.filter(activeTab.match), [scopedItems, activeTab]);

  const tabCounts = useMemo(
    () => tabs.map((entry) => scopedItems.filter(entry.match).length),
    [tabs, scopedItems]
  );

  /* Type chips bhi sirf allowed scopes ke — franchise-only chips chhup jaati hain. */
  const scopeOrder = useMemo(
    () =>
      SCOPE_ORDER.filter(
        (scope) =>
          (canSeeFranchises || (scope !== "franchise" && scope !== "franchise_customer")) &&
          (canSeeCustomers || scope !== "customer") &&
          (canSeeLoans || scope !== "loan")
      ),
    [canSeeFranchises, canSeeCustomers, canSeeLoans]
  );

  /* Kis level se kitni notifications — active tab ke andar. */
  const roleCounts = useMemo(() => {
    const base: Record<ActorLevel, number> = { super_admin: 0, sub_admin: 0, admin: 0 };
    tabItems.forEach((entry) => {
      if (!entry.actorRole) return;
      base[actorLevel(entry.actorRole)] += 1;
    });
    return base;
  }, [tabItems]);

  /* Har scope me kitni rows — chips par count dikhta hai. */
  const scopeCounts = useMemo(() => {
    const base: Record<NotificationScope, number> = {
      loan: 0,
      customer: 0,
      franchise_customer: 0,
      franchise: 0,
    };
    tabItems.forEach((item) => {
      base[notificationScope(item)] += 1;
    });
    return base;
  }, [tabItems]);

  /*
  Dropdown sirf admin accounts dikhata hai (super / sub / normal admin).
  Franchise aur customer actors (`actorRole` admin nahi) option list me nahi
  aate, warna dropdown me franchise naam ("Ek Tha Tiger") bhi ghus jaate hain.
  */
  const actorOptions = useMemo(() => {
    const counts = new Map<string, { count: number; role: ActorLevel }>();
    tabItems.forEach((item) => {
      if (!isAdminActor(item)) return;
      const name = item.actorName.trim();
      if (!name) return;
      const existing = counts.get(name);
      if (existing) existing.count += 1;
      else counts.set(name, { count: 1, role: actorLevel(item.actorRole) });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .map(([name, { count, role }]) => ({
        value: name,
        label: `${adminLabel(name)} · ${ACTOR_LEVEL_LABEL[role]} (${count})`,
      }));
  }, [tabItems]);

  /* "All admins" ka count — rows nahi, sirf admin actors. */
  const adminActorTotal = useMemo(
    () => tabItems.filter((item) => isAdminActor(item) && item.actorName.trim()).length,
    [tabItems]
  );

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      tabItems.filter((item) => {
        if (actorFilter !== "all" && item.actorName.trim() !== actorFilter) return false;
        if (scopeFilter !== "all" && notificationScope(item) !== scopeFilter) return false;
        if (roleFilter !== "all" && actorLevel(item.actorRole) !== roleFilter) return false;
        if (!needle) return true;
        return [item.title, item.message, item.actorName, item.recordLabel, item.productLabel]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      }),
    [tabItems, actorFilter, scopeFilter, roleFilter, needle]
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
        : "No updates yet. Status changes and notes from other admins show up here.";

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
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            View
          </span>
          <FilterSelect
            compact
            label="Notification view"
            value={activeTab.key}
            onChange={(value) => {
              setTab(value);
              setRoleFilter("all");
              setScopeFilter("all");
              setActorFilter("all");
            }}
            options={tabs.map((entry, index) => ({
              value: entry.key,
              label: `${entry.label} (${tabCounts[index]})`,
            }))}
          />
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

          {(roleFilter !== "all" || scopeFilter !== "all" || actorFilter !== "all" || query) && (
            <button
              type="button"
              onClick={() => {
                setRoleFilter("all");
                setScopeFilter("all");
                setActorFilter("all");
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

      {/* Record type filter — loan / customer / franchise customer / franchise rows alag */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Type
        </span>
        <button
          type="button"
          onClick={() => setScopeFilter("all")}
          aria-pressed={scopeFilter === "all"}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
            scopeFilter === "all"
              ? "border-[rgb(6,106,156)] bg-[rgba(6,106,156,0.08)] text-[rgb(6,106,156)]"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          All
          <span className="tabular-nums opacity-70">{tabItems.length}</span>
        </button>
        {scopeOrder.map((scope) => {
          const meta = SCOPE_META[scope];
          const active = scopeFilter === scope;
          return (
            <button
              key={scope}
              type="button"
              onClick={() => setScopeFilter(active ? "all" : scope)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                active
                  ? meta.active
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden />
              {meta.label}
              <span className={`tabular-nums ${active ? "opacity-70" : "text-slate-400"}`}>
                {scopeCounts[scope]}
              </span>
            </button>
          );
        })}

        {/* Kaun sa admin — "kis ne kya kiya" ek admin par filter */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Admin
          </span>
          <FilterSelect
            compact
            label="Filter notifications by admin"
            value={actorFilter}
            onChange={setActorFilter}
            disabled={actorOptions.length === 0}
            title={actorFilter === "all" ? undefined : actorFilter}
            options={[
              { value: "all", label: `All admins (${adminActorTotal})` },
              ...actorOptions,
            ]}
            className="w-auto max-w-full"
          />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {activeTab.label}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {canSeeFranchises && (
              <>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${SCOPE_META.franchise.dot}`} aria-hidden />
                  Franchise
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${SCOPE_META.franchise_customer.dot}`}
                    aria-hidden
                  />
                  Franchise customer
                </span>
              </>
            )}
            {canSeeCustomers && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${SCOPE_META.customer.dot}`} aria-hidden />
                Customer
              </span>
            )}
            {canSeeLoans && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${SCOPE_META.loan.dot}`} aria-hidden />
                Loan
              </span>
            )}
            <p className="text-[11px] tabular-nums text-slate-400">
              Showing {visible.length} of {tabItems.length}
            </p>
          </div>
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
              {needle || roleFilter !== "all" || scopeFilter !== "all" || actorFilter !== "all"
                ? "No notification matches this filter. Clear it to see everything."
                : emptyCopy}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <th className="w-[168px] px-4 py-3">Record type</th>
                  <th className="px-4 py-3">Notification</th>
                  <th className="w-[92px] px-4 py-3">Priority</th>
                  <th className="w-[200px] px-4 py-3">Actor</th>
                  <th className="w-[180px] px-4 py-3">Reference</th>
                  <th className="w-[140px] px-4 py-3">Status</th>
                  <th className="w-[172px] px-4 py-3">Date</th>
                  <th className="w-[152px] px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((item) => {
                  const meta = KIND_META[item.kind];
                  const Icon = meta.icon;
                  const isUnread = item.read !== true;
                  const actor = actorLevel(item.actorRole);
                  const scope = SCOPE_META[notificationScope(item)];
                  return (
                    <tr
                      key={item.id}
                      onClick={() => openItem(item)}
                      title={item.targetPath ? item.targetLabel : undefined}
                      className={`group cursor-pointer align-top transition ${scope.row}`}
                    >
                      <td className={`border-l-4 px-4 py-3 ${scope.accent}`}>
                        <div className="flex flex-col items-start gap-1">
                          {/* Pehle record ka scope — customer hai ya franchise, turant dikhe. */}
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${scope.chip}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${scope.dot}`} aria-hidden />
                            {scope.label}
                          </span>
                          {/* Uske baad notification ka nature — note, decision, verification etc. */}
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${KIND_BADGE[item.kind]}`}
                          >
                            <Icon size={10} />
                            {typeLabel(item)}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5">
                          {isUnread && (
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                              aria-label="Unread"
                            />
                          )}
                          <div className="min-w-0">
                            <p
                              className={`truncate font-semibold group-hover:text-[rgb(6,106,156)] group-hover:underline ${
                                isUnread ? "text-slate-800" : "text-slate-600"
                              }`}
                              title={item.title}
                            >
                              {item.title}
                            </p>
                            {item.message ? (
                              <p
                                className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500"
                                title={item.message}
                              >
                                {item.message}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-xs text-slate-300">—</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {item.priority === "high" ? (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                            High
                          </span>
                        ) : (
                          <span className="text-xs capitalize text-slate-400">
                            {item.priority}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <p className="truncate text-xs font-semibold text-slate-700" title={item.actorName}>
                          {isAdminActor(item) ? adminLabel(item.actorName) : item.actorName}
                        </p>
                        {isAdminActor(item) ? (
                          <span
                            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${ROLE_CHIP[actor]}`}
                          >
                            {ACTOR_LEVEL_LABEL[actor]}
                          </span>
                        ) : (
                          <span
                            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${actorTag(item).className}`}
                          >
                            {actorTag(item).label}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {item.recordLabel ? (
                          <span
                            className={`inline-block max-w-full truncate rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${scope.chip}`}
                            title={item.recordLabel}
                          >
                            {item.recordLabel}
                          </span>
                        ) : (
                          <p className="text-xs text-slate-400">—</p>
                        )}
                        {item.productLabel && item.productLabel !== item.recordLabel && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-400" title={item.productLabel}>
                            {item.productLabel}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isUnread
                                ? "bg-sky-50 text-sky-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isUnread ? "bg-sky-500" : "bg-slate-300"
                              }`}
                              aria-hidden
                            />
                            {isUnread ? "Unread" : "Read"}
                          </span>
                          {item.activityType &&
                            (item.viewed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                <Eye size={10} /> Viewed
                                {item.viewedAt && ` · ${timeAgo(item.viewedAt)}`}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                <EyeOff size={10} /> Not viewed
                              </span>
                            ))}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p
                          className="text-xs font-medium text-slate-600"
                          title={formatDateTime(item.createdAt)}
                        >
                          {timeAgo(item.createdAt)}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-[10px] leading-tight text-slate-400">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {item.targetPath ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openItem(item);
                            }}
                            className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-[rgb(6,106,156)] hover:underline"
                          >
                            {item.targetLabel}
                            <ArrowUpRight size={11} />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminLayout>
  );
};

export default NotificationsPage;
