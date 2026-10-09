import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowUpRight, CheckCircle2, Clock, FileText,
  Handshake, IndianRupee, Percent, RefreshCw, Users, XCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../utils/apiError";
import { getDashboardStats, type DashboardStats } from "../../api/dashboard";

type Bucket = "Submitted" | "Pending" | "Approved" | "Rejected";

const BUCKET_META: Record<Bucket, { bg: string; text: string; color: string }> = {
  Approved:  { bg: "bg-emerald-50", text: "text-emerald-700", color: "#10b981" },
  Pending:   { bg: "bg-amber-50",   text: "text-amber-700",   color: "#f59e0b" },
  Rejected:  { bg: "bg-red-50",     text: "text-red-700",     color: "#ef4444" },
  Submitted: { bg: "bg-sky-50",     text: "text-sky-700",     color: "#0ea5e9" },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const amountOf = (loan: { loanAmount?: number }) =>
  typeof loan.loanAmount === "number" && Number.isFinite(loan.loanAmount) ? loan.loanAmount : 0;

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

const shortDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 30) return `${diff}d ago`;
  return formatDate(iso);
};

// ── Small building blocks ─────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: ComponentType<{ size?: number }>;
  iconBg: string;
  iconColor: string;
}

const StatCard = ({ label, value, sub, icon: Icon, iconBg, iconColor }: StatCardProps) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center gap-3">
    <div
      className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: iconBg, color: iconColor }}
    >
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className="text-xl font-semibold text-slate-800">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
    </div>
  </div>
);

