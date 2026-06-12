import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import type { SnapshotItem } from '../../shared/ipc'

type TimeRange = '7d' | '30d' | 'all'
type Metric = 'price' | 'rating' | 'reviews'

interface Props {
  snapshots: SnapshotItem[]
}

interface ChartPoint {
  time: string
  price: number | null
  rating: number | null
  reviews: number | null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatTooltipDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function TrendChart({ snapshots }: Props): JSX.Element {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [metric, setMetric] = useState<Metric>('price')

  const filteredData = useMemo((): ChartPoint[] => {
    const now = Date.now()
    const cutoffMs =
      timeRange === '7d'
        ? 7 * 24 * 60 * 60 * 1000
        : timeRange === '30d'
          ? 30 * 24 * 60 * 60 * 1000
          : 0

    const successful = snapshots
      .filter((s) => s.captureStatus === 'success')
      .filter((s) => (cutoffMs === 0 ? true : now - new Date(s.capturedAt).getTime() <= cutoffMs))
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())

    return successful.map((s) => ({
      time: formatDate(s.capturedAt),
      price: s.price,
      rating: s.rating,
      reviews: s.reviewCount
    }))
  }, [snapshots, timeRange])

  const metrics: Array<{ key: Metric; label: string; color: string; yLabel: string }> = [
    { key: 'price', label: 'Price ($)', color: '#2563eb', yLabel: 'Price (USD)' },
    { key: 'rating', label: 'Rating', color: '#16a34a', yLabel: 'Rating (stars)' },
    { key: 'reviews', label: 'Reviews', color: '#9333ea', yLabel: 'Review Count' }
  ]

  const activeMetric = metrics.find((m) => m.key === metric)!

  const timeRanges: Array<{ key: TimeRange; label: string }> = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: 'all', label: 'All' }
  ]

  if (snapshots.filter((s) => s.captureStatus === 'success').length === 0) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="empty-state">
            <div className="empty-state-title">No data for charts</div>
            <div className="empty-state-desc">
              Complete at least one successful capture to see trend charts.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">Trends</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Metric selector */}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="input"
            style={{ width: 120, padding: '4px 8px', fontSize: 12 }}
          >
            {metrics.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          {/* Time range */}
          {timeRanges.map((r) => (
            <button
              key={r.key}
              className={`btn ${timeRange === r.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => setTimeRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 8 }}>
        {filteredData.length < 2 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-state-desc">
              {filteredData.length === 0
                ? `No data in the selected time range.`
                : 'Need at least 2 data points for a trend line.'}
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={filteredData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                domain={metric === 'rating' ? [0, 5] : ['auto', 'auto']}
                tickFormatter={
                  metric === 'price'
                    ? (v: number) => `$${v}`
                    : metric === 'rating'
                      ? (v: number) => v.toFixed(1)
                      : (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))
                }
                width={60}
              />
              <Tooltip
                // @ts-expect-error recharts Tooltip typings are restrictive but values are safe
                labelFormatter={formatTooltipDate}
                // @ts-expect-error recharts Tooltip typings are restrictive but values are safe
                formatter={(value: number) => {
                  if (metric === 'price') return [`$${value.toFixed(2)}`, 'Price']
                  if (metric === 'rating') return [value.toFixed(1), 'Rating']
                  return [value.toLocaleString(), 'Reviews']
                }}
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(15,23,42,0.1)',
                  fontSize: 12,
                  fontFamily: 'DM Sans, sans-serif'
                }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke={activeMetric.color}
                strokeWidth={2}
                dot={{ r: 2, fill: activeMetric.color }}
                activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2, fill: activeMetric.color }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
