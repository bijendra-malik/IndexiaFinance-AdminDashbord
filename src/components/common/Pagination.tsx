import { ChevronLeft, ChevronRight } from "lucide-react";

const ACTIVE_BACKGROUND = "linear-gradient(135deg,rgb(6,106,156),rgb(38,174,144))";

/**
 * Numbered pagination with a "showing x–y of z" summary.
 * Extracted so list pages stop re-implementing the same window maths.
 */
const Pagination = ({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  disabled = false,
  itemLabel = "items",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  disabled?: boolean;
  itemLabel?: string;
}) => {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  // A five-wide window that slides to stay inside the page range.
  let start = Math.max(1, safePage - 2);
  let end = Math.min(safeTotalPages, safePage + 2);
  if (end - start < 4) {
    if (start === 1) end = Math.min(safeTotalPages, start + 4);
    else start = Math.max(1, end - 4);
  }
  const pages: number[] = [];
  for (let index = start; index <= end; index += 1) pages.push(index);

  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5 sm:flex-row">
      <p className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{from}–{to}</span> of{" "}
        <span className="font-semibold text-slate-700">{total}</span> {itemLabel}
      </p>

      {safeTotalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            aria-label="Previous page"
            disabled={disabled || safePage <= 1}
            onClick={() => onPage(safePage - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={15} />
          </button>

          {start > 1 && (
            <>
              <button
                type="button"
                onClick={() => onPage(1)}
                className="h-8 w-8 rounded-lg text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                1
              </button>
              {start > 2 && <span className="px-1 text-xs text-slate-300">…</span>}
            </>
          )}

          {pages.map((number) => (
            <button
              key={number}
              type="button"
              aria-label={`Page ${number}`}
              aria-current={number === safePage ? "page" : undefined}
              onClick={() => onPage(number)}
              className="h-8 w-8 rounded-lg text-xs font-semibold transition"
              style={
                number === safePage
                  ? { background: ACTIVE_BACKGROUND, color: "#fff" }
                  : { color: "#64748b" }
              }
            >
              {number}
            </button>
          ))}

          {end < safeTotalPages && (
            <>
              {end < safeTotalPages - 1 && (
                <span className="px-1 text-xs text-slate-300">…</span>
              )}
              <button
                type="button"
                onClick={() => onPage(safeTotalPages)}
                className="h-8 w-8 rounded-lg text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                {safeTotalPages}
              </button>
            </>
          )}

          <button
            type="button"
            aria-label="Next page"
            disabled={disabled || safePage >= safeTotalPages}
            onClick={() => onPage(safePage + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
};

export default Pagination;
