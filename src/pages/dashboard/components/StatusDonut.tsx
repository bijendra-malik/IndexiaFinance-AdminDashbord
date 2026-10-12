import { STATUS, percentOf, type Bucket } from "../dashboardUtils";

const SIZE = 180;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Slice {
  key: Bucket;
  count: number;
}

/**
 * Hand-rolled SVG donut — no charting dependency. Arcs are drawn with
 * stroke-dasharray so the browser handles the geometry, and every slice is
 * skipped when its count is zero (zero-length arcs render as stray caps).
 */
const StatusDonut = ({ slices, total }: { slices: Slice[]; total: number }) => {
  const drawn = slices.filter((slice) => slice.count > 0);
  const lengths = drawn.map(
    (slice) => (slice.count / Math.max(1, total)) * CIRCUMFERENCE
  );
  // Pure prefix sum: no accumulator mutation during render.
  const arcs = drawn.map((slice, index) => ({
    key: slice.key,
    length: lengths[index],
    offset: lengths.slice(0, index).reduce((sum, value) => sum + value, 0),
  }));

  return (
    <div className="flex flex-col items-center gap-5 px-5 pb-5">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Application status: ${slices
          .map((slice) => `${slice.count} ${slice.key.toLowerCase()}`)
          .join(", ")}`}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={STROKE}
        />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={STATUS[arc.key].hex}
            strokeWidth={STROKE}
            strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        ))}
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 2}
          textAnchor="middle"
          fontSize="30"
          fontWeight="700"
          fill="#0f172a"
        >
          {total.toLocaleString("en-IN")}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 18}
          textAnchor="middle"
          fontSize="10"
          letterSpacing="1.6"
          fill="#94a3b8"
        >
          APPLICATIONS
        </text>
      </svg>

      <ul className="w-full space-y-2">
        {slices.map(({ key, count }) => (
          <li key={key} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: STATUS[key].hex }}
            />
            <span className="text-slate-600">{key}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-800">{count}</span>
            <span className="w-14 text-right text-xs tabular-nums text-slate-400">
              {percentOf(count, total).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>

      {total === 0 && (
        <p className="text-xs text-slate-400">No applications returned by the API yet.</p>
      )}
    </div>
  );
};

export default StatusDonut;
