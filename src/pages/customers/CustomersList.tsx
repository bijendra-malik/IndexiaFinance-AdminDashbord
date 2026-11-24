import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  BadgeCheck, Calendar, Clock, Eye, FileText, LoaderCircle, Mail, Phone,
  ToggleLeft, ToggleRight, Trash2, 
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
import AdminUpdateThread from "../../components/common/AdminUpdateThread";
import { TableCard, TableEmpty, TableError, TableSkeleton, Th } from "../../components/common/TableShell";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import {
  addCustomerUpdate, deleteCustomer, getApiErrorMessage, getCustomer,
  getCustomerApplications, getCustomers, updateCustomerStatus,
  type Customer, type CustomerApplicationGroup,
} from "../../api/customers";
import {
  SUPPORTED_LOAN_SLUGS, updateLoanStatusBySlug,
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

/* Chips ke liye chhota naam: "Personal Loan" → "Personal", "Credit Card" waisa hi. */
const shortLoanLabel = (slug: string) =>
  getLoanTypeLabel(slug).replace(/\s*Loan$/i, "") || slug;

interface CustomerLoanSummary {
  total: number;
  open: number;
  types: string[];
}

// ── CustomersList ─────────────────────────────────────────────────────────────
const CustomersList = ({ customerOnly = false }: { customerOnly?: boolean }) => {
  const { showToast } = useToast();
  const { isSuperAdmin } = useAuth();
  const isCustomerOnly = customerOnly || !isSuperAdmin;

  const [customers, setCustomers]         = useState<Customer[] | null>(null);
  const [error, setError]                 = useState("");
  const [search, setSearch]               = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [activeFilter, setActiveFilter]   = useState<"all" | "active" | "inactive">("all");
  const [page, setPage]                   = useState(1);
  const [updatingId, setUpdatingId]       = useState<string | null>(null);

  // Per-customer loan roll-up for the list ("kitne loans, kaunse products").
  const [loanSummary, setLoanSummary]     = useState<Record<string, CustomerLoanSummary | "error">>({});

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
  /* Account decision always needs a reason — wahi super admin ke trail me jaata hai. */
  const [statusPrompt, setStatusPrompt]         = useState<{ customer: Customer; next: boolean } | null>(null);
  const [statusNote, setStatusNote]             = useState("");
  const [searchParams, setSearchParams]         = useSearchParams();

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
    if (isCustomerOnly) {
      getCustomer(viewingCustomer._id)
        .then((customer) => {
          if (!cancelled) setCustomerDetail(customer);
        })
        .catch((e: unknown) => {
          if (!cancelled) setDetailError(getApiErrorMessage(e, "Unable to load customer details."));
        })
        .finally(() => {
          if (!cancelled) setLoadingApps(false);
        });
      return () => { cancelled = true; };
    }

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
  }, [viewingCustomer?._id, appsRefreshKey, isCustomerOnly]);

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

  /* List endpoint loan counts nahi deta, isliye sirf visible page ke customers
     ke applications ek saath load hote hain (ek baar per page). */
  const pageCustomerIds = paged.map((c) => c._id).join(",");
  useEffect(() => {
    if (!pageCustomerIds) return;
    let cancelled = false;

    void Promise.all(pageCustomerIds.split(",").map(async (id) => {
      try {
        const groups = await getCustomerApplications(id);
        const apps = groups.flatMap((g) => g.applications);
        const types = [...new Set(groups.map((g) => PRODUCT_SLUGS[g.product] ?? g.product))];
        return [id, {
          total: apps.length,
          open: apps.filter((a) => OPEN_STATUSES.has(a.status)).length,
          types,
        } as CustomerLoanSummary] as const;
      } catch {
        return [id, "error"] as const;
      }
    })).then((entries) => {
      if (cancelled) return;
      setLoanSummary((cur) => {
        const next = { ...cur };
        entries.forEach(([id, value]) => { next[id] = value; });
        return next;
      });
    });

    return () => { cancelled = true; };
  }, [pageCustomerIds]);

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

  /* Enable/disable super admin ka final decision hai — pehle reason poochhte hain. */
  const handleToggle = (c: Customer) => {
    setStatusNote("");
    setStatusPrompt({ customer: c, next: !c.isActive });
  };

  const submitStatusChange = async () => {
    if (!statusPrompt) return;
    const { customer, next } = statusPrompt;
    setUpdatingId(customer._id);
    try {
      await updateCustomerStatus(customer._id, next, statusNote.trim() || undefined);
      setCustomers((cur) => cur?.flatMap((item) => {
        if (item._id !== customer._id) return [item];
        if (activeFilter !== "all" && (activeFilter === "active") !== next) return [];
        return [{ ...item, isActive: next }];
      }) ?? cur);
      setCustomerDetail((cur) => (cur && cur._id === customer._id ? { ...cur, isActive: next } : cur));
      setViewingCustomer((cur) => (cur && cur._id === customer._id ? { ...cur, isActive: next } : cur));
      if (viewingCustomer?._id === customer._id) setAppsRefreshKey((k) => k + 1);
      showToast(
        `Customer ${next ? "activated" : "deactivated"}. Reason saved to the audit trail.`,
        "success"
      );
      setStatusPrompt(null);
      setStatusNote("");
    } catch (e) {
      showToast(getApiErrorMessage(e, "Unable to update account status."), "error");
    } finally { setUpdatingId(null); }
  };

  /* Regular admin ka note / recommendation — super admin ko decision ke liye jaata hai. */
  const handleAddUpdate = async (payload: {
    text: string; tag: string; suggestedStatus?: string;
  }) => {
    if (!viewingCustomer?._id) return false;
    await addCustomerUpdate(viewingCustomer._id, payload);
    setAppsRefreshKey((k) => k + 1);
    showToast(
      payload.suggestedStatus
        ? "Update saved and sent to the super admin for a decision."
        : "Update saved to the customer trail.",
      "success"
    );
    return true;
  };

  /* /customers?customer=<id> — activity feed se seedha is customer ka drawer khulta hai. */
  const focusedCustomerId = searchParams.get("customer");
  useEffect(() => {
    if (!focusedCustomerId) return;
    let cancelled = false;
    getCustomer(focusedCustomerId)
      .then((customer) => { if (!cancelled) openDrawer(customer); })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        const next = new URLSearchParams(searchParams);
        next.delete("customer");
        setSearchParams(next, { replace: true });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedCustomerId]);

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
        subtitle={isCustomerOnly
          ? "Registered customer accounts."
          : "Manage customer accounts and review their loan applications."}
        onRefresh={() => void load()} refreshing={customers === null && !error}
      />

      {/* Stat cards */}
      {customers !== null && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard label="Total Customers"   value={customers.length} icon={Users}      bgClass="bg-sky-50"     iconClass="text-sky-600"     labelClass="text-sky-700"     subtext="All registered" />
          <StatCard label="Active Accounts"   value={totalActive}      icon={UserCheck}  bgClass="bg-emerald-50" iconClass="text-emerald-600" labelClass="text-emerald-700" subtext="Can log in" />
          <StatCard label="Inactive Accounts" value={totalInactive}    icon={UserX}      bgClass="bg-red-50"     iconClass="text-red-600"     labelClass="text-red-700"     subtext="Temporarily disabled" />
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
              <table className="w-full min-w-[1020px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                    <Th>Customer</Th><Th>Contact</Th><Th>Loans</Th><Th>Status</Th>
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
                            <Link
                              to={`/customers/${encodeURIComponent(c._id)}`}
                              className="block font-semibold text-slate-800 transition-colors group-hover:text-sky-700 hover:underline"
                            >
                              {c.name}
                            </Link>
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
                      {/* Loans — kitne loans aur chhote product chips */}
                      <td className="px-4 py-3.5">
                        {(() => {
                          const summary = loanSummary[c._id];
                          if (summary === undefined) {
                            return <span className="text-[11px] text-slate-400">Loading…</span>;
                          }
                          if (summary === "error") {
                            return <span className="text-[11px] text-slate-300">—</span>;
                          }
                          if (summary.total === 0) {
                            return <span className="text-[11px] text-slate-400">No loans</span>;
                          }
                          const shown = summary.types.slice(0, 2);
                          const rest = summary.types.length - shown.length;
                          return (
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                                  {summary.total} loan{summary.total > 1 ? "s" : ""}
                                </span>
                                {summary.open > 0 && (
                                  <span className="whitespace-nowrap rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                    {summary.open} open
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {shown.map((slug) => (
                                  <span
                                    key={slug}
                                    title={getLoanTypeLabel(slug)}
                                    className="rounded-full border border-sky-100 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700"
                                  >
                                    {shortLoanLabel(slug)}
                                  </span>
                                ))}
                                {rest > 0 && (
                                  <span
                                    title={summary.types.slice(shown.length).map(getLoanTypeLabel).join(", ")}
                                    className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
                                  >
                                    +{rest}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}
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
                          {!isCustomerOnly && <button onClick={() => void handleToggle(c)} disabled={updatingId === c._id}
                            aria-label={`${c.isActive ? "Deactivate" : "Activate"} ${c.name}`}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${c.isActive ? "text-slate-500 hover:bg-amber-50 hover:text-amber-700" : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                            {updatingId === c._id ? <LoaderCircle size={14} className="animate-spin" /> : c.isActive ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                            {c.isActive ? "Disable" : "Enable"}
                          </button>}
                          {/* Row delete — the drawer footer has the same action.
                              Whether the customer may go is decided by the backend:
                              it answers 409 while Submitted/Pending applications
                              exist, and handleDelete surfaces that message. */}
                          {!isCustomerOnly && <button onClick={() => setPendingDelete(c)} disabled={isDeleting || updatingId === c._id}
                            aria-label={`Delete ${c.name}`}
                            title="Delete this customer permanently"
                            className="rounded-lg border border-red-200 bg-white p-2 text-red-500 shadow-sm transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>}
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

      {/* ── Customer Detail Modal (Center) ─────────────────────────────── */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-4" onClick={closeDrawer}>
          <section role="dialog" aria-modal="true" aria-labelledby="cust-drawer-title"
            className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <header className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-sky-50 to-blue-50">
              <div className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white shadow-sm" style={{ background: BRAND_GRADIENT }}>
                    {initials(viewingCustomer.name)}
                  </div>
                  <div>
                    <h2 id="cust-drawer-title" className="text-lg font-bold text-slate-900">{viewingCustomer.name}</h2>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-slate-500">{viewingCustomer.customerId || viewingCustomer._id.slice(-8)}</span>
                      <StatusBadge status={viewingCustomer.isActive ? "active" : "inactive"} label={viewingCustomer.isActive ? "Active" : "Inactive"} />
                      {viewingCustomer.isVerified && <BadgeCheck size={14} className="text-emerald-500" />}
                    </div>
                  </div>
                </div>
                <button onClick={closeDrawer} disabled={isDeleting || !!updatingAppId} aria-label="Close"
                  className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-100 disabled:opacity-50">
                  <X size={18} />
                </button>
              </div>
            </header>

            {/* Modal body - Grid layout */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                
                {/* Left: Customer Info */}
                <div className="space-y-6">
                  {detailError && (
                    <div className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 shadow-sm">
                      <p className="font-semibold">Could not load details</p>
                      <p className="mt-0.5 text-red-600/80">{detailError}</p>
                      <button onClick={retryApps} className="mt-2 text-xs font-semibold underline">Retry</button>
                    </div>
                  )}

                  {loadingApps && !customerDetail && (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8">
                      <LoaderCircle size={16} className="animate-spin text-sky-600" />
                      <span className="text-sm text-slate-500">Loading…</span>
                    </div>
                  )}

                  {/* Customer details card */}
                  {customerDetail && (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 px-4 py-3">
                        <h3 className="text-sm font-bold text-slate-800">Customer Information</h3>
                      </div>
                      <dl className="space-y-3 p-4">
                        {[
                          { label: "Customer ID", value: customerDetail.customerId || customerDetail._id.slice(-8), mono: true },
                          { label: "PAN", value: customerDetail.panNumber || "—", mono: true },
                          { label: "Date of Birth", value: fmtDate(customerDetail.dob ?? null) },
                          { label: "Mobile", value: customerDetail.mobile || "—" },
                          { label: "Email", value: customerDetail.email || "—" },
                          { label: "Location", value: [customerDetail.city, customerDetail.state, customerDetail.country, customerDetail.pincode].filter(Boolean).join(", ") || "—" },
                          { label: "Registered", value: fmtDate(customerDetail.createdAt) },
                          { label: "Last Login", value: fmtDate(customerDetail.lastLogin) },
                        ].map(({ label, value, mono }) => (
                          <div key={label} className="flex justify-between gap-3">
                            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                            <dd className={`text-sm text-slate-800 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {/* Admin updates thread - only for super admin */}
                  {customerDetail && !isCustomerOnly && (
                    <AdminUpdateThread
                      entity="customer"
                      updates={customerDetail.adminUpdates}
                      recommendation={customerDetail.statusRecommendation}
                      canWrite={!isSuperAdmin}
                      onSubmit={handleAddUpdate}
                    />
                  )}
                </div>

                {/* Right: Loan Applications Overview */}
                {!isCustomerOnly && (
                  <div className="space-y-6">
                    {loadingApps ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white py-12">
                        <LoaderCircle size={22} className="animate-spin text-sky-600" />
                        <span className="text-sm text-slate-500">Loading applications…</span>
                      </div>
                    ) : appsError ? (
                      <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
                        <p className="font-semibold text-red-700">Could not load applications</p>
                        <p className="mt-1 text-sm text-red-600/90">{appsError}</p>
                        <button onClick={retryApps} className="mt-3 text-xs font-semibold text-red-700 underline">Retry</button>
                      </div>
                    ) : sortedGroups?.length ? (
                      <>
                        {/* Loan Overview Summary */}
                        <div className={`rounded-xl border p-4 shadow-sm ${openApps.length ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                          <p className="font-bold text-slate-800">
                            {openApps.length ? `${openApps.length} pending application${openApps.length > 1 ? "s" : ""}` : "All applications decided"}
                          </p>
                          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-current/10 pt-3 text-center">
                            {[["Total", allApps.length], ["Open", openApps.length], ["Decided", allApps.length - openApps.length]].map(([lbl, val]) => (
                              <div key={lbl}>
                                <p className="text-2xl font-extrabold text-slate-800">{val}</p>
                                <p className="text-[10px] font-semibold uppercase text-slate-500">{lbl}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Application groups - Compact view */}
                        {sortedGroups.map((group) => (
                          <div key={group.product} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">{getLoanTypeLabel(PRODUCT_SLUGS[group.product] ?? group.product)}</h4>
                                <p className="text-xs text-slate-500">{group.count} application{group.count > 1 ? "s" : ""}</p>
                              </div>
                            </div>
                            <div className="divide-y divide-slate-100">
                              {group.applications.map((app) => {
                                const isOpen = OPEN_STATUSES.has(app.status);
                                const slug = PRODUCT_SLUGS[group.product] ?? app.loanType;
                                return (
                                  <div key={app._id} className="p-4 hover:bg-slate-50/50">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-slate-800">{fmtCurrency(app.loanAmount)}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          {app.loanTenure ? `${app.loanTenure} months · ` : ""}
                                          {fmtDate(app.createdAt)}
                                        </p>
                                        {typeof app.creditScore === "number" && (
                                          <p className="mt-1 text-xs text-slate-600">
                                            Credit: {app.creditScore}/900
                                          </p>
                                        )}
                                      </div>
                                      <StatusBadge status={app.status} />
                                    </div>
                                    {isOpen && SUPPORTED_LOAN_SLUGS.has(slug) && (
                                      <div className="mt-3 flex gap-2">
                                        <button
                                          onClick={() => { setDecisionNote(""); setPendingDecision({ group, application: app, status: "Rejected" }); }}
                                          disabled={!!updatingAppId}
                                          className="flex-1 rounded-lg border border-red-200 bg-white py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                        >
                                          Reject
                                        </button>
                                        <button
                                          onClick={() => setPendingDecision({ group, application: app, status: "Approved" })}
                                          disabled={!!updatingAppId}
                                          className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                          {updatingAppId === app._id ? "Saving…" : "Approve"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : appGroups !== null && (
                      <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
                        <FileText size={24} className="text-emerald-500" />
                        <p className="font-semibold text-emerald-800">No applications</p>
                        <p className="text-sm text-emerald-700">This customer hasn't applied for any loans yet.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer - only for super admin */}
            {!isCustomerOnly && isSuperAdmin && <footer className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setStatusNote(""); setStatusPrompt({ customer: viewingCustomer, next: !viewingCustomer.isActive }); }}
                    disabled={isDeleting || !!updatingAppId || updatingId === viewingCustomer._id}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${viewingCustomer.isActive ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                  >
                    {viewingCustomer.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {viewingCustomer.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <Link
                    to={`/customers/${encodeURIComponent(viewingCustomer._id)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                  >
                    <FileText size={14} /> Full Details
                  </Link>
                </div>
                <button
                  onClick={() => setPendingDelete(viewingCustomer)}
                  disabled={!canDelete || isDeleting || !!updatingAppId}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={15} />{isDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </footer>}
          </section>
        </div>
      )}

      {/* ── Account status reason (super admin decision) ───────────────────── */}
      {statusPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={(e) => { e.preventDefault(); void submitStatusChange(); }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-slate-800">
              {statusPrompt.next ? "Activate" : "Deactivate"} {statusPrompt.customer.name}?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {statusPrompt.next
                ? "The customer can log in and apply again once their account is active."
                : "The account is blocked and cannot log in or apply. This decision is recorded in the admin trail."}
            </p>
            <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Reason {statusPrompt.next ? "(optional)" : "(required)"}
            </label>
            <textarea
              autoFocus
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={statusPrompt.next ? "Why is this account being re-enabled?" : "Why is this account being blocked?"}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <p className="mt-1 text-right text-xs text-slate-400">{statusNote.length}/500</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setStatusPrompt(null)} disabled={!!updatingId}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
              <button
                type="submit"
                disabled={!!updatingId || (!statusPrompt.next && !statusNote.trim())}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${statusPrompt.next ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {updatingId ? "Saving…" : statusPrompt.next ? "Activate account" : "Deactivate account"}
              </button>
            </div>
          </form>
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
