'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StockTable from '../../components/StockTable'
import { enrichStockMetadata, getRanking, getStockGroups } from '../../lib/api'
import {
  buildRankingFilterSummary,
  exportRankingRowsToCsv,
  filterRankingRows,
  getRankingFilterOptions,
} from '../../lib/ranking-filters'
import type { EnrichedRankingResult, RankingFilters, StockGroup } from '../../types'

export default function RankingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [results, setResults] = useState<EnrichedRankingResult[]>([])
  const [minDays, setMinDays] = useState(2)
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([])
  const [selectedConcepts, setSelectedConcepts] = useState<string[]>([])
  const [netProfitGrowthMin, setNetProfitGrowthMin] = useState('')
  const [revenueGrowthMin, setRevenueGrowthMin] = useState('')
  const [roeMin, setRoeMin] = useState('')
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const urlMinDays = searchParams.get('minDays')
    const urlGroupId = searchParams.get('groupId')
    if (urlGroupId) {
      setSelectedGroupId(urlGroupId)
    }
    if (urlMinDays) {
      const parsed = parseInt(urlMinDays, 10)
      if (!isNaN(parsed) && parsed >= 2) {
        setMinDays(parsed)
      }
    }
  }, [searchParams])

  useEffect(() => {
    const fetchGroups = async () => {
      const result = await getStockGroups()
      const nextGroups = result.data || []
      setGroups(nextGroups)
      setSelectedGroupId((current) => current || nextGroups[0]?.id || '')
    }

    fetchGroups()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await getRanking(minDays, selectedGroupId || undefined)
        setResults(result.data || [])
      } catch (error) {
        console.error('Error fetching ranking:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [minDays, selectedGroupId])

  const minDaysOptions = [
    { value: 2, label: '2天及以上' },
    { value: 3, label: '3天及以上' },
    { value: 5, label: '5天及以上' },
    { value: 10, label: '10天及以上' },
  ]

  const selectedGroup = groups.find((group) => group.id === selectedGroupId)
  const selectedGroupName = selectedGroup?.name || ''
  const filterOptions = useMemo(() => getRankingFilterOptions(results), [results])

  const activeFilters = useMemo<RankingFilters>(() => {
    const filters: RankingFilters = {}
    if (selectedIndustries.length) filters.industries = selectedIndustries
    if (selectedConcepts.length) filters.concepts = selectedConcepts

    const netProfit = Number(netProfitGrowthMin)
    if (netProfitGrowthMin.trim() && Number.isFinite(netProfit)) {
      filters.netProfitGrowthMin = netProfit
    }

    const revenue = Number(revenueGrowthMin)
    if (revenueGrowthMin.trim() && Number.isFinite(revenue)) {
      filters.revenueGrowthMin = revenue
    }

    const roe = Number(roeMin)
    if (roeMin.trim() && Number.isFinite(roe)) {
      filters.roeMin = roe
    }

    return filters
  }, [selectedConcepts, selectedIndustries, netProfitGrowthMin, revenueGrowthMin, roeMin])

  const filteredResults = useMemo(
    () => filterRankingRows(results, activeFilters),
    [activeFilters, results]
  )
  const filterSummary = useMemo(
    () => buildRankingFilterSummary({ groupName: selectedGroupName, minDays, filters: activeFilters }),
    [activeFilters, minDays, selectedGroupName]
  )
  const metadataReadyCount = results.filter((row) => row.industry || (row.concepts || []).length > 0).length

  const readMultiSelect = (select: HTMLSelectElement): string[] => {
    return Array.from(select.selectedOptions).map((option) => option.value)
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

      const refreshed = await getRanking(minDays, selectedGroupId || undefined)
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
    if (filteredResults.length === 0) return

    const csv = exportRankingRowsToCsv(filteredResults, {
      groupName: selectedGroupName,
      minDays,
      filters: activeFilters,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${new Date().toISOString().split('T')[0]}_连续${minDays}天榜单.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const handleGenerateReport = async () => {
    if (filteredResults.length === 0) return
    if (filteredResults.length > 50 && !window.confirm(`当前将基于 ${filteredResults.length} 只股票生成报告，可能耗时较长，是否继续？`)) {
      return
    }

    setGenerating(true)
    setMessage(null)
    const date = new Date().toISOString().split('T')[0]
    const reportTitle = selectedIndustries.length === 1
      ? `${date} ${selectedIndustries[0]}连续${minDays}天+股票AI分析报告`
      : `${date} 连续${minDays}天+股票AI分析报告`

    try {
      const response = await fetch('/api/report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          stocks: filteredResults,
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
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">分组</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="select-field w-auto"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">筛选条件</label>
            <select
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              className="select-field w-auto"
            >
              {minDaysOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto">
            <span className="text-sm text-[var(--text-muted)]">🏆 当前显示 {filteredResults.length} / {results.length} 只股票</span>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">行业</label>
            <select
              multiple
              value={selectedIndustries}
              onChange={(event) => setSelectedIndustries(readMultiSelect(event.currentTarget))}
              className="select-field h-28"
            >
              {filterOptions.industries.map((industry) => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">概念</label>
            <select
              multiple
              value={selectedConcepts}
              onChange={(event) => setSelectedConcepts(readMultiSelect(event.currentTarget))}
              className="select-field h-28"
            >
              {filterOptions.concepts.map((concept) => (
                <option key={concept} value={concept}>{concept}</option>
              ))}
            </select>
          </div>

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
          <span className="text-sm text-[var(--text-muted)]">
            行业/概念已补全 {metadataReadyCount} / {results.length}
          </span>
          <button
            onClick={handleEnrichMetadata}
            disabled={enriching || results.length === 0}
            className="px-4 py-2 border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
          >
            {enriching ? '补全中...' : '补全行业/概念数据'}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={filteredResults.length === 0}
            className="px-4 py-2 bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50"
          >
            导出CSV ({filteredResults.length}条)
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generating || filteredResults.length === 0}
            className="px-4 py-2 bg-gradient-to-r from-[var(--primary-color)] to-red-500 text-black rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {generating ? '生成中...' : '生成AI分析报告'}
          </button>
          {message && <span className="text-sm text-[var(--text-secondary)]">{message}</span>}
        </div>
      </div>

      {filteredResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <p className="text-sm text-[var(--text-secondary)]">冠军 🥇</p>
            <p className="text-xl font-bold text-[var(--text-primary)]">{filteredResults[0]?.stock_name}</p>
            <p className="text-sm text-[var(--primary-color)]">{filteredResults[0]?.continuous_count} 天连续</p>
          </div>
          {filteredResults.length > 1 && (
            <div className="stat-card">
              <p className="text-sm text-[var(--text-secondary)]">亚军 🥈</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{filteredResults[1]?.stock_name}</p>
              <p className="text-sm text-[var(--primary-color)]">{filteredResults[1]?.continuous_count} 天连续</p>
            </div>
          )}
          {filteredResults.length > 2 && (
            <div className="stat-card">
              <p className="text-sm text-[var(--text-secondary)]">季军 🥉</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">{filteredResults[2]?.stock_name}</p>
              <p className="text-sm text-[var(--primary-color)]">{filteredResults[2]?.continuous_count} 天连续</p>
            </div>
          )}
        </div>
      )}

      <StockTable
        data={filteredResults}
        columns={['stock_code', 'stock_name', 'continuous_count', 'total_appear_count']}
        showActions
        groupId={selectedGroupId}
      />
    </div>
  )
}
