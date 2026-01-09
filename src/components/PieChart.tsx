interface PieChartData {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface PieChartProps {
  data: PieChartData[];
  title: string;
  size?: number;
}

export function PieChart({ data, title, size = 200 }: PieChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ height: size + 80 }}>
        <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-sm">No data</span>
        </div>
        <p className="text-sm font-semibold text-gray-700 mt-4">{title}</p>
      </div>
    );
  }

  let currentAngle = -90;
  const paths: { d: string; color: string; percentage: number }[] = [];

  data.forEach(item => {
    const percentage = (item.value / total) * 100;
    const angle = (percentage / 100) * 360;
    const endAngle = currentAngle + angle;

    const startX = 100 + 80 * Math.cos((currentAngle * Math.PI) / 180);
    const startY = 100 + 80 * Math.sin((currentAngle * Math.PI) / 180);
    const endX = 100 + 80 * Math.cos((endAngle * Math.PI) / 180);
    const endY = 100 + 80 * Math.sin((endAngle * Math.PI) / 180);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M 100 100`,
      `L ${startX} ${startY}`,
      `A 80 80 0 ${largeArcFlag} 1 ${endX} ${endY}`,
      `Z`
    ].join(' ');

    paths.push({ d: pathData, color: item.color, percentage });
    currentAngle = endAngle;
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 200 200" className="mb-4">
        {paths.map((path, index) => (
          <g key={index}>
            <path
              d={path.d}
              fill={path.color}
              stroke="white"
              strokeWidth="2"
              className="transition-opacity hover:opacity-80 cursor-pointer"
            />
          </g>
        ))}
      </svg>

      <p className="text-sm font-semibold text-gray-700 mb-3">{title}</p>

      <div className="w-full space-y-1.5">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-700">{item.label}</span>
            </div>
            <span className="font-semibold text-gray-900">
              {item.percentage.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
