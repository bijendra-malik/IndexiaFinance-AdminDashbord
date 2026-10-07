import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Gauge,
  LoaderCircle, RefreshCw, Search, ShieldCheck, Users, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getApiErrorMessage,
  getFranchiseCibilStats,
  getFranchiseCustomer,
  getFranchiseCustomers,
  type FranchiseCibilStats,
  type FranchiseCustomer as FranchiseCustomerRecord,
} from "../../api/franchiseCustomers";

const PAGE_SIZE = 20;
const ACTIVE_BACKGROUND = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const titleCase = (value?: string) =>
  value ? value.replace(/([a-z])([A-Z])/g, "$1 $2") : "—";

const statusClass = (status?: string) => {
  switch (status) {
    case "Checked": return "bg-emerald-50 text-emerald-700";
    case "Failed": return "bg-red-50 text-red-700";
    default: return "bg-slate-100 text-slate-600";
  }
};

const Metric = ({ label, value, icon: Icon, tone }: {
  label: string;
  value: number | string;
  icon: typeof Users;
  tone: string;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-500">{label}</p>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span>
    </div>
    <p className="mt-3 text-2xl font-bold text-slate-800">{value}</p>
  </div>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-700">{children || "—"}</dd>
  </div>
);

const FranchiseCustomers = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isStatsPage = location.pathname === "/franchise-customers/stats";

  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [franchise, setFranchise] = useState("");
  const [appliedFranchise, setAppliedFranchise] = useState("");
  const [cibilStatus, setCibilStatus] = useState("");
  const [locked, setLocked] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [list, setList] = useState<{
    key: string;
    result: Awaited<ReturnType<typeof getFranchiseCustomers>> | null;
    error: string;
  } | null>(null);
  const [stats, setStats] = useState<{ key: number; data: FranchiseCibilStats | null; error: string }>({
    key: -1, data: null, error: "",
  });
  const [detail, setDetail] = useState<{
    key: string;
    data: Awaited<ReturnType<typeof getFranchiseCustomer>> | null;
    error: string;
  } | null>(null);

  const listKey = `${appliedSearch}:${appliedFranchise}:${cibilStatus}:${locked}:${page}:${refreshKey}`;

  useEffect(() => {
    if (id || isStatsPage) return;
    let cancelled = false;
    getFranchiseCustomers({
      search: appliedSearch || undefined,
      franchise: appliedFranchise || undefined,
      cibilStatus: cibilStatus || undefined,
      locked: locked || undefined,
      page,
      limit: PAGE_SIZE,
    }).then((result) => {
      if (!cancelled) setList({ key: listKey, result, error: "" });
    }).catch((error: unknown) => {
      if (!cancelled) setList({
        key: listKey,
        result: null,
        error: getApiErrorMessage(error, "Unable to load franchise customers."),
      });
    });
    return () => { cancelled = true; };
  }, [appliedFranchise, appliedSearch, cibilStatus, id, isStatsPage, listKey, locked, page, refreshKey]);

  useEffect(() => {
    if (!isStatsPage) return;
    let cancelled = false;
    getFranchiseCibilStats().then((data) => {
      if (!cancelled) setStats({ key: refreshKey, data, error: "" });
    }).catch((error: unknown) => {
      if (!cancelled) setStats({
        key: refreshKey,
        data: null,
        error: getApiErrorMessage(error, "Unable to load CIBIL statistics."),
      });
    });
    return () => { cancelled = true; };
  }, [isStatsPage, refreshKey]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const key = `${id}:${refreshKey}`;
    getFranchiseCustomer(id).then((data) => {
      if (!cancelled) setDetail({ key, data, error: "" });
    }).catch((error: unknown) => {
      if (!cancelled) setDetail({
        key,
        data: null,
        error: getApiErrorMessage(error, "Unable to load this franchise customer."),
      });
    });
    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const currentList = list?.key === listKey ? list : null;
  const currentDetailKey = id ? `${id}:${refreshKey}` : "";
  const currentDetail = detail?.key === currentDetailKey ? detail : null;

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
    setAppliedFranchise(franchise.trim());
  };

  const refresh = () => setRefreshKey((key) => key + 1);

  if (id) {
    const record = currentDetail?.data?.customer;
    const owner = currentDetail?.data?.franchise;
    const loans = currentDetail?.data?.loans;
    const cibil = record?.cibil;
    return (
      <AdminLayout>
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link to="/franchise-customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft size={16} /> Franchise customers
          </Link>
          <button type="button" onClick={refresh} disabled={!currentDetail} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        {!currentDetail && (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading customer report...</div>
        )}
        {currentDetail?.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">{currentDetail.error}</div>}
        {record && (
          <>
            <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
              <div>
                <h1 className="text-xl font-bold text-slate-800">{record.fullName || "Franchise customer"}</h1>
                <p className="mt-1 text-sm text-slate-500">{record.mobile || "—"}{record.email ? ` · ${record.email}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(cibil?.status)}`}>{titleCase(cibil?.status)}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${record.loanForm?.locked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                  {record.loanForm?.locked ? "Loan form locked" : "Loan form unlocked"}
                </span>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><ShieldCheck size={17} className="text-sky-700" /> Customer & franchise</h2>
                <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <Field label="Full name">{record.fullName}</Field>
                  <Field label="Mobile">{record.mobile}</Field>
                  <Field label="Email">{record.email}</Field>
                  <Field label="PAN">{record.panNumber}</Field>
                  <Field label="Date of birth">{formatDate(record.dob)}</Field>
                  <Field label="Consent recorded">{formatDate(record.cibilConsentAt)}</Field>
                  <Field label="Franchise">{owner?.name}</Field>
                  <Field label="Franchise code">{owner?.franchiseId || record.franchiseCode}</Field>
                  <Field label="Franchise status">{owner?.franchiseStatus}</Field>
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800"><Gauge size={17} className="text-sky-700" /> CIBIL report</h2>
                <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                  <Field label="Score">{cibil?.score ?? "—"}</Field>
                  <Field label="Score band">{cibil?.band?.label}</Field>
                  <Field label="Provider">{cibil?.provider}</Field>
                  <Field label="Reference ID">{cibil?.referenceId}</Field>
                  <Field label="Checked at">{formatDate(cibil?.checkedAt)}</Field>
                  <Field label="Expires at">{formatDate(cibil?.expiresAt)}</Field>
                  <Field label="Eligibility threshold">{cibil?.threshold ?? "—"}</Field>
                  <Field label="Loan form">{record.loanForm?.canApplyLoan ? "Eligible" : "Not eligible"}</Field>
                </dl>
                {(cibil?.reason || cibil?.failureReason || record.loanForm?.reason) && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    {cibil?.reason || record.loanForm?.reason || cibil?.failureReason}
                  </p>
                )}
                <p className="mt-4 text-xs text-slate-400">Read-only audit view. CIBIL checks cannot be initiated here.</p>
              </section>
            </div>

            <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <FileText size={17} className="text-sky-700" />
                <h2 className="font-semibold text-slate-800">Loan applications ({loans?.total ?? 0})</h2>
              </div>
              <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
                {Object.entries(loans?.byStatus ?? {}).map(([status, count]) => (
                  <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{status}: {count}</span>
                ))}
              </div>
              {!loans?.data?.length ? (
                <p className="p-8 text-center text-sm text-slate-500">No loan applications found for this customer.</p>
              ) : loans.data.map((group) => (
                <div key={group.product} className="border-b border-slate-100 last:border-b-0">
                  <h3 className="bg-slate-50 px-5 py-3 text-sm font-semibold capitalize text-slate-700">{titleCase(group.product)} <span className="ml-1 text-xs font-normal">({group.count})</span></h3>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500"><tr><th className="px-5 py-2">Application</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Stage</th><th className="px-4 py-2">Step</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.applications.map((application, index) => (
                          <tr key={application.applicationNo || `${group.product}-${index}`}>
                            <td className="px-5 py-3 font-mono text-xs text-slate-700">{application.applicationNo || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{application.status || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{application.stage || "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{application.step ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </AdminLayout>
    );
  }

  if (isStatsPage) {
    const statsLoading = stats.key !== refreshKey;
    const data = statsLoading ? null : stats.data;
    const statsError = statsLoading ? "" : stats.error;
    return (
      <AdminLayout>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Franchise CIBIL overview</h1>
            <p className="text-sm text-slate-500">Network-wide eligibility and report audit funnel</p>
          </div>
          <button type="button" onClick={refresh} disabled={statsLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} className={statsLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        {statsError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{statsError}</div>}
        {statsLoading && <div className="flex items-center justify-center gap-2 py-12 text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading CIBIL statistics...</div>}
        {data && (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Total customers" value={data.total} icon={Users} tone="bg-sky-50 text-sky-700" />
              <Metric label="Consent recorded" value={data.consented} icon={ShieldCheck} tone="bg-violet-50 text-violet-700" />
              <Metric label="Reports checked" value={data.checked} icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" />
              <Metric label="Eligible / unlocked" value={data.eligible} icon={Gauge} tone="bg-teal-50 text-teal-700" />
              <Metric label="Not checked" value={data.notChecked} icon={Clock3} tone="bg-slate-100 text-slate-600" />
              <Metric label="Failed checks" value={data.failed} icon={XCircle} tone="bg-red-50 text-red-700" />
              <Metric label="Locked" value={data.locked} icon={ShieldCheck} tone="bg-amber-50 text-amber-700" />
              <Metric label="Checked but locked" value={data.checkedLocked} icon={Gauge} tone="bg-orange-50 text-orange-700" />
            </div>
            <p className="mb-4 text-xs text-slate-500">Loan eligibility threshold: {data.threshold}</p>
            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-semibold text-slate-800">Franchise-wise CIBIL funnel</h2>
              </div>
              {!data.byFranchise.length ? (
                <p className="p-8 text-center text-sm text-slate-500">No franchise customers found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>{["Franchise", "Total", "Consented", "Not checked", "Checked", "Failed", "Eligible", "Locked", "Checked locked"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.byFranchise.map((row, index) => (
                        <tr key={row.franchise?._id || `franchise-${index}`}>
                          <td className="px-4 py-3">
                            {row.franchise?._id ? (
                              <Link className="font-medium text-sky-800 hover:underline" to={`/franchises/${encodeURIComponent(row.franchise._id)}`}>
                                {row.franchise.name || row.franchise.franchiseId || "Franchise"}
                              </Link>
                            ) : "Franchise deleted"}
                            {row.franchise?.franchiseId && <p className="mt-0.5 text-xs text-slate-400">{row.franchise.franchiseId}</p>}
                          </td>
                          {[row.total, row.consented, row.notChecked, row.checked, row.failed, row.eligible, row.locked, row.checkedLocked].map((count, i) => <td key={i} className="px-4 py-3 text-slate-600">{count}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </AdminLayout>
    );
  }

  const result = currentList?.result;
  const customers: FranchiseCustomerRecord[] = result?.customers ?? [];
  const hasFilters = !!(appliedSearch || appliedFranchise || cibilStatus || locked);
  return (
    <AdminLayout>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Franchise customers</h1>
          <p className="text-sm text-slate-500">Read-only customer, CIBIL and loan eligibility audit</p>
        </div>
        <div className="flex gap-2">
          <Link to="/franchise-customers/stats" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">CIBIL overview</Link>
          <button type="button" onClick={refresh} disabled={!currentList} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form onSubmit={submitSearch} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, mobile, PAN, or email" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-500" />
          </div>
          <input value={franchise} onChange={(event) => setFranchise(event.target.value)} placeholder="Franchise FRN code or ID" className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500" />
          <select value={cibilStatus} onChange={(event) => { setCibilStatus(event.target.value); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500">
            <option value="">All CIBIL statuses</option><option value="NotChecked">Not checked</option><option value="Checked">Checked</option><option value="Failed">Failed</option>
          </select>
          <div className="flex gap-2">
            <select value={locked} onChange={(event) => { setLocked(event.target.value); setPage(1); }} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500">
              <option value="">Any form state</option><option value="false">Unlocked</option><option value="true">Locked</option>
            </select>
            <button type="submit" className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: ACTIVE_BACKGROUND }}>Apply</button>
          </div>
        </form>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {currentList?.error && <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{currentList.error}</div>}
        {!currentList ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Loading franchise customers...</div>
        ) : currentList.error ? null : !customers.length ? (
          <div className="py-16 text-center text-sm text-slate-500">{hasFilters ? "No customers match these filters." : "No franchise customers found."}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>{["Customer", "Franchise", "PAN", "CIBIL", "Score", "Loan form", "Loans", "Last applied", ""].map((label, index) => <th key={`${label}-${index}`} className="px-4 py-3">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <Link to={`/franchise-customers/${encodeURIComponent(customer._id)}`} className="font-semibold text-sky-800 hover:underline">{customer.fullName || "Customer"}</Link>
                        <p className="mt-0.5 text-xs text-slate-500">{customer.mobile || customer.email || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{customer.franchise?.name || customer.franchise?.franchiseId || "Franchise deleted"}<p className="mt-0.5 text-xs text-slate-400">{customer.franchise?.franchiseId || customer.franchiseCode || ""}</p></td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{customer.panNumber || "—"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(customer.cibil?.status)}`}>{titleCase(customer.cibil?.status)}</span></td>
                      <td className="px-4 py-3 text-slate-600">{customer.cibil?.score ?? "—"}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${customer.loanForm?.locked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{customer.loanForm?.locked ? "Locked" : "Unlocked"}</span></td>
                      <td className="px-4 py-3 text-slate-600">{customer.loans?.count ?? 0}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(customer.loans?.lastAppliedAt)}</td>
                      <td className="px-4 py-3"><Link to={`/franchise-customers/${encodeURIComponent(customer._id)}`} className="text-xs font-semibold text-sky-700 hover:underline">Audit</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-500">Showing {(result!.page - 1) * result!.limit + 1}–{Math.min(result!.page * result!.limit, result!.total)} of {result!.total} customers</p>
              <div className="flex items-center gap-2">
                <button aria-label="Previous page" disabled={result!.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={17} /></button>
                <span className="text-xs text-slate-600">Page {result!.page} of {Math.max(1, result!.totalPages)}</span>
                <button aria-label="Next page" disabled={result!.page >= result!.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={17} /></button>
              </div>
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
};

export default FranchiseCustomers;
