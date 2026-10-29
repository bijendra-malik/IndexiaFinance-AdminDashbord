import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck, Banknote, Calendar, Check, ChevronRight,
  Clock, Eye, FileText, LoaderCircle, Mail, Phone,
  ToggleLeft, ToggleRight, Trash2, TrendingUp,
  UserCheck, UserX, Users, X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import FilterSelect from "../../components/common/FilterSelect";
import Pagination from "../../components/common/Pagination";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import SearchBar from "../../components/common/SearchBar";
import StatusBadge from "../../components/common/StatusBadge";
import { TableCard, TableEmpty, TableError, TableSkeleton, Th } from "../../components/common/TableShell";
import { useToast } from "../../context/ToastContext";
import {
  deleteCustomer, getApiErrorMessage, getCustomer,
  getCustomerApplications, getCustomers, updateCustomerStatus,
  type Customer, type CustomerApplicationGroup,
} from "../../api/customers";
import {
  MINIMUM_CREDIT_SCORE, SUPPORTED_LOAN_SLUGS, updateLoanStatusBySlug,
  type LoanStatus, type PersonalLoan,
} from "../../api/personalLoans";
import { getLoanTypeLabel } from "../../constants/loanTypes";

// ── Constants ─────────────────────────────────────────────────────────────────
const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";
const PAGE_SIZE = 20;
const OPEN_STATUSES = new Set(["Submitted", "Pending"]);

