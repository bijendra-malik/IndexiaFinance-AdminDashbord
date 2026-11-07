import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, MessageSquare, RefreshCw, ShieldCheck,
  UserRound, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";
import {
  getDashboardStats,
  type AdminActivityUpdate,
  type DashboardStats,
} from "../../api/dashboard";
import { LOAN_TYPES } from "../../constants/loanTypes";
import {
  adminLabel, applicationDetailPath, formatCompactCurrency, formatCurrency, formatDateTime,
  percentOf, roleLabel, shortDateTime, type Bucket,
} from "./dashboardUtils";
import { updateTagLabel } from "../../api/adminUpdates";
import { avatarGradient, initialsOf } from "../../utils/auditFormat";
import { ContextStrip, DataWarning, KpiCard, Panel } from "./components/DashboardCards";
import ProductBars from "./components/ProductBars";
import StatusDonut from "./components/StatusDonut";
import { AdminUpdatesTable, RecentAccountsTable, RecentApplicationsTable } from "./components/DashboardTables";
import ProductExplorer from "./components/ProductExplorer";
import ModuleDashboardOverview from "./ModuleDashboardOverview";
import SupervisorDashboard from "./SupervisorDashboard";

/** Product rows have no dependable slug, so fall back to matching the label. */
const productSlug = (row: { slug?: string; label?: string }): string | undefined =>
  row.slug ??
  LOAN_TYPES.find((loan) => loan.label.toLowerCase() === (row.label ?? "").toLowerCase())?.slug;

type TabId = "products" | "applications" | "updates" | "accounts";

const TABS: { id: TabId; label: string }[] = [
  { id: "products", label: "By Product" },
  { id: "applications", label: "Recent Applications" },
  { id: "updates", label: "Admin Updates" },
  { id: "accounts", label: "Recent Accounts" },
];

/**
 * One admin update, read like a sentence: who (role) → on which product /
 * applicant → what they wrote → when. The stored name can be an email and the
 * role arrives as "SuperAdmin", so both are humanised here.
 */
/*
Super admin aur regular admin ka dashboard ek jaisa nahi dikhna chahiye — role
ke hisaab se hero, tab accent aur highlight colour badalte hain, layout same
rehta hai.
*/
const ROLE_THEME = {
  super: {
    label: "Super admin view",
    icon: ShieldCheck,
    gradient: "linear-gradient(135deg, rgb(6,106,156) 0%, rgb(17,146,138) 58%, rgb(38,174,144) 100%)",
    accent: "rgb(6,106,156)",
    soft: "rgba(6,106,156,0.1)",
    hairline: "rgba(250,204,21,0.85)",
  },
  admin: {
    label: "Admin view",
    icon: UserRound,
    gradient: "linear-gradient(135deg, rgb(49,46,129) 0%, rgb(67,56,202) 52%, rgb(14,165,233) 100%)",
    accent: "rgb(67,56,202)",
    soft: "rgba(67,56,202,0.1)",
    hairline: "rgba(125,211,252,0.9)",
  },
} as const;

/* Customer/franchise rows apne record par jaate hain, loans apne application par. */
const updateTargetPath = (update: AdminActivityUpdate): string | null | undefined => {
  if (update.entity === "customer") {
    return `/customers?customer=${encodeURIComponent(update.entityId || update.applicationId)}`;
  }
  if (update.entity === "franchise") {
    return `/franchises/${update.entityId || update.applicationId}`;
  }
  return applicationDetailPath(update.slug, update.applicationId);
};

