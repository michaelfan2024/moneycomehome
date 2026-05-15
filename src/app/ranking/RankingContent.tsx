'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { enrichStockMetadata, getRanking, getStockGroups } from '../../lib/api'
import {
  buildRankingFilterSummary,
  exportRankingRowsToCsv,
  getRankingFilterOptions,
} from '../../lib/ranking-filters'
import {
  filterRankingTableRows,
  formatFinanceAmount,
  formatPercent,
  sortRankingTableRows,
  type RankingTableSort,
  type RankingTableSortKey,
} from '../../lib/ranking-table'
import type { EnrichedRankingResult, RankingFilters, StockGroup } from '../../types'

const DEFAULT_SORT: RankingTableSort = { key: 'continuous_count', direction: 'desc' }

function parseNumberInput(value: string): number | undefined {
  if (!value.trim()) return undefined

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function getReportPeriod(row: EnrichedRankingResult): string {
  if (row.finance?.reportType && row.finance?.reportDate) {
    return `${row.finance.reportType} ${row.finance.reportDate.slice(0, 10)}`
  }

  return row.finance?.reportType || row.finance?.reportDate?.slice(0, 10) || '-'
}

export default function RankingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [appliedGroupId, setAppliedGroupId] = useState('')
  const [results, setResults] = useState<EnrichedRankingResult[]>([])
  const [minDays, setMinDays] = useState(2)
  const [appliedMinDays, setAppliedMinDays] = useState(2)
  const [searchText, setSearchText] = useState('')
  const [appliedSearchText, setAppliedSearchText] = useState('')
  const [industrySearch, setIndustrySearch] = useState('')
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [activeFilters, setActiveFilters] = useState<RankingFilters>({})
  const [netProfitGrowthMin, setNetProfitGrowthMin] = useState('')
  const [revenueGrowthMin, setRevenueGrowthMin] = useState('')
  const [roeMin, setRoeMin] = useState('')
  const [sort, setSort] = useState<RankingTableSort>(DEFAULT_SORT)
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const urlMinDays = searchParams.get('minDays')
    const urlGroupId = searchParams.get('groupId')

    if (urlGroupId) {
      setSelectedGroupId(urlGroupId)
      setAppliedGroupId(urlGroupId)
    }

    if (urlMinDays) {
      const parsed = parseInt(urlMinDays, 10)
      if (!isNaN(parsed) && parsed >= 2) {
        setMinDays(parsed)
        setAppliedMinDays(parsed)
      }
    }
  }, [searchParams])

  useEffect(() => {
    const fetchGroups = async () => {
      const result = await getStockGroups()
      const nextGroups = result.data || []
      const defaultGroupId = nextGroups[0]?.id || ''

      setGroups(nextGroups)
      setSelectedGroupId((current) => current || defaultGroupId)
      setAppliedGroupId((current) => current || defaultGroupId)
    }

    fetchGroups()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!appliedGroupId) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await getRanking(appliedMinDays, appliedGroupId)
        setResults(result.data || [])
      } catch (error) {
        console.error('Error fetching ranking:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [appliedMinDays, appliedGroupId])

  const minDaysOptions = [
    { value: 2, label: '2天及以上' },
    { value: 3, label: '3天及以上' },
    { value: 5, label: '5天及以上' },
    { value: 10, label: '10天及以上' },
  ]

  const selectedGroup = groups.find((group) => group.id === selectedGroupId)
  const appliedGroup = groups.find((group) => group.id === appliedGroupId)
  const appliedGroupName = appliedGroup?.name || selectedGroup?.name || ''
  const filterOptions = useMemo(() => getRankingFilterOptions(results), [results])
  const visibleIndustryOptions = useMemo(() => {
    const keyword = industrySearch.trim().toLowerCase()
    return filterOptions.industries.filter((industry) => industry.toLowerCase().includes(keyword))
  }, [filterOptions.industries, industrySearch])

  const visibleResults = useMemo(() => {
    const filtered = filterRankingTableRows(results, {
      ...activeFilters,
      search: appliedSearchText,
    })

    return sortRankingTableRows(filtered, sort)
  }, [activeFilters, appliedSearchText, results, sort])

  const filterSummary = useMemo(
    () => buildRankingFilterSummary({ groupName: appliedGroupName, minDays: appliedMinDays, filters: activeFilters }),
    [activeFilters, appliedGroupName, appliedMinDays]
  )
  const metadataReadyCount = results.filter((row) => row.industry || (row.concepts || []).length > 0).length
  const hasActiveFilters = Boolean(
    appliedSearchText
    || activeFilters.industries?.length
    || activeFilters.netProfitGrowthMin !== undefined
    || activeFilters.revenueGrowthMin !== undefined
    || activeFilters.roeMin !== undefined
  )

  const toggleIndustry = (industry: string) => {
    setSelectedIndustries((current) => (
      current.includes(industry)
        ? current.filter((item) => item !== industry)
        : [...current, industry]
    ))
  }

  const handleApplyQuery = () => {
    setAppliedGroupId(selectedGroupId)
    setAppliedMinDays(minDays)
    setSort(DEFAULT_SORT)

    const params = new URLSearchParams()
    if (selectedGroupId) params.set('groupId', selectedGroupId)
    params.set('minDays', String(minDays))
    router.replace(`/ranking?${params.toString()}`)
  }

  const handleApplyFilters = () => {
    const nextFilters: RankingFilters = {}
    const netProfit = parseNumberInput(netProfitGrowthMin)
    const revenue = parseNumberInput(revenueGrowthMin)
    const roe = parseNumberInput(roeMin)

    if (selectedIndustries.length) nextFilters.industries = selectedIndustries
    if (netProfit !== undefined) nextFilters.netProfitGrowthMin = netProfit
    if (revenue !== undefined) nextFilters.revenueGrowthMin = revenue
    if (roe !== undefined) nextFilters.roeMin = roe

    setActiveFilters(nextFilters)
    setAppliedSearchText(searchText.trim())
    setMessage(null)
  }

  const handleResetFilters = () => {
    setSearchText('')
    setAppliedSearchText('')
    setIndustrySearch('')
    setSelectedIndustries([])
    setActiveFilters({})
    setNetProfitGrowthMin('')
    setRevenueGrowthMin('')
    setRoeMin('')
    setSort(DEFAULT_SORT)
    setMessage(null)
  }

  const handleSort = (key: RankingTableSortKey) => {
    setSort((current) => {
      if (current.key !== key) {
        return { key, direction: 'desc' }
      }

      return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
    })
  }

  const getSortLabel = (key: RankingTableSortKey) => {
    if (sort.key !== key) return '↕'
    return sort.direction === 'desc' ? '↓' : '↑'
  }

  const handleEnrichMetadata = async () => {
    if (results.length === 0) return

    setEnriching(true)
    setMessage(null)
    try {
      const response = await enrichStockMetadata(results.map((row) => ({
        stock_code: row.stock_code,
        stock_name: row.stock_name,
      })))

      if (!response.success) {
        setMessage(response.error || '补全行业/概念失败')
        return
      }

      const refreshed = await getRanking(appliedMinDays, appliedGroupId || undefined)
      setResults(refreshed.data || [])
      setMessage(`补全完成：请求 ${response.data?.requested || 0}，缓存 ${response.data?.cached || 0}，新增 ${response.data?.fetched || 0}，失败 ${response.data?.failed || 0}`)
    } catch (error) {
      console.error('Metadata enrichment failed:', error)
      setMessage('补全行业/概念失败')
    } finally {
      setEnriching(false)
    }
  }

  const handleExportCsv = () => {
    if (visibleResults.length === 0) return

    const csv = exportRankingRowsToCsv(visibleResults, {
      groupName: appliedGroupName,
      minDays: appliedMinDays,
      filters: activeFilters,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${new Date().toISOString().split('T')[0]}_连续${appliedMinDays}天榜单.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleGenerateReport = async () => {
    if (visibleResults.length === 0) return
    if (visibleResults.length > 50 && !window.confirm(`当前将基于 ${visibleResults.length} 只股票生成报告，可能耗时较长，是否继续？`)) {
      return
    }

    setGenerating(true)
    setMessage(null)
    const date = new Date().toISOString().split('T')[0]
    const reportTitle = activeFilters.industries?.length === 1
      ? `${date} ${activeFilters.industries[0]}连续${appliedMinDays}天+股票AI分析报告`
      : `${date} 连续${appliedMinDays}天+股票AI分析报告`

    try {
      const response = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          stocks: visibleResults,
          sourceType: 'ranking',
          filterSummary,
          reportTitle,
        }),
      })
      const data = await response.json()
      if (data.success) {
        router.push(`/wechat-editor?reportId=${encodeURIComponent(data.data.reportId)}`)
        return
      }
      setMessage(data.error || '生成AI报告失败')
    } catch (error) {
      console.error('Generate ranking report failed:', error)
      setMessage('生成AI报告失败')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-[var(--border-color)] rounded-full"></div>
          <div className="absolute inset-0 w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--primary-color)] to-red-400 bg-clip-text text-transparent">
            连续出现榜单
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">按连续出现天数排名</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">分组</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="select-field w-64"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">连续条件</label>
            <select
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              className="select-field w-48"
            >
              {minDaysOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleApplyQuery}
            disabled={!selectedGroupId}
            className="px-5 py-3 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
          >
            查询榜单
          </button>

          <div className="ml-auto text-sm text-[var(--text-muted)] pb-3">
            当前显示 {visibleResults.length} / {results.length} 只股票
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1.3fr_2fr] gap-5">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">搜索</label>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="input-field"
              placeholder="代码、名称、行业、概念"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">行业筛选</label>
            <input
              type="search"
              value={industrySearch}
              onChange={(event) => setIndustrySearch(event.target.value)}
              className="input-field mb-2"
              placeholder="搜索行业"
            />
            <div className="h-28 overflow-y-auto border border-[var(--border-color)] rounded-lg p-2 space-y-1 bg-[var(--bg-dark)]">
              {visibleIndustryOptions.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] px-2 py-1">暂无行业可筛选</p>
              )}
              {visibleIndustryOptions.map((industry) => (
                <label key={industry} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] px-2 py-1 rounded hover:bg-[var(--bg-card-hover)]">
                  <input
                    type="checkbox"
                    checked={selectedIndustries.includes(industry)}
                    onChange={() => toggleIndustry(industry)}
                  />
                  <span className="truncate">{industry}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">净利润同比 ≥ %</label>
                <input
                  type="number"
                  value={netProfitGrowthMin}
                  onChange={(event) => setNetProfitGrowthMin(event.target.value)}
                  className="input-field"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">营收同比 ≥ %</label>
                <input
                  type="number"
                  value={revenueGrowthMin}
                  onChange={(event) => setRevenueGrowthMin(event.target.value)}
                  className="input-field"
                  placeholder="30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">ROE ≥ %</label>
                <input
                  type="number"
                  value={roeMin}
                  onChange={(event) => setRoeMin(event.target.value)}
                  className="input-field"
                  placeholder="10"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                onClick={handleApplyFilters}
                className="px-5 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
              >
                应用筛选
              </button>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                重置
              </button>
              <span className="text-sm text-[var(--text-muted)]">
                行业/概念已补全 {metadataReadyCount} / {results.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-[var(--border-color)]">
          <button
            onClick={handleEnrichMetadata}
            disabled={enriching || results.length === 0}
            className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
          >
            {enriching ? '补全中...' : '补全行业/概念数据'}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={visibleResults.length === 0}
            className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
          >
            导出CSV ({visibleResults.length}条)
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generating || visibleResults.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-[var(--primary-color)] to-red-500 text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? '生成中...' : '生成AI分析报告'}
          </button>
          {message && <span className="text-sm text-[var(--text-secondary)]">{message}</span>}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px]">
            <thead className="bg-[var(--bg-dark)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">股票代码</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">股票名称</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                  <button onClick={() => handleSort('continuous_count')} className="hover:text-[var(--primary-color)]">
                    连续天数 {getSortLabel('continuous_count')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">
                  <button onClick={() => handleSort('total_appear_count')} className="hover:text-[var(--primary-color)]">
                    总出现 {getSortLabel('total_appear_count')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">行业</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">概念</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">最近财报</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">
                  <button onClick={() => handleSort('netProfit')} className="hover:text-[var(--primary-color)]">
                    净利润 {getSortLabel('netProfit')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">
                  <button onClick={() => handleSort('netProfitYoy')} className="hover:text-[var(--primary-color)]">
                    净利润同比 {getSortLabel('netProfitYoy')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">
                  <button onClick={() => handleSort('revenueYoy')} className="hover:text-[var(--primary-color)]">
                    营收同比 {getSortLabel('revenueYoy')}
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase">
                  <button onClick={() => handleSort('roe')} className="hover:text-[var(--primary-color)]">
                    ROE {getSortLabel('roe')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]/50">
              {visibleResults.map((row) => (
                <tr
                  key={`${row.batch_id}-${row.stock_code}`}
                  className="hover:bg-[var(--bg-card-hover)] transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-sm font-mono text-[var(--text-primary)]">{row.stock_code}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{row.stock_name}</td>
                  <td className="px-4 py-3 text-sm text-[var(--primary-color)] font-medium">{row.continuous_count} 天</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{row.total_appear_count} 次</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{row.industry || '未分类'}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)] max-w-64 truncate" title={(row.concepts || []).join(' / ')}>
                    {(row.concepts || []).slice(0, 3).join(' / ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-muted)]">{getReportPeriod(row)}</td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">{formatFinanceAmount(row.finance?.netProfit)}</td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">{formatPercent(row.finance?.netProfitYoy)}</td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">{formatPercent(row.finance?.revenueYoy)}</td>
                  <td className="px-4 py-3 text-sm text-right text-[var(--text-secondary)]">{formatPercent(row.finance?.roe)}</td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => router.push(appliedGroupId ? `/detail/${row.stock_code}?groupId=${appliedGroupId}` : `/detail/${row.stock_code}`)}
                      className="text-[var(--primary-color)] hover:text-[var(--primary-dark)] font-medium transition-colors"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visibleResults.length === 0 && (
            <div className="px-4 py-12 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-dark)] flex items-center justify-center">
                <span className="text-xl">📭</span>
              </div>
              <p className="text-[var(--text-muted)]">当前条件下暂无股票</p>
              {hasActiveFilters && (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">{filterSummary}</p>
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
                  >
                    清空筛选
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
