import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { WindowPowerStats } from '../../core/power';

interface SolarYieldChartProps {
  powerStats: WindowPowerStats | null;
  stepIndex: number;
}

export function SolarYieldChart({ powerStats, stepIndex }: SolarYieldChartProps) {
  const data = useMemo(() => {
    if (!powerStats) return [];
    const arr: { hr: number; watts: number }[] = [];
    // Downsample 720 -> 180 points (4h step) for crisp, fast chart rendering
    for (let i = 0; i < powerStats.hourlyPowerW.length; i += 4) {
      arr.push({
        hr: i,
        watts: Math.round(powerStats.hourlyPowerW[i]),
      });
    }
    return arr;
  }, [powerStats]);

  if (!powerStats) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-slate-500">
        Computing solar curve...
      </div>
    );
  }

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="hr"
            tick={{ fontSize: 9, fill: '#64748b' }}
            tickFormatter={(v) => `${Math.round(v / 24)}d`}
            stroke="#1e293b"
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#64748b' }}
            unit="W"
            stroke="#1e293b"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0b0f17',
              borderColor: '#1e293b',
              fontSize: '11px',
              fontFamily: 'IBM Plex Mono',
            }}
            labelFormatter={(v) => `Hour ${v} (Day ${(Number(v) / 24).toFixed(1)})`}
            formatter={(value: number) => [`${value} W`, 'Array Power']}
          />
          <Area
            type="monotone"
            dataKey="watts"
            stroke="#f5b041"
            strokeWidth={1.5}
            fill="#f5b041"
            fillOpacity={0.2}
            isAnimationActive={false}
          />
          <ReferenceLine
            x={Math.floor(stepIndex / 4) * 4}
            stroke="#e2e8f0"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
