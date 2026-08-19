interface PieChartData {
  label: string;
  value: number;
  color: string;
  /**
   * Ignored. The share of the pie is computed here, from `value`, so the legend
   * and the slices cannot disagree — they used to be calculated in two places
   * against two different totals. Kept optional so existing callers still type.
   */
  percentage?: number;
}

interface PieChartProps {
  data: PieChartData[];
  title: string;
  size?: number;
  formatValue?: (v: number) => string;
}

const RADIUS = 80;
const CX = 100;
const CY = 100;

function pointOnCircle(angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + RADIUS * Math.cos(rad), CY + RADIUS * Math.sin(rad)];
}

export function PieChart({ data, title, size = 200, formatValue }: PieChartProps) {
  /*
    A pie shows parts of a whole, so only positive values can have a slice: a
    negative return is not a fraction of anything. They are still listed below,
    with their real value, rather than dropped.

    Callers used to filter to `value > 0` before passing data in, which removed
    the row from the legend too. The Dashboard's sector header counts every
    sector, so a sector with a negative return vanished from the chart while
    still being counted above it — "3 sectors" over a two-slice pie.
  */
  const drawable = data.filter(d => d.value > 0);
  const notDrawable = data.filter(d => !(d.value > 0));
  const total = drawable.reduce((sum, item) => sum + item.value, 0);

  const share = (value: number) => (total > 0 && value > 0 ? (value / total) * 100 : 0);

  if (total <= 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ height: size + 80 }}>
        <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-sm">No data</span>
        </div>
        <p className="text-sm font-semibold text-gray-700 mt-4">{title}</p>
        {notDrawable.length > 0 && (
          <p className="text-xs text-gray-400 mt-2 text-center px-2">
            Nothing to plot — no positive values.
          </p>
        )}
      </div>
    );
  }

  type Slice =
    | { kind: 'circle'; color: string }
    | { kind: 'path'; d: string; color: string };

  const slices: Slice[] = [];
  let currentAngle = -90;

  for (const item of drawable) {
    const angle = (item.value / total) * 360;

    /*
      A slice covering the whole pie has to be drawn as a circle.

      As an arc it starts and ends on the same point, and SVG omits an arc whose
      endpoints are identical — so a single-category pie rendered as the `M`/`L`
      stroke alone: a thin line from the centre out to the edge, which is what
      "Total Dividends by Sector" was showing whenever one sector held every
      dividend.
    */
    if (angle >= 360 - 1e-9) {
      slices.push({ kind: 'circle', color: item.color });
      break;
    }

    const endAngle = currentAngle + angle;
    const [startX, startY] = pointOnCircle(currentAngle);
    const [endX, endY] = pointOnCircle(endAngle);
    const largeArcFlag = angle > 180 ? 1 : 0;

    slices.push({
      kind: 'path',
      color: item.color,
      d: [
        `M ${CX} ${CY}`,
        `L ${startX} ${startY}`,
        `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
        'Z',
      ].join(' '),
    });

    currentAngle = endAngle;
  }

  return (
    <div className="flex flex-col items-center w-full">
      <svg width={size} height={size} viewBox="0 0 200 200" className="mb-3">
        {slices.map((slice, index) =>
          slice.kind === 'circle' ? (
            <circle
              key={index}
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
              className="transition-opacity hover:opacity-80 cursor-pointer"
            />
          ) : (
            <path
              key={index}
              d={slice.d}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
              className="transition-opacity hover:opacity-80 cursor-pointer"
            />
          ),
        )}
      </svg>

      {title && <p className="text-sm font-semibold text-gray-700 mb-3 text-center">{title}</p>}

      <div className="w-full space-y-1.5">
        {data.map((item, index) => {
          const plotted = item.value > 0;
          return (
            <div key={index} className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-3 h-3 rounded-sm flex-shrink-0 ${plotted ? '' : 'opacity-40'}`}
                  style={{ backgroundColor: item.color }}
                />
                <span className={`truncate ${plotted ? 'text-gray-700' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 text-right">
                {formatValue && (
                  <span className={`font-mono ${plotted ? 'text-gray-700' : 'text-gray-400'}`}>
                    {formatValue(item.value)}
                  </span>
                )}
                {plotted ? (
                  <span className="font-bold text-gray-900">({share(item.value).toFixed(1)}%)</span>
                ) : (
                  <span className="text-gray-400" title="Not shown on the chart — a pie cannot represent a zero or negative share">
                    (not plotted)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Say that the slices are a share of the positive total, not of the net.
          Without this the percentages look like shares of everything listed. */}
      {notDrawable.length > 0 && (
        <p className="w-full text-xs text-gray-400 mt-2 leading-snug">
          Percentages are of the {formatValue ? formatValue(total) : total.toLocaleString()} positive
          total. {notDrawable.length === 1 ? 'One entry is' : `${notDrawable.length} entries are`} zero
          or negative and cannot be drawn on a pie.
        </p>
      )}
    </div>
  );
}
