import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, RefreshCw, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";
import { getDashboardStats, type DashboardStats } from "../../api/dashboard";
import { LOAN_TYPES } from "../../constants/loanTypes";
import {
  BRAND, applicationDetailPath, formatCompactCurrency, formatCurrency, formatDateTime, percentOf, shortDate, type Bucket,
} from "./dashboardUtils";
import { ContextStrip, DataWarning, KpiCard, Panel } from "./components/DashboardCards";
import ProductBars from "./components/ProductBars";
import StatusDonut from "./components/StatusDonut";
import { AdminUpdatesTable, RecentAccountsTable, RecentApplicationsTable } from "./components/DashboardTables";
import ProductExplorer from "./components/ProductExplorer";

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

const Dashboard = () => {
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

  return (
    <AdminLayout>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: BRAND.blue }}>
            Dashboard
          </h2>
          <p className="text-sm text-slate-500">
            Welcome back, {admin?.name}.{" "}
            {loanAccess === "all"
              ? "Live overview across every loan product."
              : `Showing the ${stats?.products.length ?? 0} loan product(s) assigned to you.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="hidden text-xs text-slate-400 sm:block">
              Updated {formatDateTime(stats.generatedAt)}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
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

          {/* ── Latest admin activity ─────────────────────────────────────── */}
          {stats.recentUpdates.length > 0 && (
            <Panel
              className="mb-4"
              title="Admin updates"
              subtitle={
                isSuperAdmin
                  ? "Latest notes, status recommendations and decisions from every admin"
                  : "Latest notes and recommendations on the products assigned to you"
              }
            >
              <ul className="divide-y divide-slate-100">
                {stats.recentUpdates.slice(0, 5).map((update) => {
                  const detailPath = applicationDetailPath(update.slug, update.applicationId);
                  return (
                    <li
                      key={update._id}
                      className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">
                            {update.addedByName || "Admin"}
                          </span>
                          {" · "}
                          {update.addedByRole || "Admin"}
                          {" · "}
                          {update.label}
                          {" · "}
                          {update.fullName || "Applicant"}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-slate-700" title={update.text}>
                          {update.text}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {update.suggestedStatus && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              update.kind === "status"
                                ? "bg-slate-800 text-white"
                                : update.suggestedStatus === "Approved"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : update.suggestedStatus === "Rejected"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {update.kind === "status" ? "Status" : "Recommends"}{" "}
                            {update.suggestedStatus}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {shortDate(update.addedAt)}
                        </span>
                        {detailPath && (
                          <Link
                            to={detailPath}
                            className="text-xs font-semibold text-sky-700 hover:underline"
                          >
                            View
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
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
                      active ? "bg-white text-[rgb(6,106,156)]" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute inset-x-0 top-0 h-[2px] rounded-t"
                        style={{ background: BRAND.gradient }}
                      />
                    )}
                    {label}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[11px] tabular-nums ${
                        active
                          ? "bg-[rgba(6,106,156,0.1)] text-[rgb(6,106,156)]"
                          : "bg-slate-200/70 text-slate-500"
                      }`}
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
      ) : null}
    </AdminLayout>
  );
};

export default Dashboard;