const Panel = ({
  title, subtitle, action, children, className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
    <div className="p-5 pb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </div>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { admin } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setStats(await getDashboardStats());
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to load dashboard data."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]); // eslint-disable-line

  const buckets: { key: Bucket; count: number }[] = stats
    ? [
        { key: "Approved",  count: stats.approved },
        { key: "Pending",   count: stats.pending },
        { key: "Submitted", count: stats.submitted },
        { key: "Rejected",  count: stats.rejected },
      ]
    : [];

  return (
    <AdminLayout>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "rgb(0, 102, 153)" }}>
            Welcome, {admin?.name}
          </h2>
          <p className="text-sm text-slate-500">
            Live overview across every loan product on the portal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="text-xs text-slate-400 hidden sm:block">
              Last updated {formatDateTime(stats.generatedAt)}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 transition"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-white rounded-xl border border-slate-200 flex flex-col items-center gap-3 py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : loading && !stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="h-72 rounded-xl bg-slate-100 animate-pulse lg:col-span-2" />
            <div className="h-72 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        </div>
      ) : stats ? (
        <>
          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
            <StatCard
              label="Total Customers"
              value={stats.totalCustomers.toLocaleString("en-IN")}
              sub="Registered users"
              icon={Users}
              iconBg="rgba(0,102,153,0.08)"
              iconColor="rgb(0,102,153)"
            />
            <StatCard
              label="Franchise Customers"
              value={stats.franchiseCustomerTotal.toLocaleString("en-IN")}
              sub={stats.franchiseCustomersError ?? "Registered through franchises"}
              icon={Handshake}
              iconBg="rgba(38,174,144,0.1)"
              iconColor="rgb(20,140,115)"
            />
            <StatCard
              label="Total Applications"
              value={stats.totalApplications.toLocaleString("en-IN")}
              sub={`Across ${stats.products.length} products`}
              icon={FileText}
              iconBg="rgba(38,174,144,0.1)"
              iconColor="rgb(20,140,115)"
            />
            <StatCard
              label="Pending Review"
              value={stats.pending.toLocaleString("en-IN")}
              sub={`${stats.submitted} newly submitted`}
              icon={Clock}
              iconBg="#fffbeb"
              iconColor="#b45309"
            />
            <StatCard
              label="Approved"
              value={stats.approved.toLocaleString("en-IN")}
              sub={`${stats.approvalRate.toFixed(1)}% approval rate`}
              icon={CheckCircle2}
              iconBg="#ecfdf5"
              iconColor="#047857"
            />
            <StatCard
              label="Rejected"
              value={stats.rejected.toLocaleString("en-IN")}
              sub="Applications declined"
              icon={XCircle}
              iconBg="#fff1f2"
              iconColor="#be123c"
            />
          </div>

          {/* ── Money row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Requested Value</p>
              <p className="text-lg font-semibold text-slate-800 mt-0.5">
                {formatCurrency(stats.requestedAmount)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <IndianRupee size={11} /> Sum of all applications
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Approved Value</p>
              <p className="text-lg font-semibold text-emerald-700 mt-0.5">
                {formatCurrency(stats.approvedAmount)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <CheckCircle2 size={11} /> Sanctioned amount
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500">Approval Rate</p>
              <p className="text-lg font-semibold text-slate-800 mt-0.5">
                {stats.approvalRate.toFixed(1)}%
              </p>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <Percent size={11} /> Approved of total applications
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* ── Loan products breakdown ── */}
            <Panel
              className="lg:col-span-2"
              title="Loan Products"
              subtitle="Application volume and amounts per product"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-y border-slate-100 bg-slate-50/60">
                      <th className="px-5 py-2.5">Product</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                      <th className="px-4 py-2.5 text-right">Submitted</th>
                      <th className="px-4 py-2.5 text-right">Pending</th>
                      <th className="px-4 py-2.5 text-right">Approved</th>
                      <th className="px-4 py-2.5 text-right">Rejected</th>
                      <th className="px-4 py-2.5 text-right">Requested</th>
                      <th className="px-4 py-2.5 text-right">Approved amount</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.products.map((p) => (
                        <tr
                          key={p.slug}
                          onClick={() => navigate(`/applications/${p.slug}`)}
                          className="group cursor-pointer transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-3">
                            <span className="font-medium text-slate-800">{p.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">{p.total}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{p.submitted}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {p.pending > 0 ? (
                              <span className="text-amber-700 font-medium">{p.pending}</span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {p.approved > 0 ? (
                              <span className="text-emerald-700 font-medium">{p.approved}</span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{p.rejected}</td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                            {p.total > 0 ? formatCurrency(p.requestedAmount) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                            {p.approved > 0 ? formatCurrency(p.approvedAmount) : "—"}
                          </td>
                          <td className="px-5 py-3 w-8">
                            <ArrowUpRight size={14} className="text-slate-300 group-hover:text-[rgb(6,106,156)]" />
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </Panel>

            {/* ── Status distribution ── */}
            <Panel
              title="Application Status"
              subtitle={`Across all ${stats.totalApplications} applications`}
            >
              <div className="px-5 pb-5">
                <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-slate-100 mb-4">
                  {buckets.map(({ key, count }) => {
                    if (count === 0) return null;
                    return (
                      <div
                        key={key}
                        style={{
                          width: `${(count / stats.totalApplications) * 100}%`,
                          background: BUCKET_META[key].color,
                        }}
                      />
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  {buckets.map(({ key, count }) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: BUCKET_META[key].color }}
                        />
                        <span className="text-slate-600">{key}</span>
                      </div>
                      <span className="font-medium text-slate-800 tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>

                {stats.totalApplications === 0 && (
                  <p className="mt-4 text-xs text-slate-400 flex items-center gap-1.5">
                    <XCircle size={13} /> No applications returned by the API yet.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          {/* ── Recent applications ── */}
          <Panel
            className="mt-4"
            title="Recent Applications"
            subtitle="Latest submissions across all loan types"
            action={
              <span className="text-xs text-slate-400">{stats.recent.length} shown</span>
            }
          >
            {stats.recent.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-slate-400 italic">No applications yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-y border-slate-100 bg-slate-50/60">
                      <th className="px-5 py-2.5">Applicant</th>
                      <th className="px-5 py-2.5">Loan Type</th>
                      <th className="px-5 py-2.5">Amount</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5">Applied</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.recent.map((app) => {
                      const meta = BUCKET_META[(app.status as Bucket)] ?? BUCKET_META.Submitted;
                      return (
                        <tr
                          key={app._id}
                          onClick={() => navigate(`/applications/${app.slug}/${app._id}`)}
                          className="cursor-pointer hover:bg-slate-50 transition"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ background: "linear-gradient(135deg,#066a9c,#26ae90)" }}
                              >
                                {(app.fullName ?? "?")[0]?.toUpperCase()}
                              </div>
                              <span className="font-medium text-slate-800">
                                {app.fullName ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{app.label}</td>
                          <td className="px-5 py-3 text-slate-700 font-medium">
                            {formatCurrency(amountOf(app))}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}
                            >
                              {app.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500" title={formatDate(app.createdAt)}>
                            {shortDate(app.createdAt)}
                          </td>
                          <td className="px-5 py-3 w-8">
                            <ArrowUpRight size={14} className="text-slate-300" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ) : null}

      <Link
        to="/franchises"
        className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[rgb(0,102,153)]">
          <Handshake size={18} />
        </div>
        <span className="text-sm font-medium">Manage franchise applications</span>
        <span className="ml-auto text-xs font-semibold text-[rgb(0,102,153)]">Open management →</span>
      </Link>
    </AdminLayout>
  );
};

export default Dashboard;
