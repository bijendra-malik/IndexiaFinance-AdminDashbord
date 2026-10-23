import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowUpRight, FileText, Search } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import PageHeader from "../../components/common/PageHeader";
import Pagination from "../../components/common/Pagination";
import StatusBadge from "../../components/common/StatusBadge";
import { TableCard, TableEmpty, TableError, TableSkeleton, Th } from "../../components/common/TableShell";
import { getLoanTypeLabel, type LoanTypeSlug } from "../../constants/loanTypes";
import {
  getLoansBySlug, SUPPORTED_LOAN_SLUGS,
  getApiErrorMessage, type PersonalLoan,
} from "../../api/personalLoans";

// ── Constants ──────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

const STATUS_KEYS = ["All", "Submitted", "Pending", "Approved", "Rejected"] as const;
const STATUS_BTN: Record<string, string> = {
  Submitted: "bg-sky-50 text-sky-700",
  Pending:   "bg-amber-50 text-amber-700",
  Approved:  "bg-emerald-50 text-emerald-700",
  Rejected:  "bg-red-50 text-red-700",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// ── Component ──────────────────────────────────────────────────────────────────
const LoanApplicationsList = () => {
  const { loanType } = useParams<{ loanType: LoanTypeSlug }>();
  const navigate     = useNavigate();
  const label        = getLoanTypeLabel(loanType ?? "");
  const isSupported  = SUPPORTED_LOAN_SLUGS.has(loanType ?? "");

  const [loans, setLoans]               = useState<PersonalLoan[] | null>(null);
  const [error, setError]               = useState("");
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const load = async () => {
    setError("");
    try {
      if (!isSupported) { setLoans([]); return; }
      const data = await getLoansBySlug(loanType!);
      setLoans(data); setPage(1);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load applications."));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoans(null); setPage(1); setSearch(""); setStatusFilter("All"); void load(); }, [loanType]);

  const filtered = useMemo(() => {
    if (!loans) return [];
    return loans.filter((l) => {
      const q = search.trim().toLowerCase();
      const matchSearch = !q ||
        (l.fullName ?? "").toLowerCase().includes(q) ||
        (l.mobile ?? "").includes(q) ||
        (l.applicationNo ?? "").toLowerCase().includes(q) ||
        l._id.toLowerCase().includes(q);
      const matchStatus = statusFilter === "All" ||
        (l.status ?? "").toLowerCase() === statusFilter.toLowerCase();
      return matchSearch && matchStatus;
    });
  }, [loans, search, statusFilter]);

  const counts = useMemo(() => {
    if (!loans) return {} as Record<string, number>;
    return loans.reduce<Record<string, number>>((acc, l) => {
      const k = STATUS_KEYS.find((k) => k.toLowerCase() === (l.status ?? "").toLowerCase()) ?? (l.status ?? "Other");
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  }, [loans]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageLoans  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AdminLayout>
      <PageHeader
        icon={FileText}
        title={`${label} Applications`}
        subtitle={`Applications submitted for ${label.toLowerCase()}`}
        onRefresh={() => void load()}
        refreshing={loans === null && !error}
      >
        {/* Status count chips */}
        {loans && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(STATUS_BTN) as string[]).map((s) => (
              <span key={s} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BTN[s]}`}>
                {s}: {counts[s] ?? 0}
              </span>
            ))}
          </div>
        )}
      </PageHeader>

      <TableCard>
        {/* Filter bar */}
        {loans && loans.length > 0 && (
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name, mobile, ID…"
                className="w-full pl-8 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_KEYS.map((s) => {
                const active = statusFilter === s;
                const cls    = STATUS_BTN[s];
                return (
                  <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? s === "All" ? "text-white shadow-sm" : `${cls} ring-1 ring-current`
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                    style={active && s === "All" ? { background: "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))" } : undefined}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error ? (
          <TableError message={error} onRetry={() => void load()} />
        ) : loans === null ? (
          <TableSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <TableEmpty
            icon={FileText}
            title={loans.length === 0
              ? isSupported ? "No applications yet" : `API endpoint for ${label} not available`
              : "No results found"}
            description={loans.length > 0 ? "Try adjusting your search or filter." : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                    <Th>#</Th><Th>Application ID</Th><Th>Applicant</Th>
                    <Th>Mobile</Th><Th>Amount</Th><Th>Tenure</Th>
                    <Th>Status</Th><Th>Applied On</Th><Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {pageLoans.map((loan, i) => (
                    <tr key={loan._id}
                      onClick={() => navigate(`/applications/${loanType}/${loan._id}`)}
                      className="border-b border-slate-50 cursor-pointer transition hover:bg-sky-50/30 group">
                      <td className="px-5 py-4 text-xs text-slate-300 font-mono tabular-nums">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-5 py-4">
                        <span className="inline-block font-mono text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg group-hover:bg-sky-50 group-hover:text-sky-700 transition-colors">
                          {loan.applicationNo ?? `#${loan._id.slice(-8).toUpperCase()}`}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ background: "linear-gradient(135deg,#066a9c,#26ae90)" }}>
                            {(loan.fullName ?? "?")[0]?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">{loan.fullName ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-mono text-xs">{loan.mobile ?? "—"}</td>
                      <td className="px-5 py-4 font-bold text-slate-800">{fmtCurrency(loan.loanAmount)}</td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">{loan.loanTenure} mo</span>
                      </td>
                      <td className="px-5 py-4"><StatusBadge status={loan.status ?? "Submitted"} /></td>
                      <td className="px-5 py-4 text-slate-400 text-xs">{fmtDate(loan.createdAt)}</td>
                      <td className="px-5 py-4">
                        <ArrowUpRight size={14} className="text-slate-300 group-hover:text-sky-600 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <Pagination page={safePage} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} itemLabel="applications" />
            )}
          </>
        )}
      </TableCard>
    </AdminLayout>
  );
};

export default LoanApplicationsList;