const AdminUpdateRow = ({ update }: { update: AdminActivityUpdate }) => {
  const detailPath = updateTargetPath(update);
  const who = adminLabel(update.addedByName);
  const role = roleLabel(update.addedByRole);
  const isDecision = update.kind === "status";
  const isRecommendation = update.kind === "recommendation";
  const recordLabel =
    update.entity === "customer" ? "Customer" : update.entity === "franchise" ? "Franchise" : update.label;

  // Left border = kind, so the feed can be scanned without reading the chips.
  const accent = isDecision
    ? "border-l-emerald-400"
    : isRecommendation
      ? "border-l-amber-400"
      : "border-l-slate-300";

  // One chip carries the whole meaning: note, recommendation or decision.
  const kindChip = isDecision
    ? {
        text: update.suggestedStatus ? `Decision: ${update.suggestedStatus}` : "Decision",
        className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      }
    : isRecommendation
      ? {
          text: update.suggestedStatus
            ? `Recommends ${update.suggestedStatus}`
            : "Recommendation",
          className: "bg-amber-50 text-amber-800 ring-amber-200",
        }
      : { text: "Note", className: "bg-slate-50 text-slate-600 ring-slate-200" };

  const statusTone =
    update.loanStatus === "Approved"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : update.loanStatus === "Rejected"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-amber-50 text-amber-700 ring-amber-200";

  return (
    <li
      className={`flex items-start gap-3 border-l-[3px] px-5 py-3 transition hover:bg-slate-50/70 ${accent}`}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: avatarGradient(who) }}
        title={update.addedByName}
        aria-hidden
      >
        {initialsOf(who)}
      </span>

      <div className="min-w-0 flex-1">
        {/* kaun + kab, ek line me */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-slate-800" title={update.addedByName}>
            {who}
          </span>
          {role && (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isDecision || /super/i.test(update.addedByRole)
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {role}
            </span>
          )}
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-slate-400">
            <Clock size={11} /> {shortDateTime(update.addedAt)}
          </span>
        </div>

        {/* kis record par + open */}
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {recordLabel}
          </span>
          <span className="min-w-0 truncate text-xs font-medium text-slate-700" title={update.fullName}>
            {update.fullName || "Applicant"}
          </span>
          {update.applicationNo && (
            <span className="hidden shrink-0 font-mono text-[10px] text-slate-400 sm:inline">
              {update.applicationNo}
            </span>
          )}
          {detailPath && (
            <Link to={detailPath} className="ml-auto shrink-0 text-[10px] font-semibold whitespace-nowrap text-sky-700 hover:underline">
              Open
            </Link>
          )}
        </div>

        <p
          className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700"
          title={update.text}
        >
          {update.text || "—"}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1 ${kindChip.className}`}
          >
            {isDecision ? (
              <CheckCircle2 size={11} />
            ) : isRecommendation ? (
              <Clock size={11} />
            ) : (
              <MessageSquare size={11} />
            )}
            {kindChip.text}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${statusTone}`}>
            {update.loanStatus}
          </span>
          {update.tag && update.tag !== "general" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
              {updateTagLabel(update.tag)}
            </span>
          )}
        </div>
      </div>
    </li>
  );
};

