import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  UserCheck,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import type { DashboardOverviewAccount, DashboardStats } from "../../api/dashboard";
import { KpiCard, Panel } from "./components/DashboardCards";

const formatDate = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const count = (value: number | undefined) => (value ?? 0).toLocaleString("en-IN");

const AccountRows = ({
  accounts,
  mode,
}: {
  accounts: DashboardOverviewAccount[];
  mode: "customers" | "franchises";
}) => {
  if (accounts.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-400">
        No {mode === "customers" ? "customers" : "franchises"} have registered yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-2.5">Name</th>
            <th className="px-5 py-2.5">Contact</th>
            <th className="px-5 py-2.5">Status</th>
            <th className="px-5 py-2.5">Registered</th>
            <th className="px-5 py-2.5"> </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {accounts.map((account) => (
            <tr key={account.id} className="transition hover:bg-slate-50">
              <td className="px-5 py-3">
                <p className="font-semibold text-slate-800">{account.name}</p>
                {account.displayId && (
                  <p className="mt-0.5 text-xs text-slate-400">{account.displayId}</p>
                )}
              </td>
              <td className="px-5 py-3">
                <p className="text-slate-700">{account.mobile || "—"}</p>
                <p className="mt-0.5 text-xs text-slate-400">{account.email || "—"}</p>
              </td>
              <td className="px-5 py-3">
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {account.status}
                </span>
              </td>
              <td className="px-5 py-3 text-slate-500">{formatDate(account.createdAt)}</td>
              <td className="px-5 py-3 text-right">
                {mode === "franchises" ? (
                  <Link
                    to={`/franchises/${encodeURIComponent(account.id)}`}
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    View
                  </Link>
                ) : (
                  <Link to="/customers" className="text-xs font-semibold text-sky-700 hover:underline">
                    View list
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CustomerOverview = ({ stats }: { stats: DashboardStats }) => (
  <section className="mb-6">
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Customer overview</h3>
        <p className="text-sm text-slate-500">Account registrations and verification at a glance.</p>
      </div>
      <Link to="/customers" className="shrink-0 text-sm font-semibold text-sky-700 hover:underline">
        All customers
      </Link>
    </div>
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard label="Total customers" value={count(stats.totalCustomers)} icon={Users} color="#0369a1" tint="#e0f2fe" />
      <KpiCard label="Active accounts" value={count(stats.activeCustomers)} icon={UserCheck} color="#047857" tint="#ecfdf5" />
      <KpiCard label="Verified accounts" value={count(stats.verifiedCustomers)} icon={BadgeCheck} color="#6d28d9" tint="#f5f3ff" />
      <KpiCard label="Inactive accounts" value={count(stats.inactiveCustomers)} icon={UserX} color="#be123c" tint="#fff1f2" />
    </div>
    <Panel title="Recent customer registrations" subtitle="The latest customer accounts">
      <AccountRows accounts={stats.recentCustomers ?? []} mode="customers" />
    </Panel>
  </section>
);

const FranchiseOverview = ({ stats }: { stats: DashboardStats }) => (
  <section className="mb-6">
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Franchise overview</h3>
        <p className="text-sm text-slate-500">Registration and application progress at a glance.</p>
      </div>
      <Link to="/franchises" className="shrink-0 text-sm font-semibold text-sky-700 hover:underline">
        All franchises
      </Link>
    </div>
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard label="Total franchises" value={count(stats.totalFranchises)} icon={Building2} color="#0369a1" tint="#e0f2fe" />
      <KpiCard label="Pending review" value={count(stats.pendingFranchises)} icon={Clock3} color="#b45309" tint="#fffbeb" />
      <KpiCard label="Approved" value={count(stats.approvedFranchises)} icon={CheckCircle2} color="#047857" tint="#ecfdf5" />
      <KpiCard label="Rejected" value={count(stats.rejectedFranchises)} icon={XCircle} color="#be123c" tint="#fff1f2" />
    </div>
    <Panel
      className="mb-4"
      title="Registration snapshot"
      subtitle="Accounts not yet submitted as franchise applications"
    >
      <div className="px-5 pb-5">
        <p className="text-2xl font-bold tabular-nums text-slate-900">
          {count(stats.registeredFranchises)}
        </p>
        <p className="mt-1 text-xs text-slate-500">Registered, not applied</p>
      </div>
    </Panel>
    <Panel title="Recent franchise registrations" subtitle="Open a profile to review the submitted details">
      <AccountRows accounts={stats.recentFranchises ?? []} mode="franchises" />
    </Panel>
  </section>
);

const ModuleDashboardOverview = ({ stats }: { stats: DashboardStats }) => (
  <div>
    {stats.dashboardMode === "customers" || stats.dashboardMode === "accounts" ? (
      <CustomerOverview stats={stats} />
    ) : null}
    {stats.dashboardMode === "franchises" || stats.dashboardMode === "accounts" ? (
      <FranchiseOverview stats={stats} />
    ) : null}
  </div>
);

export default ModuleDashboardOverview;
