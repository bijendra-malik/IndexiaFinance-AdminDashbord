import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, Clock3, RefreshCw, Search, X } from "lucide-react";
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
  error: string;
}

/** Staleness key so a slow response for an old filter can't overwrite a newer one. */
const buildKey = (status: string, search: string, page: number, refreshKey: number) =>
  `${status}|${search}|${page}|${refreshKey}`;

const FranchiseList = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [refreshKey, setRefreshKey] = useState(0);
  const [state, setState] = useState<ListState | null>(null);

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
        setState({
          key,
          franchises: result.franchises,
          total: result.total,
          totalPages: Math.max(1, result.totalPages),
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
          error: getApiErrorMessage(error, "Unable to load franchise applications."),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [status, appliedSearch, page, refreshKey]);

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
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
            style={{ background: BRAND_GRADIENT }}
          >
            <Building2 size={19} />
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
          onClick={() => setRefreshKey((key) => key + 1)}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <form onSubmit={submitSearch} className="relative min-w-0 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, city or login ID…"
            aria-label="Search franchises"
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </form>

        <FilterSelect
          label="Filter franchises by status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={STATUS_FILTER_OPTIONS}
          className="sm:w-56"
        />

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : franchises.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Clock3 size={22} className="text-slate-300" />
            <p className="text-sm text-slate-500">
              {hasFilters ? "No franchises match your filters." : "No franchise applications found."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-1 text-xs font-semibold text-sky-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    <th className="px-5 py-3.5">Franchise</th>
                    <th className="px-4 py-3.5">Login ID / PAN</th>
                    <th className="px-4 py-3.5">Contact</th>
                    <th className="px-4 py-3.5">Location</th>
                    <th className="px-4 py-3.5">Package</th>
                    <th className="px-4 py-3.5">Applied</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {franchises.map((item) => (
                    <tr key={item._id} className="group transition hover:bg-sky-50/40">
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/franchises/${encodeURIComponent(item._id)}`}
                          className="flex items-center gap-3"
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            {initialsOf(displayName(item))}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[14rem] truncate font-semibold text-slate-800 group-hover:text-[rgb(6,106,156)] group-hover:underline">
                              {displayName(item)}
                            </span>
                            <span className="block max-w-[14rem] truncate text-xs text-slate-400">
                              {contactName(item) || "—"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block font-mono text-xs text-slate-600">
                          {item.franchiseId || "—"}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {item.panNumber || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <span className="block whitespace-nowrap">
                          {item.mobile || item.phone || "—"}
                        </span>
                        <span className="block max-w-[12rem] truncate text-xs text-slate-400">
                          {item.email || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        <span className="block max-w-[14rem] truncate">{locationOf(item) || "—"}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{item.package || "—"}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                        {formatDate(item.franchiseAppliedAt || item.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          to={`/franchises/${encodeURIComponent(item._id)}`}
                          aria-label={`View details for ${displayName(item)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                        >
                          View
                          <ArrowUpRight size={13} />
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
      </section>
    </AdminLayout>
  );
};

export default FranchiseList;
