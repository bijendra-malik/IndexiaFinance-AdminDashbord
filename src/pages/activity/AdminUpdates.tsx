import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getAdminActivity,
  type AdminActivityResult,
  type AdminActivityUpdate,
} from "../../api/adminActivity";
import { getApiErrorMessage } from "../../utils/apiError";

/*
==========================================
Admin Updates (super admin)
"Kis admin ne kis loan par kya update kiya" — ek hi screen par.
Left rail: admins (unke update counts ke saath) + loan products.
Right: har update ka card — admin, product, customer, message, status aur time.
Data backend ke /activity endpoint se aata hai (jo sabhi 18 loan products ke
adminUpdates trail ko jodta hai).
==========================================
*/

const BRAND_GRADIENT = "linear-gradient(135deg, rgb(6,106,156), rgb(38,174,144))";

const WINDOWS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All time" },
];

const getInitials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "A";

const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const fmtAmount = (value: number | null) =>
  typeof value === "number" && value > 0
    ? `₹${value.toLocaleString("en-IN")}`
    : null;

const statusStyle = (status: string) => {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700";
    case "Rejected":
      return "bg-rose-50 text-rose-600";
    case "Pending":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-sky-50 text-sky-700";
  }
};

const kindMeta = (kind: AdminActivityUpdate["kind"]) => {
  if (kind === "recommendation") {
    return { icon: CheckCircle2, label: "Recommendation", className: "bg-amber-50 text-amber-700" };
  }
  if (kind === "status") {
    return { icon: Activity, label: "Status change", className: "bg-emerald-50 text-emerald-700" };
  }
  return { icon: MessageSquare, label: "Note", className: "bg-slate-100 text-slate-600" };
};

