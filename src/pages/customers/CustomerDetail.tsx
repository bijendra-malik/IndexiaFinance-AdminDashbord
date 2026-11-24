import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, Clock, FileText, LoaderCircle, RefreshCw,
  ShieldCheck, UserCheck, UserX,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/common/StatusBadge";
import {
  getApiErrorMessage, getCustomerOverview,
  type CustomerOverview, type CustomerOverviewGroup,
} from "../../api/customers";
import { SUPPORTED_LOAN_SLUGS } from "../../api/personalLoans";
import { resolveLoanSlug } from "../../constants/loanTypes";

const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

/* Sirf supported loan types ka detail page hota hai — baaki rows plain rehti hain. */
const canOpenApplication = (product: string) => SUPPORTED_LOAN_SLUGS.has(resolveLoanSlug(product));

const STATUS_CHIP: Record<string, string> = {
  Submitted: "bg-sky-50 text-sky-700",
  Pending: "bg-amber-50 text-amber-700",
  Approved: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
};

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const fmtCurrency = (amount?: number | null) =>
  amount == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const initials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

const Field = ({ label, children }: { label: string; children: string }) => (
  <div>
    <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-1 break-words text-sm text-slate-700">{children || "—"}</dd>
  </div>
);

/**
 * Customer overview — `/customers/:id` par khulta hai (list ke naam ya drawer ke
 * "Overview" se). Franchise customer audit page jaisa hi read-only layout:
 * profile, details, aur us customer ke saare loans product-wise. Decision /
 * delete waise hi customers list ke drawer me hote hain.
 */
const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ key: string; value: CustomerOverview | null; error: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const key = `${id}:${refreshKey}`;

    getCustomerOverview(id)
      .then((overview) => {
        if (!cancelled) setData({ key, value: overview, error: "" });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setData({ key, value: null, error: getApiErrorMessage(error, "Unable to load this customer.") });
        }
      });

    return () => { cancelled = true; };
  }, [id, refreshKey]);

  const current = data?.key === `${id}:${refreshKey}` ? data : null;
  const customer = current?.value?.customer;
  const loans = current?.value?.loans;
  const refresh = () => setRefreshKey((key) => key + 1);

  const openLoans = (loans?.byStatus?.Submitted ?? 0) + (loans?.byStatus?.Pending ?? 0);

  const renderGroup = (group: CustomerOverviewGroup) => (
    <div key={group.product} className="border-t border-slate-100 first:border-t-0">
      <h3 className="flex items-center justify-between bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
        {group.label}
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
          {group.count}
        </span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Application</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Applied</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Stage</th>
              <th className="px-4 py-2.5">Decision</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {group.applications.map((application) => (
              <tr key={application._id}>
                <td className="px-5 py-3 font-mono text-xs text-slate-700">
                  {canOpenApplication(group.product) ? (
                    <Link
                      to={`/applications/${resolveLoanSlug(group.product)}/${encodeURIComponent(application._id)}`}
                      title="Open this loan application"
                      aria-label={`Open application ${application.applicationNo || application._id}`}
                      className="inline-flex items-center gap-1 font-semibold text-[rgb(6,106,156)] hover:underline"
                    >
                      {application.applicationNo || application._id.slice(-8)}
                      <ArrowUpRight size={13} aria-hidden />
                    </Link>
                  ) : (
                    application.applicationNo || application._id.slice(-8)
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtCurrency(application.loanAmount)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDate(application.submittedAt)}</td>
                <td className="px-4 py-3"><StatusBadge status={application.status} /></td>
                <td className="px-4 py-3 text-slate-600">{application.stage}</td>
                <td className="px-4 py-3 text-slate-500">
                  {application.decisionAt ? fmtDate(application.decisionAt) : "—"}
                  {application.adminNote && (
                    <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-slate-400" title={application.adminNote}>
                      {application.adminNote}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link to="/customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} /> Customers
        </Link>
        <button
          type="button"
          onClick={refresh}
          disabled={!current}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {!current && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <LoaderCircle size={18} className="animate-spin" /> Loading customer overview...
        </div>
      )}

      {current?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {current.error}
        </div>
      )}

      {customer && loans && (
        <>
          <div className="mb-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold text-white shadow-md"
                style={{ background: BRAND_GRADIENT }}
              >
                {initials(customer.name)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{customer.name || "Customer"}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {customer.mobile || "—"}
                  {customer.email ? ` · ${customer.email}` : ""}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                  {customer.customerId || customer._id}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <StatusBadge
                status={customer.isActive ? "active" : "inactive"}
                label={customer.isActive ? "Active" : "Inactive"}
              />
              {customer.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                  <BadgeCheck size={12} /> Verified
                </span>
              )}
            </div>
          </div>

          <div className="mb-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
                <ShieldCheck size={17} className="text-sky-700" /> Customer details
              </h2>
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Field label="Customer ID">{customer.customerId || customer._id}</Field>
                <Field label="PAN">{customer.panNumber || "—"}</Field>
                <Field label="Date of birth">{fmtDate(customer.dob)}</Field>
                <Field label="Mobile">{customer.mobile || "—"}</Field>
                <Field label="Email">{customer.email || "—"}</Field>
                <Field label="Location">
                  {[customer.city, customer.state, customer.country, customer.pincode].filter(Boolean).join(", ") || "—"}
                </Field>
              </dl>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-800">
                <Clock size={17} className="text-sky-700" /> Account &amp; activity
              </h2>
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Field label="Account status">{customer.isActive ? "Active" : "Inactive"}</Field>
                <Field label="Verification">{customer.isVerified ? "Verified" : "Not verified"}</Field>
                <Field label="Role">{customer.role || "Customer"}</Field>
                <Field label="Registered">{fmtDate(customer.createdAt)}</Field>
                <Field label="Last login">{fmtDate(customer.lastLogin)}</Field>
                <Field label="Loan applications">
                  {`${loans.total} total · ${openLoans} open`}
                </Field>
              </dl>
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-800">
                <FileText size={17} className="text-sky-700" /> Loan applications ({loans.total})
              </h2>
              {openLoans > 0 && (
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                  {openLoans} awaiting decision
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
              {Object.entries(loans.byStatus).map(([status, count]) => (
                <span
                  key={status}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CHIP[status] ?? "bg-slate-100 text-slate-600"}`}
                >
                  {status}: {count}
                </span>
              ))}
              {openLoans > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
                  <UserCheck size={12} /> Read-only — decisions are taken from the customers list
                </span>
              )}
            </div>

            {loans.data.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                <UserX size={20} className="text-slate-300" />
                <p className="font-semibold text-slate-700">No loan applications</p>
                <p className="text-sm text-slate-500">This customer has not applied for any loan yet.</p>
              </div>
            ) : (
              loans.data.map(renderGroup)
            )}
          </section>
        </>
      )}
    </AdminLayout>
  );
};

export default CustomerDetail;