const AdminDashboard = () => {
  const { admin, loanAccess, canAccessLoan, isSuperAdmin } = useAuth();

  const [rawStats, setRawStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [tab, setTab] = useState<TabId>("products");

  // No synchronous setState in the effect body — the previous version needed an
  // eslint-disable comment to get away with exactly that. State only settles
  // once the request resolves.
  useEffect(() => {
    let cancelled = false;
    getDashboardStats({ includeAccounts: isSuperAdmin })
      .then((data) => {
        if (!cancelled) setRawStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Unable to load dashboard data."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, isSuperAdmin]);

  const refresh = () => {
    setError("");
    setLoading(true);
    setReloadToken((token) => token + 1);
  };

  /*
  A restricted admin only sees the products a super admin assigned. Totals are
  recomputed from those rows so the headline numbers, the donut and the product
  list all describe the same slice instead of leaking org-wide counts.
  */
  const stats: DashboardStats | null = rawStats
    ? loanAccess === "all"
      ? rawStats
      : (() => {
          const products = rawStats.products.filter((product) => canAccessLoan(productSlug(product)));
          const recent = rawStats.recent.filter((application) => canAccessLoan(productSlug(application)));
          const sum = (pick: (row: DashboardStats["products"][number]) => number) =>
            products.reduce((total, product) => total + pick(product), 0);
          const totalApplications = sum((product) => product.total);
          const approved = sum((product) => product.approved);
          return {
            ...rawStats,
            products,
            recent,
            totalApplications,
            submitted: sum((product) => product.submitted),
            pending: sum((product) => product.pending),
            approved,
            rejected: sum((product) => product.rejected),
            requestedAmount: sum((product) => product.requestedAmount),
            approvedAmount: sum((product) => product.approvedAmount),
            approvalRate: totalApplications > 0 ? (approved / totalApplications) * 100 : 0,
          };
        })()
    : null;

  /*
  "Recent Accounts" lists customer and franchise logins — super-admin context.
  A restricted admin's dashboard is loan products and applications only.
  */
  const tabs = isSuperAdmin ? TABS : TABS.filter((entry) => entry.id !== "accounts");

  const tabCount = (id: TabId) => {
    if (!stats) return 0;
    if (id === "products") return stats.products.length;
    if (id === "applications") return stats.recent.length;
    if (id === "updates") return stats.recentUpdates.length;
    return stats.recentAccounts.length;
  };

  const buckets: { key: Bucket; count: number }[] = stats
    ? [
        { key: "Approved", count: stats.approved },
        { key: "Pending", count: stats.pending },
        { key: "Submitted", count: stats.submitted },
        { key: "Rejected", count: stats.rejected },
      ]
    : [];

  // The dashboard aggregates four endpoints separately, so a partial failure is
  // reported without hiding the numbers that did load.
  const warnings = stats
    ? [stats.franchiseCustomersError, stats.accountsError].filter(
        (message): message is string => Boolean(message)
      )
    : [];

  const theme = isSuperAdmin ? ROLE_THEME.super : ROLE_THEME.admin;

  return (
    <AdminLayout>
      {/* ── Hero — role ke hisaab se rang ────────────────────────────────── */}
      <div
        className="mb-4 overflow-hidden rounded-2xl px-5 py-5 text-white shadow-sm"
        style={{ background: theme.gradient }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ring-inset ring-white/25">
              <theme.icon size={11} /> {theme.label}
            </span>
            <h2 className="mt-2.5 text-2xl font-bold leading-tight">Dashboard</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/85">
              Welcome back, {admin?.name}.{" "}
              {rawStats?.dashboardMode === "customers"
                ? "Here is your customer account overview."
                : rawStats?.dashboardMode === "franchises"
                  ? "Here is your franchise registration overview."
                  : rawStats?.dashboardMode === "accounts"
                    ? "Here is your customer and franchise account overview."
                    : loanAccess === "all"
                ? "Live overview across every loan product."
                : `Showing the ${stats?.products.length ?? 0} loan product(s) assigned to you.`}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/80">
              <span className="rounded-full bg-white/10 px-2 py-0.5 ring-1 ring-inset ring-white/20">
                {isSuperAdmin
                  ? "Full organisation access"
                  : `${stats?.products.length ?? 0} assigned product(s)`}
              </span>
              {stats && <span>Updated {formatDateTime(stats.generatedAt)}</span>}
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold ring-1 ring-inset ring-white/30 transition hover:bg-white/25 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        <span
          aria-hidden
          className="mt-4 block h-[3px] w-full max-w-[11rem] rounded-full"
          style={{ background: theme.hairline, opacity: 0.75 }}
        />
      </div>

      {error && !stats ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <p className="text-sm font-medium text-red-600">{error}</p>
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : loading && !stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="grid gap-4 xl:grid-cols-5">
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100 xl:col-span-3" />
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100 xl:col-span-2" />
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : stats ? (
        <>
          <DataWarning messages={error ? [error, ...warnings] : warnings} />
          {stats.dashboardMode ? (
            <ModuleDashboardOverview stats={stats} />
          ) : (
            <>

          {/* ── Headline numbers ─────────────────────────────────────────── */}
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Applications"
              value={stats.totalApplications.toLocaleString("en-IN")}
              sub={`Across ${stats.products.length} loan product${stats.products.length === 1 ? "" : "s"}`}
              icon={FileText}
              color="rgb(0, 102, 153)"
              tint="rgba(0, 102, 153, 0.08)"
            />
            <KpiCard
              label="Pending Review"
              value={stats.pending.toLocaleString("en-IN")}
              sub={`${percentOf(stats.pending, stats.totalApplications).toFixed(1)}% awaiting a decision`}
              icon={Clock}
              color="#b45309"
              tint="#fffbeb"
            />
            <KpiCard
              label="Approved"
              value={stats.approved.toLocaleString("en-IN")}
              sub={`${stats.approvalRate.toFixed(1)}% approval rate`}
              icon={CheckCircle2}
              color="#047857"
              tint="#ecfdf5"
            />
            <KpiCard
              label="Rejected"
              value={stats.rejected.toLocaleString("en-IN")}
              sub={`${percentOf(stats.rejected, stats.totalApplications).toFixed(1)}% of all applications`}
              icon={XCircle}
              color="#be123c"
              tint="#fff1f2"
            />
          </div>

          {/* ── Context numbers ──────────────────────────────────────────── */}
          <div className="mb-4">
            <ContextStrip
              items={[
                // Customers / franchises are super-admin context only.
                ...(isSuperAdmin
                  ? [
                      {
                        label: "Customers",
                        value: stats.totalCustomers.toLocaleString("en-IN"),
                        title: "Accounts with the Customer role",
                      },
                      {
                        label: "Franchises",
                        value: stats.totalFranchises.toLocaleString("en-IN"),
                        title: "Franchise login accounts",
                      },
                      {
                        label: "Franchise Customers",
                        value: stats.franchiseCustomerTotal.toLocaleString("en-IN"),
                        title: "Customers referred by franchises",
                      },
                    ]
                  : []),
                {
                  label: "Requested Value",
                  value: formatCompactCurrency(stats.requestedAmount),
                  title: formatCurrency(stats.requestedAmount),
                },
                {
                  label: "Sanctioned Value",
                  value: formatCompactCurrency(stats.approvedAmount),
                  title: formatCurrency(stats.approvedAmount),
                },
              ]}
            />
          </div>

          {/* ── Charts ───────────────────────────────────────────────────── */}
          <div className="mb-4 grid gap-4 xl:grid-cols-5">
            <Panel
              className="xl:col-span-3"
              title="Applications by Product"
              subtitle={
                isSuperAdmin
                  ? "Volume and decision split for every loan product"
                  : "Volume and decision split for the products assigned to you"
              }
            >
              <ProductBars products={stats.products} />
            </Panel>
            <Panel
              className="xl:col-span-2"
              title="Application Status"
              subtitle={`Across all ${stats.totalApplications.toLocaleString("en-IN")} applications`}
            >
              <StatusDonut slices={buckets} total={stats.totalApplications} />
            </Panel>
          </div>

          {/* ── Super admin ka decision queue ─────────────────────────────── */}
          {isSuperAdmin && (
            <Panel
              className="mb-4"
              title="Decision pending"
              subtitle="A regular admin checked these records and suggested a decision — approve or reject from the record."
              action={
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 tabular-nums">
                  {stats.pendingDecisions?.total ?? 0}
                </span>
              }
            >
              {(stats.pendingDecisions?.items ?? []).length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                    <CheckCircle2 size={20} />
                  </span>
                  <p className="text-sm font-semibold text-slate-700">No decisions pending</p>
                  <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                    A regular admin record check karke suggestion dega, wo yahan aayega.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(stats.pendingDecisions?.items ?? []).slice(0, 5).map((item) => {
                    /* Loan row ka apna application detail page hota hai. */
                    const reviewPath =
                      item.entity === "loan"
                        ? applicationDetailPath(item.slug, item.id) ?? "/applications"
                        : item.entity === "customer"
                        ? `/customers?customer=${encodeURIComponent(item.id)}`
                        : `/franchises/${item.id}`;
                    return (
                      <li
                        key={`${item.entity}-${item.id}`}
                        className="flex items-start gap-3 px-5 py-3 transition hover:bg-slate-50/70"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: avatarGradient(item.name || item.referenceNo || item.id) }}
                          aria-hidden
                        >
                          {initialsOf(item.name || "Record")}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              {item.entity === "loan"
                                ? item.productLabel ?? "Loan"
                                : item.entity === "customer"
                                  ? "Customer"
                                  : "Franchise"}
                            </span>
                            <span className="min-w-0 truncate text-sm font-semibold text-slate-800">
                              {item.name || "Unnamed"}
                            </span>
                            {item.referenceNo && (
                              <span className="hidden shrink-0 font-mono text-[10px] text-slate-400 sm:inline">
                                {item.referenceNo}
                              </span>
                            )}
                            <Link
                              to={reviewPath}
                              className="ml-auto shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-slate-600 transition hover:border-[rgb(6,106,156)] hover:text-[rgb(6,106,156)]"
                            >
                              Review
                            </Link>
                          </div>

                          <p className="mt-0.5 truncate text-[11px] text-slate-500" title={item.note}>
                            {item.note || "No note added."}
                            <span className="text-slate-400">
                              {" · "}
                              {adminLabel(item.requestedByName)}
                              {item.requestedAt ? ` · ${shortDateTime(item.requestedAt)}` : ""}
                            </span>
                          </p>

                          {/* Current → suggested, ek hi line me. */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              Current: {item.status || "—"}
                            </span>
                            <ArrowRight size={12} className="shrink-0 text-slate-300" />
                            {item.suggestedStatus && (
                              <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">
                                {item.suggestedStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {(stats.pendingDecisions?.total ?? 0) > 5 && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
                  Showing 5 of {stats.pendingDecisions?.total} pending decisions.
                </p>
              )}
            </Panel>
          )}

          {/* ── Latest admin activity ─────────────────────────────────────── */}
          {(isSuperAdmin || stats.recentUpdates.length > 0) && (
            <Panel
              className="mb-4"
              title="Admin updates"
              subtitle={
                isSuperAdmin
                  ? "Latest notes, status recommendations and decisions from every admin"
                  : "Latest notes and recommendations on the products assigned to you"
              }
              action={
                isSuperAdmin ? (
                  <Link
                    to="/activity"
                    className="shrink-0 text-xs font-semibold text-sky-700 hover:underline"
                  >
                    View all
                  </Link>
                ) : undefined
              }
            >
              {stats.recentUpdates.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <MessageSquare size={18} />
                  </span>
                  <p className="text-sm font-semibold text-slate-700">No admin updates yet</p>
                  <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                    Jaise hi koi admin note, recommendation ya decision likhega, wo yahan dikhega.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-slate-100">
                    {stats.recentUpdates.slice(0, 5).map((update) => (
                      <AdminUpdateRow key={update._id} update={update} />
                    ))}
                  </ul>
                </>
              )}
              {stats.recentUpdates.length > 5 && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
                  Showing the 5 most recent of {stats.recentUpdates.length} updates.
                </p>
              )}
            </Panel>
          )}

          {/* ── Detail tables ────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              role="tablist"
              aria-label="Dashboard detail tables"
              className="scrollbar-hidden flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-3 pt-3"
            >
              {tabs.map(({ id, label }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`dashboard-tab-${id}`}
                    aria-selected={active}
                    aria-controls={`dashboard-panel-${id}`}
                    onClick={() => setTab(id)}
                    className={`relative shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                      active ? "bg-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                    style={active ? { color: theme.accent } : undefined}
                  >
                    {active && (
                      <span
                        className="absolute inset-x-0 top-0 h-[2px] rounded-t"
                        style={{ background: theme.gradient }}
                      />
                    )}
                    {label}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                        active ? "" : "bg-slate-200/70 text-slate-500"
                      }`}
                      style={active ? { background: theme.soft, color: theme.accent } : undefined}
                    >
                      {tabCount(id)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div
              id={`dashboard-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`dashboard-tab-${tab}`}
            >
              {tab === "products" && <ProductExplorer products={stats.products} />}
              {tab === "applications" && <RecentApplicationsTable applications={stats.recent} />}
              {tab === "updates" && <AdminUpdatesTable updates={stats.recentUpdates} />}
              {tab === "accounts" && <RecentAccountsTable accounts={stats.recentAccounts} />}
            </div>
          </section>
            </>
          )}
        </>
      ) : null}
    </AdminLayout>
  );
};

/**
 * Role ke hisaab se do dashboard:
 *   sub admin -> supervision console (review queue, escalations, admins)
 *   baaki sab -> yahi purana loan/application dashboard
 */
const Dashboard = () => {
  const { isSubAdmin } = useAuth();
  return isSubAdmin ? <SupervisorDashboard /> : <AdminDashboard />;
};

export default Dashboard;
