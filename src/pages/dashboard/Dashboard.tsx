import { useEffect, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, FileText, RefreshCw, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";
import { getDashboardStats, type DashboardStats } from "../../api/dashboard";
import {
  BRAND, formatCompactCurrency, formatCurrency, formatDateTime, percentOf, type Bucket,
} from "./dashboardUtils";
import { ContextStrip, DataWarning, KpiCard, Panel } from "./components/DashboardCards";
import ProductBars from "./components/ProductBars";
import StatusDonut from "./components/StatusDonut";
import { RecentAccountsTable, RecentApplicationsTable } from "./components/DashboardTables";
import ProductExplorer from "./components/ProductExplorer";

type TabId = "products" | "applications" | "accounts";

const TABS: { id: TabId; label: string }[] = [
  { id: "products", label: "By Product" },
  { id: "applications", label: "Recent Applications" },
  { id: "accounts", label: "Recent Accounts" },
];

const Dashboard = () => {
  const { admin } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [tab, setTab] = useState<TabId>("products");

  // No synchronous setState in the effect body — the previous version needed an
  // eslint-disable comment to get away with exactly that. State only settles
  // once the request resolves.
  useEffect(() => {
    let cancelled = false;
    getDashboardStats()
      .then((data) => {
        if (!cancelled) setStats(data);
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
  }, [reloadToken]);

  const refresh = () => {
    setError("");
    setLoading(true);
    setReloadToken((token) => token + 1);
  };

  const tabCount = (id: TabId) => {
    if (!stats) return 0;
    if (id === "products") return stats.products.length;
    if (id === "applications") return stats.recent.length;
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
            Welcome back, {admin?.name}. Live overview across every loan product.
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
              subtitle="Volume and decision split for every loan product"
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

          {/* ── Detail tables ────────────────────────────────────────────── */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div
              role="tablist"
              aria-label="Dashboard detail tables"
              className="scrollbar-hidden flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/60 px-3 pt-3"
            >
              {TABS.map(({ id, label }) => {
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
              {tab === "accounts" && <RecentAccountsTable accounts={stats.recentAccounts} />}
            </div>
          </section>
        </>
      ) : null}
    </AdminLayout>
  );
};

export default Dashboard;
