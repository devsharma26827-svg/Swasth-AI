import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { TrendingUp, Activity, Heart, Scale, Footprints, Info, Calendar } from 'lucide-react';
import { trendsApi } from '../services/api';
import { TrendDataset } from '../types';

export const TrendsScreen: React.FC = () => {
  const [trends, setTrends] = useState<TrendDataset[]>([]);
  const [activeMetric, setActiveMetric] = useState<string>('hr');
  const [activeRange, setActiveRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrends();
  }, []);

  const loadTrends = async () => {
    setIsLoading(true);
    try {
      const res = await trendsApi.getAll();
      setTrends(res.trends);
    } catch (err) {
      console.warn('Failed to load trends from server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDataset = trends.find(t => t.metric === activeMetric) || trends[0];

  const metricTabs = [
    { id: 'hr', label: 'Heart Rate', icon: Heart, unit: 'BPM' },
    { id: 'hrv', label: 'HRV', icon: Activity, unit: 'ms' },
    { id: 'spo2', label: 'Est. SpO₂', icon: Activity, unit: '%' },
    { id: 'weight', label: 'Weight', icon: Scale, unit: 'kg' },
    { id: 'gait', label: 'Cadence', icon: Footprints, unit: 'spm' }
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-24 animate-fade-in">
      <div className="rounded-3xl border border-[#EAE7DE] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Longitudinal Analytics
            </span>
            <h1 className="text-xl font-black text-[#1F2421] mt-0.5">Health Trend Engine</h1>
          </div>
          {/* Time range switcher */}
          <div className="flex rounded-xl bg-gray-100 p-1 text-[11px] font-semibold text-gray-600">
            {(['daily', 'weekly', 'monthly'] as const).map(r => (
              <button
                key={r}
                onClick={() => setActiveRange(r)}
                className={`rounded-lg px-2.5 py-1 capitalize transition-all ${
                  activeRange === r ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'hover:text-gray-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Selector Pills */}
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {metricTabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = activeMetric === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMetric(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-[#15803D] text-white border-[#15803D] shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Dataset Chart Container */}
        {selectedDataset && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs text-gray-500 font-medium">Latest Measurement</span>
                <div className="text-2xl font-black text-gray-900">
                  {selectedDataset.currentValue}{' '}
                  <span className="text-xs font-normal text-gray-500">{selectedDataset.unit}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-gray-500 font-medium">30-Day Baseline</span>
                <div className="text-sm font-bold text-gray-700">
                  {selectedDataset.baselineAverage} {selectedDataset.unit}
                </div>
                <div
                  className={`text-[10px] font-bold ${
                    selectedDataset.direction === 'stable'
                      ? 'text-[#15803D]'
                      : 'text-amber-700'
                  }`}
                >
                  {selectedDataset.percentageChange >= 0
                    ? `+${selectedDataset.percentageChange}%`
                    : `${selectedDataset.percentageChange}%`}{' '}
                  ({selectedDataset.direction})
                </div>
              </div>
            </div>

            {/* Recharts Chart Area */}
            <div className="mt-4 h-56 w-full">
              {selectedDataset.insufficientData ? (
                <div className="flex h-full items-center justify-center rounded-2xl bg-gray-50 p-4 text-center text-xs text-gray-500">
                  Not enough data yet. Complete at least 3 checkups to generate a multi-day trend.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={selectedDataset.dataPoints}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEA" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#6B7280' }}
                      axisLine={{ stroke: '#E5E7EB' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={['dataMin - 4', 'dataMax + 4']}
                      tick={{ fontSize: 10, fill: '#6B7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-gray-200 bg-white p-2 text-xs shadow-md">
                              <div className="font-bold text-gray-900">
                                {data.value} {data.unit}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                Date: {data.date} • Baseline: {data.baseline}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* Baseline guide line */}
                    <ReferenceLine
                      y={selectedDataset.baselineAverage}
                      stroke="#9CA3AF"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Baseline',
                        position: 'right',
                        fontSize: 9,
                        fill: '#9CA3AF'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#15803D"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#15803D' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Scientific Interpretation Card */}
            <div className="mt-4 rounded-2xl bg-[#FAF9F6] p-3.5 border border-[#EAE7DE] text-xs space-y-1">
              <span className="font-bold text-gray-900 block">Trend Observation</span>
              <p className="text-gray-700 leading-relaxed">{selectedDataset.insight}</p>
            </div>

            {/* Safe boundaries notice */}
            <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-500">
              <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
              <span>
                Trends represent physiological fluctuations and are not clinical biomarkers. Contact a healthcare provider for any persistent abnormal pattern.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
