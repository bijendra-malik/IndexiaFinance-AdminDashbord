import { STATUS, percentOf, type Bucket } from "../dashboardUtils";

/**
 * "Application Status" card — dashboard ke andar wesa hi layout jesa design me
 * hai: bayen legend, beech me donut + center total, dayen count aur percentage.
 *
 * Arcs SVG paths se bante hain (stroke-dasharray circles se nahi) taaki segments
 * ke beech patla gap aa sake aur har segment ke mid-angle par percentage label
 * connector line ke saath lag sake. Zero-count status ring par nahi aata, par
 * legend aur counts me 0 dikhta rehta hai.
 *
 * Card ki height row me sabse lamba panel decide karta hai, isliye content
 * vertically center hota hai — donut card chhota hone par bhi khaali jagah
 * neeche nahi dikhti.
 */

const VIEW = { width: 320, height: 206, cx: 160, cy: 101, rOuter: 74, rInner: 58, rLabel: 96 };
const GAP = 1.1;

interface Slice {
  key: Bucket;
  count: number;
}

const polar = (radius: number, angle: number): [number, number] => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return [VIEW.cx + radius * Math.cos(radians), VIEW.cy + radius * Math.sin(radians)];
};

const arcPath = (start: number, end: number) => {
  const large = end - start > 180 ? 1 : 0;
  const [x1, y1] = polar(VIEW.rOuter, start);
  const [x2, y2] = polar(VIEW.rOuter, end);
  const [x3, y3] = polar(VIEW.rInner, end);
  const [x4, y4] = polar(VIEW.rInner, start);
  return [
    `M${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A${VIEW.rOuter} ${VIEW.rOuter} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A${VIEW.rInner} ${VIEW.rInner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
};

const StatusDonut = ({ slices, total }: { slices: Slice[]; total: number }) => {
  const drawn = slices.filter((slice) => slice.count > 0);

  let cursor = 0;
  const segments = drawn.map((slice) => {
    const sweep = (slice.count / Math.max(1, total)) * 360;
    const start = cursor;
    cursor += sweep;
    return { ...slice, start, end: start + sweep, mid: start + sweep / 2 };
  });

  const ringCenter = (VIEW.rOuter + VIEW.rInner) / 2;
  const ringWidth = VIEW.rOuter - VIEW.rInner;

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-5 pb-5 pt-1">
      <div className="grid grid-cols-[5.25rem_minmax(0,1fr)_4.5rem] items-center gap-1 sm:grid-cols-[6.25rem_minmax(0,1fr)_5rem] sm:gap-2">
        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <ul className="space-y-3 sm:space-y-3.5">
          {slices.map(({ key }) => (
            <li
              key={key}
              className="flex items-center gap-2 whitespace-nowrap text-[11px] text-slate-600"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: STATUS[key].hex }}
              />
              {key}
            </li>
          ))}
        </ul>

        {/* ── Donut ──────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 justify-center">
          <svg
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            className="h-auto w-full max-w-[310px]"
            role="img"
            aria-label={`Application status: ${slices
              .map((slice) => `${slice.count} ${slice.key.toLowerCase()}`)
              .join(", ")}`}
          >
            <circle
              cx={VIEW.cx}
              cy={VIEW.cy}
              r={ringCenter}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={ringWidth}
            />

            {total > 0 && drawn.length === 1 && (
              <circle
                cx={VIEW.cx}
                cy={VIEW.cy}
                r={ringCenter}
                fill="none"
                stroke={STATUS[drawn[0].key].hex}
                strokeWidth={ringWidth}
              />
            )}

            {total > 0 &&
              segments.length > 1 &&
              segments.map((segment) => {
                const from = segment.start + GAP / 2;
                const to = segment.end - GAP / 2;
                const [lineStartX, lineStartY] = polar(VIEW.rOuter + 6, segment.mid);
                const [lineEndX, lineEndY] = polar(VIEW.rLabel - 9, segment.mid);
                const [labelX, labelY] = polar(VIEW.rLabel - 6, segment.mid);
                const toRight = Math.cos(((segment.mid - 90) * Math.PI) / 180) >= 0;

                return (
                  <g key={segment.key}>
                    {to > from && <path d={arcPath(from, to)} fill={STATUS[segment.key].hex} />}
                    <line
                      x1={lineStartX}
                      y1={lineStartY}
                      x2={lineEndX}
                      y2={lineEndY}
                      stroke="#cbd5e1"
                      strokeWidth={1}
                      strokeLinecap="round"
                    />
                    <text
                      x={toRight ? labelX + 3 : labelX - 3}
                      y={labelY + 3.5}
                      textAnchor={toRight ? "start" : "end"}
                      fontSize={10}
                      fontWeight={500}
                      fill="#64748b"
                    >
                      {percentOf(segment.count, total).toFixed(1)}%
                    </text>
                  </g>
                );
              })}

            <text
              x={VIEW.cx}
              y={VIEW.cy + 1}
              textAnchor="middle"
              fontSize={27}
              fontWeight={700}
              fill="#0f172a"
            >
              {total.toLocaleString("en-IN")}
            </text>
            <text
              x={VIEW.cx}
              y={VIEW.cy + 19}
              textAnchor="middle"
              fontSize={10.5}
              fill="#94a3b8"
            >
              {`Total: ${total.toLocaleString("en-IN")}`}
            </text>
          </svg>
        </div>

        {/* ── Counts + percentages ───────────────────────────────────────── */}
        <ul className="space-y-3 sm:space-y-3.5">
          {slices.map(({ key, count }) => (
            <li
              key={key}
              className="grid grid-cols-[1fr_3.25rem] items-center gap-2 text-[11px] tabular-nums text-slate-600"
            >
              <span className="text-right">{count.toLocaleString("en-IN")}</span>
              <span className="text-right">{percentOf(count, total).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>

      {total === 0 && (
        <p className="mt-3 text-center text-xs text-slate-400">
          No applications returned by the API yet.
        </p>
      )}
    </div>
  );
};

export default StatusDonut;
