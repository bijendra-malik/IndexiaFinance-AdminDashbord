import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Building2, Clock3, RefreshCw, Search, X,
  CheckCircle2, XCircle, AlertCircle, Users, ChevronRight,
  Mail, Phone, MapPin,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import Pagination from "../../components/common/Pagination";
import FilterSelect from "../../components/common/FilterSelect";
import StatusPill from "./components/StatusPill";
import { getApiErrorMessage, getFranchises, type Franchise } from "../../api/franchises";
import {
  BRAND_GRADIENT,
  STATUS_FILTER_OPTIONS,
  contactName,
  displayName,
  formatDate,
  initialsOf,
  locationOf,
} from "./franchiseUtils";

const PAGE_SIZE = 20;

interface ListState {
  key: string;
  franchises: Franchise[];
  total: number;
  totalPages: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  error: string;
}

const buildKey = (status: string, search: string, page: number, refreshKey: number) =>
  `${status}|${search}|${page}|${refreshKey}`;

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({
  label,
  value,
  icon: Icon,
  iconClass,
  bgClass,
  textClass,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  bgClass: string;
  textClass: string;
  active?: boolean;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition w-full ${
      active
        ? "border-sky-300 bg-sky-50 shadow-sky-100/60 ring-2 ring-sky-200"
        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
    }`}
  >
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgClass}`}
    >
      <Icon size={19} className={iconClass} />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-extrabold leading-none text-slate-900">{value}</p>
      <p className={`mt-1 text-xs font-semibold ${textClass}`}>{label}</p>
    </div>
  </button>
);

