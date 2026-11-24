/**
 * The one filter dropdown style used across the admin list pages.
 *
 * Previously every page hand-rolled its own <select> with slightly different
 * padding, border and focus colours. New filters should use this instead.
 */
const FilterSelect = ({
  label,
  value,
  onChange,
  options,
  className = "",
  disabled = false,
  compact = false,
  title,
}: {
  /** Accessible name — also used as the tooltip. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
  /** Inline filter rows (chips ke saath) ke liye chhota padding/text. */
  compact?: boolean;
  /** Tooltip override — long selected value poora padhne ke liye. */
  title?: string;
}) => (
  <select
    aria-label={label}
    title={title ?? label}
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(event.target.value)}
    className={`rounded-lg border border-slate-200 bg-white px-3 text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 disabled:opacity-60 ${
      compact ? "py-1.5 text-xs" : "py-2.5 text-sm"
    } ${className}`}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default FilterSelect;
