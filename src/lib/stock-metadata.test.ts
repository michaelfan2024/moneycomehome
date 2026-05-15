import { describe, expect, it, vi } from 'vitest'
import { isStockMetadataStale, normalizeStockMetadata, parseEastmoneyMetadataPayload } from './stock-metadata'

describe('stock metadata helpers', () => {
  it('normalizes industry and concepts without empty or duplicate values', () => {
    expect(normalizeStockMetadata({
      stock_code: '688001',
      stock_name: '半导体A',
      industry: ' 半导体 ',
      concepts: ['芯片', '', ' 人工智能 ', '芯片'],
      source: 'eastmoney',
    })).toEqual({
      stock_code: '688001',
      stock_name: '半导体A',
      industry: '半导体',
      concepts: ['芯片', '人工智能'],
      source: 'eastmoney',
    })
  })

  it('treats metadata older than seven days as stale', () => {
    vi.setSystemTime(new Date('2026-05-15T00:00:00Z'))

    expect(isStockMetadataStale('2026-05-01T00:00:00Z')).toBe(true)
    expect(isStockMetadataStale('2026-05-14T00:00:00Z')).toBe(false)

    vi.useRealTimers()
  })

  it('parses Eastmoney industry and concept payload into normalized metadata', () => {
    const parsed = parseEastmoneyMetadataPayload('688001', '半导体A', {
      EM2016: '电子-半导体-集成电路',
      BLGAINIAN: '芯片,人工智能,国产替代',
    })

    expect(parsed?.industry).toBe('集成电路')
    expect(parsed?.concepts).toEqual(['芯片', '人工智能', '国产替代'])
  })
})