const FranchiseList = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<ListState | null>(null);
  // For stat cards: track counts across ALL statuses
  const [allCounts, setAllCounts] = useState<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = buildKey(status, appliedSearch, page, refreshKey);
    getFranchises({
      status: status === "All" ? undefined : status,
      search: appliedSearch || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        // Compute status counts from the current page result for badges
        const pendingCount = result.franchises.filter(
          (f) => (f.status ?? "").toLowerCase() === "pending"
        ).length;
        const approvedCount = result.franchises.filter(
          (f) => (f.status ?? "").toLowerCase() === "approved"
        ).length;
        const rejectedCount = result.franchises.filter(
          (f) => (f.status ?? "").toLowerCase() === "rejected"
        ).length;
        setState({
          key,
          franchises: result.franchises,
          total: result.total,
          totalPages: Math.max(1, result.totalPages),
          pendingCount,
          approvedCount,
          rejectedCount,
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          key,
          franchises: [],
          total: 0,
          totalPages: 1,
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          error: getApiErrorMessage(error, "Unable to load franchise applications."),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [status, appliedSearch, page, refreshKey]);

  // Load all-status summary counts once on mount (no filter)
  useEffect(() => {
    let cancelled = false;
    getFranchises({ page: 1, limit: 1 })
      .then((result) => {
        if (cancelled) return;
        // We just need total; for status breakdown, fetch each status with limit=1
        const total = result.total;
        Promise.allSettled([
          getFranchises({ status: "Pending", page: 1, limit: 1 }),
          getFranchises({ status: "Approved", page: 1, limit: 1 }),
          getFranchises({ status: "Rejected", page: 1, limit: 1 }),
        ]).then(([p, a, r]) => {
          if (cancelled) return;
          setAllCounts({
            total,
            pending: p.status === "fulfilled" ? p.value.total : 0,
            approved: a.status === "fulfilled" ? a.value.total : 0,
            rejected: r.status === "fulfilled" ? r.value.total : 0,
          });
        });
      })
      .catch(() => {/* silent — stat cards are informational */});
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const active = state?.key === buildKey(status, appliedSearch, page, refreshKey) ? state : null;
  const franchises = active?.franchises ?? [];
  const total = active?.total ?? 0;
  const totalPages = active?.totalPages ?? 1;
  const error = active?.error ?? "";
  const loading = active === null;

  const hasFilters = appliedSearch !== "" || status !== "All";

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const clearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatus("All");
    setPage(1);
  };

  return (
    <AdminLayout>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
            style={{ background: BRAND_GRADIENT }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Franchises</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Review franchise registrations and approve or reject their applications.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Franchises"
          value={allCounts?.total ?? "—"}
          icon={Building2}
          iconClass="text-sky-600"
          bgClass="bg-sky-50"
          textClass="text-sky-700"
          active={status === "All"}
          onClick={() => { setStatus("All"); setPage(1); }}
        />
        <StatCard
          label="Pending Review"
          value={allCounts?.pending ?? "—"}
          icon={Clock3}
          iconClass="text-amber-600"
          bgClass="bg-amber-50"
          textClass="text-amber-700"
          active={status === "Pending"}
          onClick={() => { setStatus("Pending"); setPage(1); }}
        />
        <StatCard
          label="Approved"
          value={allCounts?.approved ?? "—"}
          icon={CheckCircle2}
          iconClass="text-emerald-600"
          bgClass="bg-emerald-50"
          textClass="text-emerald-700"
          active={status === "Approved"}
          onClick={() => { setStatus("Approved"); setPage(1); }}
        />
        <StatCard
          label="Rejected"
          value={allCounts?.rejected ?? "—"}
          icon={XCircle}
          iconClass="text-red-600"
          bgClass="bg-red-50"
          textClass="text-red-700"
          active={status === "Rejected"}
          onClick={() => { setStatus("Rejected"); setPage(1); }}
        />
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3.5">
          <form
            onSubmit={submitSearch}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search franchises</span>
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, city or login ID…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearch("");
                    setAppliedSearch("");
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect
                label="Filter franchises by status"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                options={STATUS_FILTER_OPTIONS}
                className="w-44"
              />
              <button
                type="submit"
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                style={{ background: BRAND_GRADIENT }}
              >
                Search
              </button>
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  Clear
                </button>
              )}
            </div>

            {active && !error && (
              <p className="shrink-0 text-xs font-medium text-slate-500">
                <span className="font-bold text-slate-700">{total}</span> franchise
                {total !== 1 ? "s" : ""}
              </p>
            )}
          </form>
        </div>

        {/* ── Table / states ──────────────────────────────────────────────── */}
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
              <AlertCircle size={24} className="text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2.5 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-xl bg-slate-100"
                style={{ opacity: 1 - i * 0.12 }}
              />
            ))}
          </div>
        ) : franchises.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <Clock3 size={22} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">
              {hasFilters ? "No franchises match your filters" : "No franchise applications found"}
            </p>
            <p className="text-sm text-slate-500">
              {hasFilters
                ? "Try adjusting the search or status filter."
                : "Franchise registrations will appear here once received."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Franchise
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Login ID / PAN
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Contact
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Location
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Package
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Applied
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {franchises.map((item) => (
                    <tr key={item._id} className="group transition-colors hover:bg-sky-50/30">
                      {/* Franchise identity */}
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/franchises/${encodeURIComponent(item._id)}`}
                          className="flex items-center gap-3"
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white shadow-sm"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            {initialsOf(displayName(item))}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[13rem] truncate font-semibold text-slate-800 transition-colors group-hover:text-sky-700">
                              {displayName(item)}
                            </span>
                            <span className="block max-w-[13rem] truncate text-xs text-slate-400">
                              {contactName(item) || "—"}
                            </span>
                          </span>
                        </Link>
                      </td>

                      {/* Login ID / PAN */}
                      <td className="px-4 py-3.5">
                        <span className="block font-mono text-xs font-semibold text-slate-700">
                          {item.franchiseId || "—"}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {item.panNumber || "—"}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                            <Phone size={11} className="shrink-0 text-slate-400" />
                            {item.mobile || item.phone || "—"}
                          </span>
                          <span className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
                            <Mail size={11} className="shrink-0" />
                            {item.email || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <MapPin size={12} className="shrink-0 text-slate-400" />
                          <span className="max-w-[12rem] truncate">{locationOf(item) || "—"}</span>
                        </span>
                      </td>

                      {/* Package */}
                      <td className="px-4 py-3.5">
                        {item.package ? (
                          <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                            {item.package}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Applied date */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                        {formatDate(item.franchiseAppliedAt || item.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusPill status={item.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/franchises/${encodeURIComponent(item._id)}`}
                          aria-label={`View details for ${displayName(item)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                        >
                          View
                          <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPage={setPage}
              disabled={loading}
              itemLabel="franchises"
            />
          </>
        )}
      </div>

      {/* Pending queue call-to-action */}
      {allCounts && allCounts.pending > 0 && status !== "Pending" && (
        <div className="mt-2 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <Clock3 size={16} className="text-amber-700" />
            </div>
            <p className="text-sm font-semibold text-amber-800">
              {allCounts.pending} franchise application
              {allCounts.pending !== 1 ? "s" : ""} awaiting your review
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setStatus("Pending"); setPage(1); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Review now <ArrowUpRight size={13} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
};

export default FranchiseList;