const PRODUCT_SLUGS: Record<string, string> = {
  personal: "personal-loan", business: "business-loan", home: "home-loan",
  lap: "loan-against-property", balanceTransfer: "balance-transfer",
  projectLoan: "project-loan", vehicleLoan: "car-loan", educationLoan: "education-loan",
  creditCard: "credit-card", workingCapital: "working-capital",
  commercialPurchase: "commercial-purchase", leaseRentalDiscounting: "lease-rental-discounting",
  odCcLimit: "odcc-limit", loanAgainstShare: "loan-against-share", npaLoan: "npa-loan",
  goldLoan: "gold-loan", fdiLoan: "fdi-loan", filmFunding: "film-funding",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtCurrency = (n?: number) =>
  n == null ? "Amount not provided"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

// ── CustomersList ─────────────────────────────────────────────────────────────
const CustomersList = () => {
  const { showToast } = useToast();

  const [customers, setCustomers]         = useState<Customer[] | null>(null);
  const [error, setError]                 = useState("");
  const [search, setSearch]               = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [activeFilter, setActiveFilter]   = useState<"all" | "active" | "inactive">("all");
  const [page, setPage]                   = useState(1);
  const [updatingId, setUpdatingId]       = useState<string | null>(null);

  // Drawer state
  const [viewingCustomer, setViewingCustomer]   = useState<Customer | null>(null);
  const [customerDetail, setCustomerDetail]     = useState<Customer | null>(null);
  const [detailError, setDetailError]           = useState("");
  const [appGroups, setAppGroups]               = useState<CustomerApplicationGroup[] | null>(null);
  const [appsError, setAppsError]               = useState("");
  const [loadingApps, setLoadingApps]           = useState(false);
  const [appsRefreshKey, setAppsRefreshKey]     = useState(0);
  const [updatingAppId, setUpdatingAppId]       = useState<string | null>(null);
  const [pendingDecision, setPendingDecision]   = useState<{
    group: CustomerApplicationGroup; application: PersonalLoan;
    status: Extract<LoanStatus, "Pending" | "Approved" | "Rejected">;
  } | null>(null);
  const [decisionNote, setDecisionNote]         = useState("");
  const [pendingDelete, setPendingDelete]       = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting]             = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = () =>
    getCustomers({
      search: appliedSearch || undefined,
      isActive: activeFilter === "all" ? undefined : activeFilter === "active",
    })
      .then((list) => {
        setError("");
        setCustomers(list);
      })
      .catch((e: unknown) => {
        setError(getApiErrorMessage(e, "Unable to load customers."));
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [appliedSearch, activeFilter]);

  useEffect(() => {
    if (!viewingCustomer?._id) return;
    let cancelled = false;
    Promise.allSettled([
      getCustomer(viewingCustomer._id),
      getCustomerApplications(viewingCustomer._id),
    ]).then(([cr, ar]) => {
      if (cancelled) return;
      if (cr.status === "fulfilled") setCustomerDetail(cr.value);
      else setDetailError(getApiErrorMessage(cr.reason, "Unable to load customer details."));
      if (ar.status === "fulfilled") setAppGroups(ar.value);
      else setAppsError(getApiErrorMessage(ar.reason, "Unable to load applications."));
      setLoadingApps(false);
    });
    return () => { cancelled = true; };
  }, [viewingCustomer?._id, appsRefreshKey]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const allApps  = appGroups?.flatMap((g) => g.applications) ?? [];
  const openApps = allApps.filter((a) => OPEN_STATUSES.has(a.status));
  const canDelete = appGroups !== null && !appsError && openApps.length === 0 && !loadingApps;

  const sortedGroups = useMemo(() => {
    if (!appGroups) return null;
    const ms = (a?: PersonalLoan) => { const t = a?.createdAt ? +new Date(a.createdAt) : NaN; return isNaN(t) ? 0 : t; };
    return appGroups
      .map((g) => ({ ...g, applications: [...g.applications].sort((a, b) => ms(b) - ms(a)) }))
      .sort((a, b) => ms(b.applications[0]) - ms(a.applications[0]));
  }, [appGroups]);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = search.trim().toLowerCase();
    return !q ? customers : customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.mobile.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(Math.max(1, page), totalPages);
  const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const totalActive   = customers?.filter((c) => c.isActive).length ?? 0;
  const totalInactive = (customers?.length ?? 0) - totalActive;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openDrawer = (c: Customer) => {
    setCustomerDetail(null); setDetailError(""); setAppGroups(null);
    setAppsError(""); setLoadingApps(true); setViewingCustomer(c);
  };

  const closeDrawer = () => {
    if (isDeleting || updatingAppId) return;
    setViewingCustomer(null); setCustomerDetail(null); setDetailError("");
    setAppGroups(null); setAppsError(""); setLoadingApps(false);
  };

  const retryApps = () => {
    setCustomerDetail(null); setDetailError(""); setAppGroups(null);
    setAppsError(""); setLoadingApps(true); setAppsRefreshKey((k) => k + 1);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteCustomer(pendingDelete._id);
      setCustomers((prev) => prev?.filter((c) => c._id !== pendingDelete._id) ?? prev);
      showToast(`"${pendingDelete.name}" deleted`, "success");
      setPendingDelete(null); setViewingCustomer(null);
    } catch (e) {
      const st = (e as { response?: { status?: number } })?.response?.status;
      const msg = getApiErrorMessage(e, "Unable to delete this customer.");
      showToast(st === 409 ? `${msg} Resolve open applications first.` : msg, "error");
    } finally { setIsDeleting(false); }
  };

  const handleToggle = async (c: Customer) => {
    const next = !c.isActive;
    setUpdatingId(c._id);
    try {
      await updateCustomerStatus(c._id, next);
      setCustomers((cur) => cur?.flatMap((item) => {
        if (item._id !== c._id) return [item];
        if (activeFilter !== "all" && (activeFilter === "active") !== next) return [];
        return [{ ...item, isActive: next }];
      }) ?? cur);
      showToast(`Customer ${next ? "activated" : "deactivated"}.`, "success");
    } catch (e) {
      showToast(getApiErrorMessage(e, "Unable to update account status."), "error");
    } finally { setUpdatingId(null); }
  };

  const handleDecision = async (
    group: CustomerApplicationGroup, app: PersonalLoan,
    status: Extract<LoanStatus, "Pending" | "Approved" | "Rejected">, note = ""
  ) => {
    const slug = PRODUCT_SLUGS[group.product] ?? app.loanType;
    if (!slug) { showToast(`Cannot determine loan type for ${app._id}.`, "error"); return; }
    setUpdatingAppId(app._id);
    try {
      const updated = await updateLoanStatusBySlug(slug, app._id, status, note.trim());
      setAppGroups((cur) => cur?.map((g) => ({
        ...g, applications: g.applications.map((a) => a._id === updated._id ? updated : a),
      })) ?? cur);
      showToast(`Application marked ${status.toLowerCase()}.`, "success");
    } catch (e) {
      showToast(getApiErrorMessage(e, `Unable to ${status.toLowerCase()} this application.`), "error");
    } finally { setUpdatingAppId(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <PageHeader
        icon={Users} title="Customers"
        subtitle="Manage customer accounts and review their loan applications."
        onRefresh={() => void load()} refreshing={customers === null && !error}
      />

      {/* Stat cards */}
      {customers !== null && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Customers"   value={customers.length} icon={Users}      bgClass="bg-sky-50"     iconClass="text-sky-600"     labelClass="text-sky-700"     subtext="All registered" />
          <StatCard label="Active Accounts"   value={totalActive}      icon={UserCheck}  bgClass="bg-emerald-50" iconClass="text-emerald-600" labelClass="text-emerald-700" subtext="Can log in" />
          <StatCard label="Inactive Accounts" value={totalInactive}    icon={UserX}      bgClass="bg-red-50"     iconClass="text-red-600"     labelClass="text-red-700"     subtext="Temporarily disabled" />
          <StatCard label="Open Applications" value="—"                icon={TrendingUp} bgClass="bg-amber-50"   iconClass="text-amber-600"   labelClass="text-amber-700"   subtext="Across all customers" />
        </div>
      )}

      {/* Table card */}
      <TableCard>
        <SearchBar
          value={search} onChange={setSearch}
          onSubmit={() => { setAppliedSearch(search.trim()); setPage(1); }}
          onClear={() => { setSearch(""); setAppliedSearch(""); setPage(1); }}
          placeholder="Search by name, email or mobile…"
          showClear={!!(appliedSearch || activeFilter !== "all")}
          summary={customers && !error ? `<b class="text-slate-700">${filtered.length}</b> / <b class="text-slate-700">${customers.length}</b> customers` : undefined}
        >
          <FilterSelect
            label="Filter by status" value={activeFilter}
            onChange={(v) => { setActiveFilter(v as typeof activeFilter); setPage(1); }}
            options={[
              { value: "all", label: "All accounts" },
              { value: "active", label: "Active only" },
              { value: "inactive", label: "Inactive only" },
            ]}
            className="w-40"
          />
        </SearchBar>

        {error ? (
          <TableError message={error} onRetry={() => void load()} />
        ) : customers === null ? (
          <TableSkeleton rows={7} />
        ) : filtered.length === 0 ? (
          <TableEmpty
            icon={Users}
            title={customers.length === 0 ? "No customers yet" : "No customers match your filters"}
            description={customers.length === 0 ? "Customers appear once they register." : "Try adjusting your search or filter."}
            action={customers.length > 0 && (
              <button type="button" onClick={() => { setSearch(""); setAppliedSearch(""); setActiveFilter("all"); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50">
                Clear filters
              </button>
            )}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                    <Th>Customer</Th><Th>Contact</Th><Th>Status</Th>
                    <Th>Joined</Th><Th>Last login</Th><Th right>Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {paged.map((c) => (
                    <tr key={c._id} className="group transition-colors hover:bg-sky-50/30">
                      {/* Identity */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white shadow-sm" style={{ background: BRAND_GRADIENT }}>
                            {initials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-semibold text-slate-800 transition-colors group-hover:text-sky-700">{c.name}</span>
                            <span className="mt-0.5 flex items-center gap-1">
                              <span className="font-mono text-[10px] text-slate-400">{c.customerId || c._id.slice(-8)}</span>
                              {c.isVerified && <BadgeCheck size={11} className="text-emerald-500" />}
                            </span>
                          </div>
                        </div>
                      </td>
                      {/* Contact */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-slate-600"><Phone size={11} className="text-slate-400" />{c.mobile}</span>
                          <span className="flex items-center gap-1.5 truncate text-[11px] text-slate-400"><Mail size={11} />{c.email}</span>
                        </div>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={c.isActive ? "active" : "inactive"} label={c.isActive ? "Active" : "Inactive"} />
                      </td>
                      {/* Joined */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-slate-500"><Calendar size={12} className="text-slate-400" />{fmtDate(c.createdAt)}</span>
                      </td>
                      {/* Last login */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`flex items-center gap-1.5 ${c.lastLogin ? "text-slate-500" : "text-slate-300"}`}>
                          <Clock size={12} className="text-slate-400" />{c.lastLogin ? fmtDate(c.lastLogin) : "Never"}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openDrawer(c)} aria-label={`View ${c.name}`}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700">
                            <Eye size={13} /> View
                          </button>
                          <button onClick={() => void handleToggle(c)} disabled={updatingId === c._id}
                            aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${c.isActive ? "text-slate-500 hover:bg-amber-50 hover:text-amber-700" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                            {updatingId === c._id ? <LoaderCircle size={14} className="animate-spin" /> : c.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                            {c.isActive ? "Disable" : "Enable"}
                          </button>
                          {/* Row delete — the drawer footer has the same action.
                              Whether the customer may go is decided by the backend:
                              it answers 409 while Submitted/Pending applications
                              exist, and handleDelete surfaces that message. */}
                          <button onClick={() => setPendingDelete(c)} disabled={isDeleting || updatingId === c._id}
                            aria-label={`Delete ${c.name}`}
                            title="Delete this customer permanently"
                            className="rounded-lg border border-red-200 bg-white p-2 text-red-500 shadow-sm transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={safePage} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onPage={setPage} itemLabel="customers" />
          </>
        )}
      </TableCard>

      {/* ── Side drawer ───────────────────────────────────────────────────── */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-40 flex items-start justify-end bg-slate-950/40 backdrop-blur-[2px]" onClick={closeDrawer}>
          <section role="dialog" aria-modal="true" aria-labelledby="cust-drawer-title"
            className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl"
            style={{ borderLeft: "1px solid #e2e8f0" }}
            onClick={(e) => e.stopPropagation()}>

            {/* Drawer header */}
            <header className="relative shrink-0 border-b border-slate-200">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: BRAND_GRADIENT }} />
              <div className="flex items-start justify-between gap-4 px-6 pb-5 pt-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-md" style={{ background: BRAND_GRADIENT }}>
                    {initials(viewingCustomer.name)}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Customer profile</p>
                    <h2 id="cust-drawer-title" className="mt-0.5 text-xl font-bold text-slate-900">{viewingCustomer.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge status={viewingCustomer.isActive ? "active" : "inactive"} label={viewingCustomer.isActive ? "Active" : "Inactive"} />
                      {viewingCustomer.isVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                          <BadgeCheck size={11} /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={closeDrawer} disabled={isDeleting || !!updatingAppId} aria-label="Close"
                  className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-100 disabled:opacity-50">
                  <X size={18} />
                </button>
              </div>
            </header>

            {/* Drawer body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-5">

              {/* Detail error */}
              {detailError && (
                <div className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-sm">
                  <p className="font-semibold">Could not load details</p>
                  <p className="mt-0.5 text-red-600/80">{detailError}</p>
                  <button onClick={retryApps} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline text-xs">Retry</button>
                </div>
              )}

              {/* Customer info */}
              {customerDetail && (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h3 className="text-sm font-bold text-slate-800">Customer details</h3>
                  </div>
                  <dl className="grid gap-4 p-4 sm:grid-cols-2">
                    {[
                      { label: "Customer ID", value: customerDetail.customerId || customerDetail._id, mono: true },
                      { label: "PAN",         value: customerDetail.panNumber || "—",                 mono: true },
                      { label: "Date of birth", value: fmtDate(customerDetail.dob ?? null) },
                      { label: "Mobile",      value: customerDetail.mobile || "—" },
                      { label: "Email",       value: customerDetail.email  || "—" },
                      { label: "Location",    value: [customerDetail.city, customerDetail.state, customerDetail.country, customerDetail.pincode].filter(Boolean).join(", ") || "—" },
                      { label: "Account",     value: `${customerDetail.role} · ${customerDetail.isActive ? "Active" : "Inactive"}` },
                      { label: "Registered",  value: fmtDate(customerDetail.createdAt) },
                      { label: "Last login",  value: fmtDate(customerDetail.lastLogin) },
                    ].map(({ label, value, mono }) => (
                      <div key={label}>
                        <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
                        <dd className={`mt-1 text-sm text-slate-700 ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {/* Applications */}
              {loadingApps ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-14 shadow-sm">
                  <LoaderCircle size={22} className="animate-spin text-sky-600" />
                  <span className="text-sm text-slate-500">Loading applications…</span>
                </div>
              ) : appsError ? (
                <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                  <p className="font-semibold text-red-700">Could not load applications</p>
                  <p className="mt-1 text-sm text-red-600/90">{appsError}</p>
                  <button onClick={retryApps} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Retry</button>
                </div>
              ) : sortedGroups?.length ? (
                <>
                  {/* Summary banner */}
                  <div className={`rounded-2xl border p-4 shadow-sm ${openApps.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-800">
                          {openApps.length ? `${openApps.length} application${openApps.length > 1 ? "s" : ""} awaiting decision` : "All applications decided"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">{openApps.length ? "Review and record a decision." : "Customer deletion is now available."}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${openApps.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {openApps.length ? "Action required" : "Ready to delete"}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-current/10 pt-4 text-center">
                      {[["Total", allApps.length], ["Open", openApps.length], ["Decided", allApps.length - openApps.length]].map(([lbl, val]) => (
                        <div key={lbl}><p className="text-xl font-extrabold text-slate-800">{val}</p><p className="text-[10px] font-semibold uppercase text-slate-500">{lbl}</p></div>
                      ))}
                    </div>
                  </div>

                  {/* Application groups */}
                  {sortedGroups.map((group) => (
                    <section key={group.product} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100">
                            <FileText size={15} className="text-sky-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-800">{getLoanTypeLabel(PRODUCT_SLUGS[group.product] ?? group.product)}</h3>
                            <p className="text-[10px] text-slate-400">Loan applications</p>
                          </div>
                        </div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">{group.count}</span>
                      </div>
                      <div className="space-y-3 p-3">
                        {group.applications.map((app) => {
                          const isOpen = OPEN_STATUSES.has(app.status);
                          const slug   = PRODUCT_SLUGS[group.product] ?? app.loanType;
                          const canReview = isOpen && SUPPORTED_LOAN_SLUGS.has(slug);
                          return (
                            <article key={app._id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300">
                              {/* Amount + status */}
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Requested amount</p>
                                  <p className="mt-1 flex items-center gap-1.5 text-lg font-extrabold text-slate-900">
                                    <Banknote size={16} className="text-slate-400" />{fmtCurrency(app.loanAmount)}
                                  </p>
                                </div>
                                <StatusBadge status={app.status} />
                              </div>
                              {/* Meta grid */}
                              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2.5 sm:grid-cols-3">
                                {[
                                  ["Tenure", app.loanTenure ? `${app.loanTenure} months` : "—"],
                                  ["Applied", app.createdAt ? fmtDate(app.createdAt) : "—"],
                                  ["Credit score", typeof app.creditScore === "number" ? `${app.creditScore}/900 · ${(app.creditEligible ?? app.creditScore >= MINIMUM_CREDIT_SCORE) ? "Eligible" : "Not eligible"}` : "—"],
                                ].map(([lbl, val]) => (
                                  <div key={lbl}>
                                    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{lbl}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-700">{val}</p>
                                  </div>
                                ))}
                                <div className="col-span-2 border-t border-slate-200/80 pt-2 sm:col-span-3">
                                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Application ID</p>
                                  {SUPPORTED_LOAN_SLUGS.has(slug) ? (
                                    <Link to={`/applications/${slug}/${app._id}`} className="mt-1 flex items-center gap-1 font-mono text-[10px] text-sky-700 hover:underline">
                                      {app._id} <ChevronRight size={11} />
                                    </Link>
                                  ) : (
                                    <p className="mt-1 font-mono text-[10px] text-slate-600">{app._id}</p>
                                  )}
                                </div>
                              </div>
                              {/* Decision actions */}
                              {isOpen && canReview && (
                                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                                  {app.status === "Submitted" && (
                                    <button onClick={() => setPendingDecision({ group, application: app, status: "Pending" })} disabled={!!updatingAppId}
                                      className="rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                                      Mark Pending
                                    </button>
                                  )}
                                  <button onClick={() => { setDecisionNote(""); setPendingDecision({ group, application: app, status: "Rejected" }); }} disabled={!!updatingAppId}
                                    className="rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
                                    Reject
                                  </button>
                                  <button onClick={() => setPendingDecision({ group, application: app, status: "Approved" })} disabled={!!updatingAppId}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                    {updatingAppId === app._id ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}
                                    Approve
                                  </button>
                                </div>
                              )}
                              {updatingAppId === app._id && (
                                <p className="flex items-center justify-end gap-1.5 text-xs text-slate-500"><LoaderCircle size={12} className="animate-spin" /> Saving…</p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </>
              ) : appGroups !== null && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <FileText size={20} className="text-emerald-500" />
                  <p className="font-semibold text-emerald-800">No applications</p>
                  <p className="text-sm text-emerald-700">This customer has not applied for any loans. They can be deleted.</p>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {canDelete ? "Permanently removes customer and all closed records." : "Deletion disabled until all applications are decided."}
                </p>
                <button onClick={() => setPendingDelete(viewingCustomer)} disabled={!canDelete || isDeleting || !!updatingAppId}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
                  <Trash2 size={15} />{isDeleting ? "Deleting…" : "Delete customer"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {/* ── Confirm delete ────────────────────────────────────────────────── */}
      {pendingDelete && (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"?`}
          message="Permanently removes the account and all closed loan records. Cannot be undone."
          confirmText={pendingDelete.email} confirmLabel="Delete Customer"
          isSubmitting={isDeleting} onConfirm={handleDelete} onCancel={() => setPendingDelete(null)}
        />
      )}

      {/* ── Decision modals ───────────────────────────────────────────────── */}
      {pendingDecision && (
        pendingDecision.status === "Rejected" ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <form onSubmit={(e) => { e.preventDefault(); void handleDecision(pendingDecision.group, pendingDecision.application, pendingDecision.status, decisionNote); setPendingDecision(null); }}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-lg font-bold text-slate-800">Reject this application?</h2>
              <p className="mt-1 text-sm text-slate-500">This decision is final. Add an optional note for the customer.</p>
              <textarea autoFocus value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)}
                maxLength={500} rows={4} placeholder="Reason for rejection (optional)"
                className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100" />
              <p className="mt-1 text-right text-xs text-slate-400">{decisionNote.length}/500</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={!!updatingAppId} onClick={() => setPendingDecision(null)}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={!!updatingAppId}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Reject application</button>
              </div>
            </form>
          </div>
        ) : (
          <ConfirmDialog
            title={pendingDecision.status === "Pending" ? "Move to pending?" : "Approve this application?"}
            message={pendingDecision.status === "Pending"
              ? "Application stays in the queue and can be decided later."
              : "This permanently marks the application as approved and cannot be changed."}
            confirmLabel={pendingDecision.status === "Pending" ? "Mark Pending" : "Approve"}
            danger={false} isSubmitting={!!updatingAppId}
            onConfirm={() => { const d = pendingDecision; setPendingDecision(null); void handleDecision(d.group, d.application, d.status); }}
            onCancel={() => setPendingDecision(null)}
          />
        )
      )}
    </AdminLayout>
  );
};

export default CustomersList;