const RailButton = ({
  active,
  label,
  count,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  badge?: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition ${
      active
        ? "bg-[rgba(6,106,156,0.09)] text-[rgb(6,106,156)]"
        : "text-slate-600 hover:bg-slate-50"
    }`}
  >
    <span className="min-w-0 flex-1 truncate">{label}</span>
    {badge && (
      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
        {badge}
      </span>
    )}
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      {count}
    </span>
  </button>
);

const AdminUpdates = () => {
  const [result, setResult] = useState<AdminActivityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminId, setAdminId] = useState("");
  const [product, setProduct] = useState("");
  const [days, setDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdminActivity({
        adminId: adminId || undefined,
        product: product || undefined,
        days,
      });
      setResult(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load admin activity."));
    } finally {
      setLoading(false);
    }
  }, [adminId, product, days]);

  useEffect(() => {
    void load();
  }, [load]);

  const admins = result?.admins ?? [];
  const products = useMemo(
    () => [...(result?.products ?? [])].sort((left, right) => right.total - left.total),
    [result]
  );
  const updates = result?.updates ?? [];

  const selectedAdmin = admins.find((admin) => admin.id === adminId);
  const selectedProduct = products.find((entry) => entry.key === product);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Activity size={19} className="text-[rgb(6,106,156)]" /> Admin Updates
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Kis admin ne kis loan application par kya update kiya — notes, status
            recommendations aur final decisions, sab ek jagah.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Window selector */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {WINDOWS.map((option) => (
          <button
            key={option.days}
            type="button"
            onClick={() => setDays(option.days)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              days === option.days
                ? "text-white shadow-sm"
                : "bg-white text-slate-500 shadow-sm hover:text-slate-700"
            }`}
            style={days === option.days ? { background: BRAND_GRADIENT } : undefined}
          >
            {option.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-slate-400">
          {result?.lastActivityAt
            ? `Last update ${fmtDateTime(result.lastActivityAt)}`
            : "No admin updates recorded yet"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        {/* Left rail */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <Users size={12} /> Admins
            </p>
            <RailButton
              active={adminId === ""}
              label="All admins"
              count={admins.reduce((sum, admin) => sum + admin.total, 0)}
              onClick={() => setAdminId("")}
            />
            <div className="mt-1 space-y-0.5">
              {admins.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">No admins yet</p>
              ) : (
                admins.map((admin) => (
                  <RailButton
                    key={admin.id}
                    active={adminId === admin.id}
                    label={admin.name}
                    count={admin.total}
                    badge={admin.role === "SuperAdmin" ? "Super" : undefined}
                    onClick={() => setAdminId(adminId === admin.id ? "" : admin.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Loan products
            </p>
            <RailButton
              active={product === ""}
              label="All products"
              count={products.reduce((sum, entry) => sum + entry.total, 0)}
              onClick={() => setProduct("")}
            />
            <div className="mt-1 max-h-72 space-y-0.5 overflow-y-auto">
              {products.map((entry) => (
                <RailButton
                  key={entry.key}
                  active={product === entry.key}
                  label={entry.label}
                  count={entry.total}
                  onClick={() => setProduct(product === entry.key ? "" : entry.key)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Feed */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <p className="text-sm font-semibold text-slate-700">
              {result?.total ?? 0} update{(result?.total ?? 0) === 1 ? "" : "s"}
            </p>
            {selectedAdmin && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {selectedAdmin.name}
              </span>
            )}
            {selectedProduct && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                {selectedProduct.label}
              </span>
            )}
            {(selectedAdmin || selectedProduct) && (
              <button
                type="button"
                onClick={() => {
                  setAdminId("");
                  setProduct("");
                }}
                className="ml-auto text-[11px] font-semibold text-[rgb(6,106,156)] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {error ? (
            <div className="rounded-xl bg-rose-50 px-4 py-6 text-center text-sm text-rose-600">
              {error}
              <button
                type="button"
                onClick={() => void load()}
                className="ml-2 font-semibold underline"
              >
                Retry
              </button>
            </div>
          ) : loading && !result ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Loading admin updates…
            </div>
          ) : updates.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare size={26} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No updates in this view</p>
              <p className="mt-1 text-xs text-slate-400">
                Regular admins ka note ya status recommendation add karte hi yahan
                dikhne lagega.
              </p>
            </div>
          ) : (
            <ul className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
              {updates.map((update) => {
                const kind = kindMeta(update.kind);
                const KindIcon = kind.icon;
                const amount = fmtAmount(update.loanAmount);
                return (
                  <li
                    key={update.id}
                    className="rounded-2xl border border-slate-100 bg-white p-3.5 transition hover:border-sky-100 hover:bg-sky-50/20"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                        style={{ background: BRAND_GRADIENT }}
                      >
                        {getInitials(update.adminName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-800">{update.adminName}</p>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              update.adminRole === "SuperAdmin"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {update.adminRole === "SuperAdmin" ? "Super" : "Admin"}
                          </span>
                          <span className="text-[11px] text-slate-400">updated</span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                            {update.label}
                          </span>
                          {update.customerName && (
                            <span className="truncate text-[11px] text-slate-500">
                              · {update.customerName}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {update.text || `${kind.label} added`}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${kind.className}`}
                          >
                            <KindIcon size={11} /> {kind.label}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-semibold ${statusStyle(update.loanStatus)}`}
                          >
                            {update.loanStatus}
                          </span>
                          {update.suggestedStatus && (
                            <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-500 ring-1 ring-slate-200">
                              Suggested: {update.suggestedStatus}
                            </span>
                          )}
                          {amount && (
                            <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-500 ring-1 ring-slate-200">
                              {amount}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Clock3 size={11} /> {fmtDateTime(update.addedAt)}
                          </span>
                          {update.applicationId && (
                            <Link
                              to={`/applications/${update.slug}/${update.applicationId}`}
                              className="ml-auto inline-flex items-center gap-1 font-semibold text-[rgb(6,106,156)] hover:underline"
                            >
                              Open application <ArrowUpRight size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {updates.length > 0 && updates.length < (result?.total ?? 0) && (
            <p className="mt-3 text-center text-[11px] text-slate-400">
              Showing newest {updates.length} of {result?.total} updates.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck size={12} /> Sirf super admin ko ye organisation-wide view
        dikhta hai.
      </p>
    </AdminLayout>
  );
};

export default AdminUpdates;
