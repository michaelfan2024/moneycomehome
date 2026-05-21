import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GenerateReportContent from './GenerateReportContent'

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  getCompareResults: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  searchParams: new URLSearchParams()
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mocks.push,
    back: mocks.back
  }),
  useSearchParams: () => mocks.searchParams
}))

vi.mock('../../../lib/api', () => ({
  getCompareResults: mocks.getCompareResults
}))

describe('GenerateReportContent', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    mocks.searchParams = new URLSearchParams('groupId=g2&date=2026-05-21&count=1')
    mocks.getCompareResults.mockResolvedValue({
      success: true,
      data: [
        {
          id: '1',
          batch_id: 'b2',
          group_id: 'g2',
          trade_date: '2026-05-21',
          stock_code: '000001',
          stock_name: 'Ping An Bank',
          status: 'first_seen',
          continuous_count: 1,
          total_appear_count: 1,
          created_at: '2026-05-21T00:00:00.000Z'
        }
      ]
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({ success: true, data: [] })
      }))
    )
  })

  afterEach(() => {
    act(() => {
      root?.unmount()
    })
    container.remove()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('loads compare results for the group selected on the compare page', async () => {
    await act(async () => {
      root = createRoot(container)
      root.render(<GenerateReportContent />)
    })

    await vi.waitFor(() => {
      expect(mocks.getCompareResults).toHaveBeenCalledWith('2026-05-21', 'g2')
    })
  })
})
