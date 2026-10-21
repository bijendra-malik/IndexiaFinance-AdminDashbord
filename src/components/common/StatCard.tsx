import type { ComponentType } from "react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  bgClass: string;
  labelClass?: string;
  subtext?: string;
  active?: boolean;
  onClick?: () => void;
}

/**
 * Reusable stat card — used on Customers, Franchises, Dashboard, etc.
 * Pass `onClick` to make it a clickable filter shortcut (adds ring on active).
 */
const StatCard = ({
  label,
  value,
  icon: Icon,
  iconClass,
  bgClass,
  labelClass = "text-slate-500",
  subtext,
  active,
  onClick,
}: StatCardProps) => {
  const base =
    "flex w-full items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition";
  const activeStyle = active
    ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200 shadow-sky-100/60"
    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md";

  return onClick ? (
    <button type="button" onClick={onClick} className={`${base} ${activeStyle}`}>
      <CardInner
        icon={Icon}
        iconClass={iconClass}
        bgClass={bgClass}
        value={value}
        label={label}
        labelClass={labelClass}
        subtext={subtext}
      />
    </button>
  ) : (
    <div className={`${base} border-slate-200 bg-white`}>
      <CardInner
        icon={Icon}
        iconClass={iconClass}
        bgClass={bgClass}
        value={value}
        label={label}
        labelClass={labelClass}
        subtext={subtext}
      />
    </div>
  );
};

const CardInner = ({
  icon: Icon,
  iconClass,
  bgClass,
  value,
  label,
  labelClass,
  subtext,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  bgClass: string;
  value: number | string;
  label: string;
  labelClass: string;
  subtext?: string;
}) => (
  <>
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgClass}`}
    >
      <Icon size={19} className={iconClass} />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-extrabold leading-none text-slate-900">{value}</p>
      <p className={`mt-1 text-xs font-semibold ${labelClass}`}>{label}</p>
      {subtext && <p className="mt-0.5 text-[10px] text-slate-400">{subtext}</p>}
    </div>
  </>
);

export default StatCard;
