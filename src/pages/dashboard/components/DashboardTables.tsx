import { Link } from "react-router-dom";
import type { DashboardAccount, RecentApplication } from "../../../api/dashboard";
import {
  BRAND,
  STATUS,
  amountOf,
  applicationDetailPath,
  asBucket,
  formatCurrency,
  formatDate,
  formatDateTime,
  shortDate,
} from "../dashboardUtils";

const THEAD =
  "border-y border-slate-100 bg-slate-50/60 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500";
const EMPTY = "px-5 py-8 text-center text-sm italic text-slate-400";

/** Applicant names are real links, so rows are keyboard reachable and
 *  open-in-new-tab works. */
export const RecentApplicationsTable = ({
  applications,
}: {
  applications: RecentApplication[];
}) => {
  if (applications.length === 0) {
    return <p className={EMPTY}>No applications yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className={THEAD}>
            <th className="px-5 py-2.5">Applicant</th>
            <th className="px-5 py-2.5">Loan Type</th>
            <th className="px-5 py-2.5">Amount</th>
            <th className="px-5 py-2.5">Status</th>
            <th className="px-5 py-2.5">Applied</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {applications.map((application) => {
            const bucket = asBucket(application.status);
            const detailPath = applicationDetailPath(application.slug, application._id);
            const avatar = (
              <>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: BRAND.gradient }}
                >
                  {(application.fullName ?? "?")[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="font-medium text-slate-800 transition group-hover:text-[rgb(6,106,156)] group-hover:underline">
                  {application.fullName ?? "—"}
                </span>
              </>
            );
            return (
              // `_id` alone is a unique key — the old slug-based key produced
              // duplicate-key warnings when the payload had no slug.
              <tr key={application._id} className="transition hover:bg-slate-50">
                <td className="px-5 py-3">
                  {detailPath ? (
                    <Link to={detailPath} className="group flex items-center gap-2.5">
                      {avatar}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2.5">{avatar}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-600">{application.label}</td>
                <td className="px-5 py-3 font-medium text-slate-700">
                  {formatCurrency(amountOf(application))}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[bucket].bg} ${STATUS[bucket].text}`}
                  >
                    {application.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500" title={formatDate(application.createdAt)}>
                  {shortDate(application.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Account records. Contact / location / activity pairs share a cell so the
 * table stays narrow enough to avoid a horizontal scrollbar on a laptop.
 */
export const RecentAccountsTable = ({ accounts }: { accounts: DashboardAccount[] }) => {
  if (accounts.length === 0) {
    return <p className={EMPTY}>No customer or franchise accounts found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className={THEAD}>
            <th className="px-5 py-2.5">Account</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Contact</th>
            <th className="px-4 py-2.5">Location</th>
            <th className="px-4 py-2.5">PAN / Package</th>
            <th className="px-4 py-2.5">Activity</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {accounts.map((account) => {
            // Backend has shipped a missing status before — never call
            // .toLowerCase() on it directly.
            const statusText = String(account.status ?? "—");
            const key = statusText.trim().toLowerCase();
            const statusTone =
              key === "active" || key === "approved"
                ? "bg-emerald-50 text-emerald-700"
                : key === "rejected" || key === "inactive"
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-50 text-amber-700";

            return (
              <tr key={`${account.role}:${account.id}`} className="transition hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                      style={{ background: BRAND.gradient }}
                    >
                      {account.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?"}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-[13rem] truncate font-medium text-slate-800">
                        {account.name}
                      </span>
                      <span className="block font-mono text-[10px] text-slate-400">
                        {account.id}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      account.role === "Franchise"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-sky-50 text-sky-700"
                    }`}
                  >
                    {account.role}
                  </span>
                  <span
                    className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}
                  >
                    {statusText}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="block">{account.mobile || "—"}</span>
                  <span className="block max-w-[12rem] truncate text-xs text-slate-400">
                    {account.email || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="block max-w-[14rem] truncate">{account.location || "—"}</span>
                  {account.address && (
                    <span className="block max-w-[14rem] truncate text-xs text-slate-400">
                      {account.address}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <span className="block">{account.panNumber || "—"}</span>
                  <span className="block text-xs text-slate-400">
                    {account.packageName || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <span className="block text-xs" title="Last login">
                    {formatDateTime(account.lastLogin ?? undefined)}
                  </span>
                  <span className="block text-[11px] text-slate-400" title="Registered">
                    {formatDate(account.createdAt)} ·{" "}
                    {account.isVerified ? "Verified" : "Not verified"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    to={
                      account.role === "Franchise"
                        ? `/franchises/${encodeURIComponent(account.id)}`
                        : "/customers"
                    }
                    className="text-xs font-semibold text-sky-700 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
