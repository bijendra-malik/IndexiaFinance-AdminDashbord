import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getAdminActivity,
  type AdminActivityResult,
  type AdminActivityUpdate,
} from "../../api/adminActivity";
import { getApiErrorMessage } from "../../utils/apiError";
import { updateTagLabel } from "../../api/adminUpdates";
import {
  adminLabel,
  avatarGradient,
  formatDateTime,
  initialsOf,
  roleLabel,
} from "../../utils/auditFormat";

/*
==========================================
Admin Updates (super admin)

"Kis admin ne kis record par kya update kiya" — ek hi timeline me. Feed backend
ke /activity endpoint se aati hai, jo saare loan products + customers +
franchises ke `adminUpdates` trail ko jodta hai.

Layout:
  hero      -> gradient header (title, scope, refresh, live counters)
  KPI strip -> volume, admins, recommendations, decisions
  toolbar   -> search, admin, product, time window
  main      -> day-wise timeline  +  admins / products / 7-day rhythm
==========================================
*/

const BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";

const WINDOWS = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
  { days: 0, label: "All" },
];

const dayKey = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "unknown" : date.toDateString();
};

const dayLabel = (key: string) => {
  if (key === "unknown") return "Earlier";
  const date = new Date(key);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

/* Customer/franchise apne record par jaate hain, loans application par. */
const targetFor = (update: AdminActivityUpdate) => {
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
  return {
    path: `/applications/${update.slug}/${update.applicationId}`,
    label: "Open application",
  };
};

const statusClass = (status: string) => {
  switch (status) {
    case "Approved":
    case "Active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/70";
    case "Rejected":
      return "bg-rose-50 text-rose-600 ring-rose-200/70";
    case "Pending":
      return "bg-amber-50 text-amber-700 ring-amber-200/70";
    case "Inactive":
      return "bg-slate-100 text-slate-600 ring-slate-200";
    default:
      return "bg-sky-50 text-sky-700 ring-sky-200/70";
  }
};

const KIND_META = {
  note: {
    icon: MessageSquare,
    label: "Note",
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    accent: "border-l-slate-300",
    dot: "bg-slate-400",
  },
  recommendation: {
    icon: Clock3,
    label: "Recommendation",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    accent: "border-l-amber-400",
    dot: "bg-amber-500",
  },
  status: {
    icon: CheckCircle2,
    label: "Decision",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    accent: "border-l-emerald-400",
    dot: "bg-emerald-500",
  },
} as const;

const kindMeta = (kind: AdminActivityUpdate["kind"]) => KIND_META[kind] ?? KIND_META.note;

const entityLabel = (update: AdminActivityUpdate) => {
  if (update.entity === "customer") return "Customer";
  if (update.entity === "franchise") return "Franchise";
  return update.label;
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tile,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string | number;
  hint: string;
  tile: string;
  accent: string;
}) => (
  <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} aria-hidden />
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tile}`}>
        <Icon size={15} />
      </span>
    </div>
    <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-800">{value}</p>
    <p className="mt-2 text-[11px] leading-snug text-slate-400">{hint}</p>
  </div>
);

const RailRow = ({
  active,
  rank,
  label,
  badge,
  count,
  max,
  avatar,
  onClick,
}: {
  active: boolean;
  rank: number;
  label: string;
  badge?: string;
  count: number;
  max: number;
  avatar: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`group w-full rounded-xl px-2 py-2 text-left transition ${
      active ? "bg-[rgba(6,106,156,0.07)] ring-1 ring-[rgba(6,106,156,0.18)]" : "hover:bg-slate-50"
    }`}
  >
    <span className="flex items-center gap-2">
      <span className="relative shrink-0">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: avatar }}
          aria-hidden
        >
          {initialsOf(label)}
        </span>
        {rank <= 3 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-[8px] font-bold text-slate-500 shadow ring-1 ring-slate-100">
            {rank}
          </span>
        )}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-xs font-medium ${
          active ? "text-[rgb(6,106,156)]" : "text-slate-600"
        }`}
        title={label}
      >
        {label}
      </span>
      {badge && (
        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
          {badge}
        </span>
      )}
      <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500">{count}</span>
    </span>
    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-100">
      <span
        className="block h-full rounded-full transition-all"
        style={{
          width: `${max > 0 ? Math.max(4, (count / max) * 100) : 0}%`,
          background: active ? BRAND_GRADIENT : "rgb(203, 213, 225)",
        }}
      />
    </span>
  </button>
);

