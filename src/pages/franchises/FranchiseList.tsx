import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Building2, CheckCircle2, ChevronRight, Clock3, Mail, Phone, MapPin, XCircle } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import Pagination from "../../components/common/Pagination";
import FilterSelect from "../../components/common/FilterSelect";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import { TableCard, TableEmpty, TableError, TableSkeleton, Th } from "../../components/common/TableShell";
import StatusPill from "./components/StatusPill";
import { getApiErrorMessage, getFranchises, type Franchise } from "../../api/franchises";
import {
  BRAND_GRADIENT, STATUS_FILTER_OPTIONS,
  contactName, displayName, formatDate, initialsOf, locationOf,
} from "./franchiseUtils";
import SearchBar from "../../components/common/SearchBar";

const PAGE_SIZE = 20;

interface ListState {
  key: string; franchises: Franchise[]; total: number; totalPages: number; error: string;
}
interface AllCounts { total: number; pending: number; approved: number; rejected: number; }

const buildKey = (status: string, search: string, page: number, rk: number) =>
  `${status}|${search}|${page}|${rk}`;

const FranchiseList = () => {
  const [page, setPage]                   = useState(1);
  const [search, setSearch]               = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus]               = useState("All");
  const [refreshKey, setRefreshKey]       = useState(0);
  const [state, setState]                 = useState<ListState | null>(null);
  const [counts, setCounts]               = useState<AllCounts | null>(null);

  // Paginated list
  useEffect(() => {
    let cancelled = false;
    const key = buildKey(status, appliedSearch, page, refreshKey);
    getFranchises({ status: status === "All" ? undefined : status, search: appliedSearch || undefined, page, limit: PAGE_SIZE })
      .then((r) => { if (!cancelled) setState({ key, franchises: r.franchises, total: r.total, totalPages: Math.max(1, r.totalPages), error: "" }); })
      .catch((e: unknown) => { if (!cancelled) setState({ key, franchises: [], total: 0, totalPages: 1, error: getApiErrorMessage(e, "Unable to load franchise applications.") }); });
    return () => { cancelled = true; };
  }, [status, appliedSearch, page, refreshKey]);

  // Summary counts (status breakdown, once on mount / refresh)
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      getFranchises({ page: 1, limit: 1 }),
      getFranchises({ status: "Pending",  page: 1, limit: 1 }),
      getFranchises({ status: "Approved", page: 1, limit: 1 }),
      getFranchises({ status: "Rejected", page: 1, limit: 1 }),
    ]).then(([all, p, a, r]) => {
      if (cancelled) return;
      setCounts({
        total:    all.status === "fulfilled" ? all.value.total : 0,
        pending:  p.status   === "fulfilled" ? p.value.total   : 0,
        approved: a.status   === "fulfilled" ? a.value.total   : 0,
        rejected: r.status   === "fulfilled" ? r.value.total   : 0,
      });
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const active     = state?.key === buildKey(status, appliedSearch, page, refreshKey) ? state : null;
  const franchises = active?.franchises ?? [];
  const total      = active?.total ?? 0;
  const totalPages = active?.totalPages ?? 1;
  const error      = active?.error ?? "";
  const loading    = active === null;
  const hasFilters = appliedSearch !== "" || status !== "All";

  const clearFilters = () => { setSearch(""); setAppliedSearch(""); setStatus("All"); setPage(1); };

  return (
    <AdminLayout>
      <PageHeader
        icon={Building2} title="Franchises"
        subtitle="Review franchise registrations and approve or reject their applications."
        onRefresh={() => setRefreshKey((k) => k + 1)} refreshing={loading}
      />

      {/* Stat cards — clickable filter shortcuts */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="All Franchises"  value={counts?.total    ?? "—"} icon={Building2}    bgClass="bg-sky-50"     iconClass="text-sky-600"     labelClass="text-sky-700"     active={status === "All"}      onClick={() => { setStatus("All");      setPage(1); }} />
        <StatCard label="Pending Review"  value={counts?.pending  ?? "—"} icon={Clock3}       bgClass="bg-amber-50"   iconClass="text-amber-600"   labelClass="text-amber-700"   active={status === "Pending"}  onClick={() => { setStatus("Pending");  setPage(1); }} />
        <StatCard label="Approved"        value={counts?.approved ?? "—"} icon={CheckCircle2} bgClass="bg-emerald-50" iconClass="text-emerald-600" labelClass="text-emerald-700" active={status === "Approved"} onClick={() => { setStatus("Approved"); setPage(1); }} />
        <StatCard label="Rejected"        value={counts?.rejected ?? "—"} icon={XCircle}      bgClass="bg-red-50"     iconClass="text-red-600"     labelClass="text-red-700"     active={status === "Rejected"} onClick={() => { setStatus("Rejected"); setPage(1); }} />
      </div>

      {/* Table card */}
      <TableCard>
        <SearchBar
          value={search} onChange={setSearch}
          onSubmit={() => { setAppliedSearch(search.trim()); setPage(1); }}
          onClear={clearFilters} placeholder="Search by name, city or login ID…"
          showClear={hasFilters}
          summary={active && !error ? `<b class="text-slate-700">${total}</b> franchise${total !== 1 ? "s" : ""}` : undefined}
        >
          <FilterSelect
            label="Filter by status" value={status}
            onChange={(v) => { setStatus(v); setPage(1); }}
            options={STATUS_FILTER_OPTIONS} className="w-44"
          />
        </SearchBar>

        {error ? (
          <TableError message={error} onRetry={() => setRefreshKey((k) => k + 1)} />
        ) : loading ? (
          <TableSkeleton rows={6} height="h-[68px]" />
        ) : franchises.length === 0 ? (
          <TableEmpty
            icon={Clock3}
            title={hasFilters ? "No franchises match your filters" : "No franchise applications found"}
            description={hasFilters ? "Try adjusting the search or status filter." : "Franchise registrations will appear here once received."}
            action={hasFilters && (
              <button type="button" onClick={clearFilters}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                Clear filters
              </button>
            )}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    <Th>Franchise</Th><Th>Login ID / PAN</Th><Th>Contact</Th>
                    <Th>Location</Th><Th>Package</Th><Th>Applied</Th>
                    <Th>Status</Th><Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {franchises.map((item) => (
                    <tr key={item._id} className="group transition-colors hover:bg-sky-50/30">
                      {/* Identity */}
                      <td className="px-4 py-3.5">
                        <Link to={`/franchises/${encodeURIComponent(item._id)}`} className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white shadow-sm" style={{ background: BRAND_GRADIENT }}>
                            {initialsOf(displayName(item))}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[13rem] truncate font-semibold text-slate-800 transition-colors group-hover:text-sky-700">{displayName(item)}</span>
                            <span className="block max-w-[13rem] truncate text-xs text-slate-400">{contactName(item) || "—"}</span>
                          </span>
                        </Link>
                      </td>
                      {/* Login ID / PAN */}
                      <td className="px-4 py-3.5">
                        <span className="block font-mono text-xs font-semibold text-slate-700">{item.franchiseId || "—"}</span>
                        <span className="block font-mono text-[11px] text-slate-400">{item.panNumber || "—"}</span>
                      </td>
                      {/* Contact */}
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-slate-600"><Phone size={11} className="text-slate-400" />{item.mobile || item.phone || "—"}</span>
                        <span className="flex items-center gap-1.5 text-[11px] text-slate-400"><Mail size={11} />{item.email || "—"}</span>
                      </td>
                      {/* Location */}
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <MapPin size={11} className="shrink-0 text-slate-400" />
                          <span className="max-w-[11rem] truncate">{locationOf(item) || "—"}</span>
                        </span>
                      </td>
                      {/* Package */}
                      <td className="px-4 py-3.5">
                        {item.package ? (
                          <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">{item.package}</span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      {/* Applied */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">{formatDate(item.franchiseAppliedAt || item.createdAt)}</td>
                      {/* Status */}
                      <td className="px-4 py-3.5"><StatusPill status={item.status} /></td>
                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <Link to={`/franchises/${encodeURIComponent(item._id)}`} aria-label={`View ${displayName(item)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">
                          View <ChevronRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPage={setPage} disabled={loading} itemLabel="franchises" />
          </>
        )}
      </TableCard>

      {/* Pending queue nudge */}
      {counts && counts.pending > 0 && status !== "Pending" && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <Clock3 size={16} className="text-amber-700" />
            </div>
            <p className="text-sm font-semibold text-amber-800">
              {counts.pending} franchise application{counts.pending !== 1 ? "s" : ""} awaiting review
            </p>
          </div>
          <button type="button" onClick={() => { setStatus("Pending"); setPage(1); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">
            Review now <ArrowUpRight size={13} />
          </button>
        </div>
      )}
    </AdminLayout>
  );
};

export default FranchiseList;
