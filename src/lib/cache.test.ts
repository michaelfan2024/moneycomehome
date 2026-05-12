import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCache, invalidateAllCaches, setCache } from './cache'

describe('cache', () => {
  afterEach(() => {
    vi.useRealTimers()
    invalidateAllCaches()
  })

  it('keeps page data warm for several minutes between reads', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-12T00:00:00.000Z'))

    setCache('dashboard_overview_6', { ready: true })

    vi.advanceTimersByTime(2 * 60 * 1000)

    expect(getCache<{ ready: boolean }>('dashboard_overview_6')).toEqual({ ready: true })
  })
})