const AdminUpdates = () => {
  const [result, setResult] = useState<AdminActivityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [adminId, setAdminId] = useState("");
  const [product, setProduct] = useState("");
  const [days, setDays] = useState(30);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");

  /* Fetch effect me; setState sirf async callbacks me (no render-phase sync). */
  useEffect(() => {
    const controller = new AbortController();

    getAdminActivity({
      adminId: adminId || undefined,
      product: product || undefined,
      days,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult(data);
        setError("");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(getApiErrorMessage(err, "Could not load admin activity."));
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => controller.abort();
  }, [adminId, product, days, reloadKey]);

  const refresh = () => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  };

  const admins = useMemo(
    () => (result?.admins ?? []).filter((admin) => admin.total > 0),
    [result]
  );
  /* Zero-activity products leaderboard me noise hain — sirf jinme kaam hua. */
  const products = useMemo(
    () =>
      [...(result?.products ?? [])]
        .filter((entry) => entry.total > 0)
        .sort((left, right) => right.total - left.total),
    [result]
  );
  const updates = useMemo(() => result?.updates ?? [], [result]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return updates;
    return updates.filter((update) =>
      [update.adminName, update.customerName, update.applicationNo, update.text, update.label]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [updates, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminActivityUpdate[]>();
    visible.forEach((update) => {
      const key = dayKey(update.addedAt);
      const bucket = map.get(key);
      if (bucket) bucket.push(update);
      else map.set(key, [update]);
    });
    return [...map.entries()];
  }, [visible]);

  /* Sidebar ka chhota rhythm chart — loaded rows se, last 7 din. */
  const rhythm = useMemo(() => {
    const buckets = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toDateString(),
        label: date.toLocaleDateString("en-IN", { weekday: "narrow" }),
        count: 0,
      };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    updates.forEach((update) => {
      const bucket = byKey.get(dayKey(update.addedAt));
      if (bucket) bucket.count += 1;
    });
    return buckets;
  }, [updates]);

  const decisions = updates.filter((update) => update.kind === "status").length;
  const recommendations = updates.filter((update) => update.kind === "recommendation").length;
  const windowLabel = WINDOWS.find((option) => option.days === days)?.label ?? `${days}D`;

  const selectedAdmin = admins.find((admin) => admin.id === adminId);
  const selectedProduct = products.find((entry) => entry.key === product);
  const hasFilters = Boolean(adminId || product || search.trim());
  const maxAdmin = admins.reduce((max, admin) => Math.max(max, admin.total), 0);
  const maxProduct = products.reduce((max, entry) => Math.max(max, entry.total), 0);
  const maxRhythm = rhythm.reduce((max, bucket) => Math.max(max, bucket.count), 0);

  const clearFilters = () => {
    setAdminId("");
    setProduct("");
    setSearch("");
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1440px] space-y-4">
        {/* Hero */}
        <section
          className="relative overflow-hidden rounded-2xl p-5 text-white shadow-sm"
          style={{ background: BRAND_GRADIENT }}
        >
          <span className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full bg-white/10" aria-hidden />
          <span className="pointer-events-none absolute -bottom-24 right-28 h-56 w-56 rounded-full bg-white/5" aria-hidden />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur">
                <ShieldCheck size={11} /> Super admin view
              </span>
              <h1 className="mt-2 text-2xl font-bold leading-tight">Admin Updates</h1>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/80">
                Har admin ka kaam ek timeline me — notes, status recommendations aur
                final decisions, saath me kis record par kya hua.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold backdrop-blur">
                  {result?.total ?? 0} updates · {windowLabel === "All" ? "all time" : `last ${windowLabel}`}
                </span>
                <span className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold backdrop-blur">
                  {admins.length} admins active
                </span>
                <span className="rounded-lg bg-white/10 px-2.5 py-1 text-white/85 backdrop-blur">
                  {result?.lastActivityAt
                    ? `Last: ${formatDateTime(result.lastActivityAt)}`
                    : "No activity yet"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25 disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </section>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={Activity}
            label="Total updates"
            value={result?.total ?? 0}
            hint={`Activity in the selected ${windowLabel === "All" ? "all-time" : windowLabel} window`}
            tile="bg-sky-50 text-sky-600"
            accent="from-sky-400 to-cyan-300"
          />
          <StatCard
            icon={Users}
            label="Active admins"
            value={admins.length}
            hint="At least one update in this window"
            tile="bg-indigo-50 text-indigo-600"
            accent="from-indigo-400 to-violet-300"
          />
          <StatCard
            icon={Clock3}
            label="Recommendations"
            value={recommendations}
            hint="Waiting for a super admin decision"
            tile="bg-amber-50 text-amber-600"
            accent="from-amber-400 to-orange-300"
          />
          <StatCard
            icon={CheckCircle2}
            label="Decisions"
            value={decisions}
            hint="Final calls logged in the loaded view"
            tile="bg-emerald-50 text-emerald-600"
            accent="from-emerald-400 to-teal-300"
          />
        </div>

        {/* Toolbar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search admin, customer, message…"
                aria-label="Search updates"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-8 text-xs text-slate-700 outline-none transition focus:border-[rgb(6,106,156)] focus:ring-2 focus:ring-[rgba(6,106,156,0.12)]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Global form CSS selects ko 100% width deta hai — wrapper se size lock. */}
            <span className="w-[calc(50%-0.25rem)] shrink-0 sm:w-[10.5rem]">
              <select
                value={adminId}
                onChange={(event) => setAdminId(event.target.value)}
                aria-label="Filter by admin"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 outline-none transition focus:border-[rgb(6,106,156)] focus:ring-2 focus:ring-[rgba(6,106,156,0.12)]"
              >
                <option value="">All admins</option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {adminLabel(admin.name)} · {admin.total}
                  </option>
                ))}
              </select>
            </span>

            <span className="w-[calc(50%-0.25rem)] shrink-0 sm:w-[11.5rem]">
              <select
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                aria-label="Filter by product"
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600 outline-none transition focus:border-[rgb(6,106,156)] focus:ring-2 focus:ring-[rgba(6,106,156,0.12)]"
              >
                <option value="">All products</option>
                {products.map((entry) => (
                  <option key={entry.key} value={entry.key}>
                    {entry.label} · {entry.total}
                  </option>
                ))}
              </select>
            </span>

            <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {WINDOWS.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  onClick={() => setDays(option.days)}
                  aria-pressed={days === option.days}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    days === option.days
                      ? "text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  style={days === option.days ? { background: BRAND_GRADIENT } : undefined}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
            <SlidersHorizontal size={12} />
            <span>
              {visible.length} of {updates.length} loaded updates
              {(result?.total ?? 0) > updates.length
                ? ` · newest ${updates.length} of ${result?.total}`
                : ""}
            </span>
            {selectedAdmin && (
              <span className="rounded-full bg-[rgba(6,106,156,0.08)] px-2 py-0.5 font-semibold text-[rgb(6,106,156)]">
                {adminLabel(selectedAdmin.name)}
              </span>
            )}
            {selectedProduct && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                {selectedProduct.label}
              </span>
            )}
            <span className="ml-auto">
              {result?.lastActivityAt
                ? `Last update ${formatDateTime(result.lastActivityAt)}`
                : "No updates recorded yet"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          {/* Timeline */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(6,106,156,0.08)] text-[rgb(6,106,156)]">
                  <Activity size={14} />
                </span>
                <h2 className="text-sm font-semibold text-slate-700">Timeline</h2>
              </div>
              {refreshing && <Loader2 size={13} className="animate-spin text-slate-400" />}
            </header>

            {error ? (
              <div className="px-4 py-12 text-center" role="alert">
                <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                  <X size={18} />
                </span>
                <p className="text-sm text-rose-600">{error}</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-2 text-xs font-semibold text-[rgb(6,106,156)] hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Loading admin updates…
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                  <MessageSquare size={22} />
                </span>
                <p className="text-sm font-semibold text-slate-600">
                  {hasFilters ? "No updates match these filters" : "No updates in this window"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {hasFilters
                    ? "Search clear karo ya doosra admin/product chuno."
                    : "Regular admin ka note ya recommendation aate hi yahan dikhega."}
                </p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4 p-3">
                {grouped.map(([key, rows]) => (
                  <div key={key}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {dayLabel(key)}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {rows.length} update{rows.length === 1 ? "" : "s"}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-r from-slate-100 to-transparent" aria-hidden />
                    </div>

                    <ol className="space-y-2">
                      {rows.map((update) => {
                        const kind = kindMeta(update.kind);
                        const KindIcon = kind.icon;
                        const target = targetFor(update);
                        const name = adminLabel(update.adminName);
                        return (
                          <li
                            key={update.id}
                            className={`flex gap-3 rounded-xl border border-slate-100 border-l-[3px] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md ${kind.accent}`}
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm ring-2 ring-white"
                              style={{ background: avatarGradient(update.adminName) }}
                              aria-hidden
                            >
                              {initialsOf(update.adminName)}
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                                <span className="text-sm font-semibold text-slate-800">{name}</span>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                    update.adminRole === "SuperAdmin"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-slate-100 text-slate-500"
                                  }`}
                                >
                                  {roleLabel(update.adminRole) || "Admin"}
                                </span>
                                <span className="text-[11px] text-slate-400">on</span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {entityLabel(update)}
                                </span>
                                {update.customerName && (
                                  <span className="min-w-0 truncate text-xs font-medium text-slate-700">
                                    {update.customerName}
                                  </span>
                                )}
                                {update.applicationNo && (
                                  <span className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                                    {update.applicationNo}
                                  </span>
                                )}
                              </div>

                              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                                {update.text || `${kind.label} added`}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ${kind.chip}`}
                                >
                                  <KindIcon size={11} /> {kind.label}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${statusClass(update.loanStatus)}`}
                                >
                                  {update.loanStatus}
                                </span>
                                {update.suggestedStatus && (
                                  <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                                    Suggested: {update.suggestedStatus}
                                  </span>
                                )}
                                {typeof update.loanAmount === "number" && update.loanAmount > 0 && (
                                  <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-600 ring-1 ring-slate-200">
                                    ₹{update.loanAmount.toLocaleString("en-IN")}
                                  </span>
                                )}
                                {update.tag && update.tag !== "general" && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                    {updateTagLabel(update.tag)}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1 tabular-nums text-slate-400 xl:hidden">
                                  <Clock3 size={11} /> {formatDateTime(update.addedAt)}
                                </span>
                              </div>
                            </div>

                            <div className="hidden shrink-0 flex-col items-end gap-1.5 xl:flex">
                              <span className="tabular-nums text-[11px] text-slate-400">
                                {formatDateTime(update.addedAt)}
                              </span>
                              {update.applicationId && (
                                <Link
                                  to={target.path}
                                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
                                >
                                  {target.label.replace("Open ", "")}
                                  <ArrowUpRight size={11} />
                                </Link>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="space-y-4">
            <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  7-day rhythm
                </h2>
                <span className="text-[10px] font-semibold text-slate-400">{updates.length} loaded</span>
              </div>
              <div className="flex h-20 items-end gap-1.5 px-1">
                {rhythm.map((bucket) => (
                  <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span
                      className="w-full rounded-t-md transition-all"
                      style={{
                        height: `${maxRhythm > 0 ? Math.max(4, (bucket.count / maxRhythm) * 56) : 4}px`,
                        background: bucket.count > 0 ? BRAND_GRADIENT : "rgb(226, 232, 240)",
                      }}
                      title={`${bucket.count} update${bucket.count === 1 ? "" : "s"}`}
                    />
                    <span className="text-[9px] font-semibold uppercase text-slate-400">
                      {bucket.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Admins
                </h2>
                <Users size={13} className="text-slate-300" />
              </div>
              {admins.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">No activity yet</p>
              ) : (
                <div className="space-y-0.5">
                  {admins.map((admin, index) => (
                    <RailRow
                      key={admin.id}
                      rank={index + 1}
                      active={adminId === admin.id}
                      label={adminLabel(admin.name)}
                      badge={admin.role === "SuperAdmin" ? "Super" : undefined}
                      count={admin.total}
                      max={maxAdmin}
                      avatar={avatarGradient(admin.name)}
                      onClick={() => setAdminId(adminId === admin.id ? "" : admin.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Products &amp; accounts
                </h2>
                <SlidersHorizontal size={13} className="text-slate-300" />
              </div>
              <div className="max-h-80 space-y-0.5 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-400">No data</p>
                ) : (
                  products.map((entry, index) => (
                    <RailRow
                      key={entry.key}
                      rank={index + 1}
                      active={product === entry.key}
                      label={entry.label}
                      count={entry.total}
                      max={maxProduct}
                      avatar="linear-gradient(135deg,#0f172a,#64748b)"
                      onClick={() => setProduct(product === entry.key ? "" : entry.key)}
                    />
                  ))
                )}
              </div>
            </section>

            <p className="flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              Ye organisation-wide view sirf super admin ko dikhta hai.
            </p>
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminUpdates;
