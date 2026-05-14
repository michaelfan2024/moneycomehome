'use client'

import type { StockPoolItem, StockCompareResult } from '../types'
import { useRouter } from 'next/navigation'
import { memo, useMemo } from 'react'

interface StockTableProps {
  data: (StockPoolItem | StockCompareResult)[]
  columns?: string[]
  showActions?: boolean
  groupId?: string
}

function StockTable({ data, columns, showActions = false, groupId }: StockTableProps) {
  const router = useRouter()
  const displayColumns = useMemo(() => columns || ['stock_code', 'stock_name', 'source', 'note'], [columns])
  
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'first_seen': '首次出现',
      'new': '新增',
      'continued': '继续存在',
      'removed': '剔除',
      'reappeared': '重新出现'
    }
    return labels[status] || status
  }
  
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'first_seen': 'status-first-seen',
      'new': 'status-new',
      'continued': 'status-continued',
      'removed': 'status-removed',
      'reappeared': 'status-reappeared'
    }
    return colors[status] || 'status-continued'
  }

  const handleViewDetail = (code: string) => {
    router.push(groupId ? `/detail/${code}?groupId=${groupId}` : `/detail/${code}`)
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[var(--bg-dark)]">
            <tr>
              {displayColumns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider"
                >
                  {col === 'stock_code' && '股票代码'}
                  {col === 'stock_name' && '股票名称'}
                  {col === 'source' && '来源策略'}
                  {col === 'note' && '备注'}
                  {col === 'status' && '状态'}
                  {col === 'continuous_count' && '连续天数'}
                  {col === 'total_appear_count' && '总出现次数'}
                </th>
              ))}
              {showActions && <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">操作</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]/50">
            {data.map((item, index) => (
              <tr 
                key={index} 
                className="hover:bg-[var(--bg-card-hover)] transition-colors duration-150 cursor-pointer"
                onClick={() => showActions && handleViewDetail(item.stock_code)}
              >
                {displayColumns.map((col) => (
                  <td key={col} className="px-4 py-3 text-sm">
                    {col === 'stock_code' && (
                      <span className="font-mono text-[var(--text-primary)]">{item.stock_code}</span>
                    )}
                    {col === 'stock_name' && (
                      <span className="text-[var(--text-secondary)]">{item.stock_name}</span>
                    )}
                    {col === 'source' && (
                      <span className="text-[var(--text-muted)]">{(item as StockPoolItem).source || '-'}</span>
                    )}
                    {col === 'note' && (
                      <span className="text-[var(--text-muted)]">{(item as StockPoolItem).note || '-'}</span>
                    )}
                    {col === 'status' && (
                      <span className={`status-badge ${getStatusColor((item as StockCompareResult).status)}`}>
                        {getStatusLabel((item as StockCompareResult).status)}
                      </span>
                    )}
                    {col === 'continuous_count' && (
                      <span className={`font-medium ${(item as StockCompareResult).continuous_count >= 5 ? 'text-[var(--primary-color)]' : 'text-[var(--text-secondary)]'}`}>
                        {(item as StockCompareResult).continuous_count} 天
                      </span>
                    )}
                    {col === 'total_appear_count' && (
                      <span className="text-[var(--text-secondary)]">{(item as StockCompareResult).total_appear_count} 次</span>
                    )}
                  </td>
                ))}
                {showActions && (
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleViewDetail(item.stock_code)
                      }}
                      className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] font-medium transition-colors"
                    >
                      查看详情
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length === 0 && (
          <div className="px-4 py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-dark)] flex items-center justify-center">
              <span className="text-xl">📭</span>
            </div>
            <p className="text-[var(--text-muted)]">暂无数据</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(StockTable)
