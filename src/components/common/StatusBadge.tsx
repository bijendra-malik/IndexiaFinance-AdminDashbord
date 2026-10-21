/** Pill badge used for loan application status, customer active/inactive, etc. */

interface StatusBadgeProps {
  status: string;
  /** Override the display label (defaults to status string) */
  label?: string;
}

const VARIANTS: Record<string, string> = {
  active:    "border-emerald-100 bg-emerald-50 text-emerald-700",
  approved:  "border-emerald-100 bg-emerald-50 text-emerald-700",
  inactive:  "border-slate-200 bg-slate-100 text-slate-600",
  rejected:  "border-red-100 bg-red-50 text-red-700",
  pending:   "border-amber-100 bg-amber-50 text-amber-700",
  submitted: "border-sky-100 bg-sky-50 text-sky-700",
};

const DOTS: Record<string, string> = {
  active:    "bg-emerald-500",
  approved:  "bg-emerald-500",
  inactive:  "bg-slate-400",
  rejected:  "bg-red-500",
  pending:   "bg-amber-500",
  submitted: "bg-sky-500",
};

const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const key = status.toLowerCase();
  const badgeClass = VARIANTS[key] ?? "border-slate-200 bg-slate-100 text-slate-600";
  const dotClass   = DOTS[key]    ?? "bg-slate-400";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${badgeClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label ?? status}
    </span>
  );
};

export default StatusBadge;
