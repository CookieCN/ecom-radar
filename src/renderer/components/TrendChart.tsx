import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useT } from '../i18n'
import type { SnapshotItem } from '../../shared/ipc'

type TimeRange = '7d' | '30d' | 'all'
type Metric = 'price' | 'rating' | 'reviews'

interface Props { snapshots: SnapshotItem[] }

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function TrendChart({ snapshots }: Props): JSX.Element {
  const t = useT()
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [metric, setMetric] = useState<Metric>('price')

  const filteredData = useMemo(() => {
    const now = Date.now()
    const cutoff = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 0
    const cutoffMs = cutoff * 24 * 60 * 60 * 1000
    return snapshots
      .filter((s) => s.captureStatus === 'success')
      .filter((s) => cutoffMs === 0 || now - new Date(s.capturedAt).getTime() <= cutoffMs)
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
      .map((s) => ({ time: formatDate(s.capturedAt), price: s.price, rating: s.rating, reviews: s.reviewCount }))
  }, [snapshots, timeRange])

  const metrics = [
    { key: 'price' as Metric, label: t('charts.price'), color: '#2563eb' },
    { key: 'rating' as Metric, label: t('charts.rating'), color: '#16a34a' },
    { key: 'reviews' as Metric, label: t('charts.reviews'), color: '#9333ea' },
  ]

  const hasData = snapshots.filter((s) => s.captureStatus === 'success').length > 0
  if (!hasData) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="empty-state"><div className="empty-state-title">{t('charts.noData')}</div><div className="empty-state-desc">{t('charts.noDataDesc')}</div></div>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-title">{t('charts.trends')}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} className="input" style={{ width: 120, padding: '4px 8px', fontSize: 12 }}>
            {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          {(['7d', '30d', 'all'] as TimeRange[]).map((r) => (
            <button key={r} className={`btn ${timeRange === r ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setTimeRange(r)}>
              {r === 'all' ? 'All' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 8 }}>
        {filteredData.length < 2 ? (
          <div className="empty-state" style={{ padding: '32px 0' }}>
            <div className="empty-state-desc">{filteredData.length === 0 ? t('charts.noRange') : t('charts.needPoints')}</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={filteredData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={metric === 'rating' ? [0, 5] : ['auto', 'auto']}
                tickFormatter={metric === 'price' ? (v: number) => `$${v}` : metric === 'rating' ? (v: number) => v.toFixed(1) : (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={60} />
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Tooltip {...({ contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(15,23,42,0.1)', fontSize: 12, fontFamily: 'sans-serif' }, labelFormatter: (l: string) => new Date(l).toLocaleString(), formatter: (v: number) => metric === 'price' ? [`$${v.toFixed(2)}`, 'Price'] : metric === 'rating' ? [v.toFixed(1), 'Rating'] : [v.toLocaleString(), 'Reviews'] } as any)} />
              <Line type="monotone" dataKey={metric} stroke={metrics.find((m) => m.key === metric)!.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
