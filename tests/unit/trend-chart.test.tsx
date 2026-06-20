import { describe, expect, it, vi } from 'vitest'
import { buildDailyTrendData } from '../../src/renderer/components/TrendChart'
import type { SnapshotItem } from '../../src/shared/ipc'

function snapshot(data: Partial<SnapshotItem>): SnapshotItem {
  return {
    id: data.id ?? 1,
    title: data.title ?? 'Product',
    price: data.price ?? null,
    currency: data.currency ?? 'USD',
    priceType: data.priceType ?? null,
    regularPrice: data.regularPrice ?? null,
    listPrice: data.listPrice ?? null,
    deliveryLocation: data.deliveryLocation ?? null,
    rating: data.rating ?? null,
    reviewCount: data.reviewCount ?? null,
    availability: data.availability ?? 'In Stock',
    imageUrl: data.imageUrl ?? null,
    capturedAt: data.capturedAt ?? '2026-06-15T00:00:00Z',
    captureStatus: data.captureStatus ?? 'success',
    errorType: data.errorType ?? null,
    errorMessage: data.errorMessage ?? null
  }
}

describe('buildDailyTrendData', () => {
  it('keeps the latest successful snapshot per day', () => {
    const data = buildDailyTrendData(
      [
        snapshot({ id: 1, capturedAt: '2026-06-15T01:00:00Z', price: 10 }),
        snapshot({ id: 2, capturedAt: '2026-06-15T12:00:00Z', price: 12 }),
        snapshot({ id: 3, capturedAt: '2026-06-16T01:00:00Z', price: 14 }),
        snapshot({ id: 4, capturedAt: '2026-06-16T02:00:00Z', price: 99, captureStatus: 'failed' })
      ],
      'all',
      'price'
    )

    expect(data.map((point) => point.price)).toEqual([12, 14])
  })

  it('filters by selected time range before grouping', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))

    const data = buildDailyTrendData(
      [
        snapshot({ capturedAt: '2026-06-01T12:00:00Z', price: 8 }),
        snapshot({ capturedAt: '2026-06-10T12:00:00Z', price: 10 }),
        snapshot({ capturedAt: '2026-06-15T12:00:00Z', price: 12 })
      ],
      '7d',
      'price'
    )

    expect(data.map((point) => point.price)).toEqual([10, 12])
    vi.useRealTimers()
  })
})
