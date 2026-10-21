import { type FormEvent, type ReactNode } from "react";
import { Search, X } from "lucide-react";

const BRAND_GRADIENT = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  placeholder?: string;
  /** Extra controls rendered after the search input (FilterSelect, etc.) */
  children?: ReactNode;
  /** Right-side summary text */
  summary?: string;
  showClear?: boolean;
}

/**
 * Search bar with submit button, inline clear-X, optional extra controls
 * (pass FilterSelect etc. as children), and an optional result summary.
 */
const SearchBar = ({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder = "Search…",
  children,
  summary,
  showClear,
}: SearchBarProps) => {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3.5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{placeholder}</span>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={onClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </label>

        {/* Slot for extra controls */}
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <button
            type="submit"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            style={{ background: BRAND_GRADIENT }}
          >
            Search
          </button>
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </div>

        {summary && (
          <p
            className="shrink-0 text-xs font-medium text-slate-500"
            dangerouslySetInnerHTML={{ __html: summary }}
          />
        )}
      </form>
    </div>
  );
};

export default SearchBar;
