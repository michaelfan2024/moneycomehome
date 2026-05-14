'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import StatsCard from '../components/StatsCard'
import WisdomCard from '../components/WisdomCard'
import { getDashboardOverview, deleteBatchById, updateBatchDate, recalculateCompareResults } from '../lib/api'
import type { DashboardStats, StockBatch, StockGroup } from '../types'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [groups, setGroups] = useState<StockGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [batches, setBatches] = useState<StockBatch[]>([])
  const [totalBatchCount, setTotalBatchCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDateValue, setEditDateValue] = useState<string>('')

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const result = await getDashboardOverview(selectedGroupId || undefined)
      const selected = selectedGroupId || result.data?.selectedGroupId || ''
      if (!selectedGroupId && selected) {
        setSelectedGroupId(selected)
      }
      setGroups(result.data?.groups || [])
      setStats(result.data?.stats || null)
      setBatches(result.data?.batches || [])
      setTotalBatchCount(result.data?.totalBatchCount || 0)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [selectedGroupId])

  const handleCardClick = (filterType: string) => {
    router.push(`/compare?groupId=${selectedGroupId}&filter=${filterType}`)
  }

  const handleRankingClick = (minDays: number) => {
    router.push(`/ranking?groupId=${selectedGroupId}&minDays=${minDays}`)
  }

  const formatDate = (dateString: string) => {
    return dateString.split('T')[0]
  }

  const handleDelete = async (batchId: number) => {
    if (!confirm('确定要删除这条上传记录吗？')) return
    
    setDeletingId(batchId)
    try {
      const result = await deleteBatchById(batchId, selectedGroupId)
      if (result.success) {
        await fetchDashboardData()
      } else {
        alert('删除失败')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const handleEditStart = (batch: StockBatch) => {
    setEditingId(parseInt(String(batch.id)))
    setEditDateValue(formatDate(batch.batch_date))
  }

  const handleEditSave = async (batchId: number) => {
    if (!editDateValue) {
      alert('请选择日期')
      return
    }
    
    console.log('Updating batch', batchId, 'to date:', editDateValue)
    
    try {
      const result = await updateBatchDate(batchId, editDateValue, selectedGroupId)
      console.log('API response:', result)
      
      if (result.success) {
        setEditingId(null)
        setEditDateValue('')
        await fetchDashboardData()
        console.log('Local state updated successfully')
      } else {
        console.error('API update failed:', result.error)
        alert(result.error || '更新失败')
      }
    } catch (error) {
      console.error('Update date error:', error)
      alert('更新失败')
    }
  }

  const handleEditCancel = () => {
    setEditingId(null)
    setEditDateValue('')
  }

  const [recalculating, setRecalculating] = useState(false)
  
  const handleRecalculate = async () => {
    if (totalBatchCount < 2) {
      alert('至少需要两份数据才能进行对比')
      return
    }
    
    setRecalculating(true)
    try {
      const result = await recalculateCompareResults(selectedGroupId)
      if (result.success) {
        await fetchDashboardData()
      } else {
        console.error('Recalculation failed:', result.error)
      }
    } catch (error) {
      console.error('Recalculate error:', error)
    } finally {
      setRecalculating(false)
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
      <WisdomCard />

      <div className="card p-4">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">当前分组</label>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="select-field max-w-xs"
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="今日股票池"
          value={stats?.today_count || 0}
          icon="📊"
          trend={stats?.today_count && stats?.today_count > 0 ? 'up' : 'stable'}
          onClick={() => handleCardClick('all')}
        />
        <StatsCard
          title="今日新增"
          value={stats?.today_new || 0}
          icon="🆕"
          trend={stats?.today_new && stats?.today_new > 0 ? 'up' : 'stable'}
          onClick={() => handleCardClick('new')}
        />
        <StatsCard
          title="今日剔除"
          value={stats?.today_removed || 0}
          icon="❌"
          trend={stats?.today_removed && stats?.today_removed > 0 ? 'down' : 'stable'}
          onClick={() => handleCardClick('removed')}
        />
        <StatsCard
          title="连续3天+"
          value={stats?.continuous_3d_count || 0}
          icon="🔥"
          trend={stats?.continuous_3d_count && stats?.continuous_3d_count > 0 ? 'up' : 'stable'}
          onClick={() => handleRankingClick(3)}
        />
        <StatsCard
          title="连续5天+"
          value={stats?.continuous_5d_count || 0}
          icon="⭐"
          trend={stats?.continuous_5d_count && stats?.continuous_5d_count > 0 ? 'up' : 'stable'}
          onClick={() => handleRankingClick(5)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-color)] to-red-600 flex items-center justify-center">
                <span>📁</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">历史上传记录</h2>
                <p className="text-sm text-[var(--text-muted)]">最近上传的股票池数据</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--text-muted)] bg-[var(--bg-dark)] px-3 py-1 rounded-full">
                {totalBatchCount} 条记录
              </span>
              {totalBatchCount >= 2 && (
                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  className="px-3 py-1.5 text-sm bg-[var(--primary-color)] text-black rounded-lg hover:bg-[var(--primary-dark)] transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {recalculating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      计算中
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      重新计算对比
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {batches.length > 0 ? (
              batches.slice(0, 6).map((batch, index) => (
                <div
                  key={batch.id}
                  className={`flex items-center justify-between px-4 py-3 bg-[var(--bg-dark)] rounded-lg transition-all duration-200 animate-fadeIn ${String(editingId) === String(batch.id) ? '' : 'hover:bg-[var(--bg-card-hover)] cursor-pointer group'}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => String(editingId) !== String(batch.id) && router.push(`/compare?groupId=${selectedGroupId}&date=${batch.batch_date}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-sm">📈</span>
                    </div>
                    <div>
                      {String(editingId) === String(batch.id) ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editDateValue}
                            onChange={(e) => setEditDateValue(e.target.value)}
                            className="px-2 py-1 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)]"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditSave(parseInt(String(batch.id)))
                            }}
                            className="px-2 py-1 text-xs bg-[var(--primary-color)] text-black rounded-md hover:bg-[var(--primary-dark)] transition-colors"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCancel()
                            }}
                            className="px-2 py-1 text-xs bg-[var(--bg-card)] text-[var(--text-muted)] rounded-md hover:bg-[var(--bg-card-hover)] transition-colors"
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-medium text-[var(--text-primary)]">{formatDate(batch.batch_date)}</span>
                          <p className="text-xs text-[var(--text-muted)]">{batch.file_name}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[var(--text-secondary)]">{batch.total_count} 只股票</span>
                    {String(editingId) !== String(batch.id) && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditStart(batch)
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-500/20 text-[var(--text-muted)] hover:text-blue-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(parseInt(String(batch.id)))
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                          disabled={String(deletingId) === String(batch.id)}
                        >
                          {String(deletingId) === String(batch.id) ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                    <svg className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--primary-color)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--bg-dark)] to-[var(--bg-card)] flex items-center justify-center">
                  <span className="text-3xl">📭</span>
                </div>
                <p className="text-[var(--text-muted)]">暂无上传记录</p>
                <button
                  onClick={() => router.push(`/upload?groupId=${selectedGroupId}`)}
                  className="mt-4 px-4 py-2 bg-[var(--primary-color)] text-black font-medium rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
                >
                  立即上传
                </button>
              </div>
            )}
          </div>
          {totalBatchCount > 6 && (
            <div className="mt-4 text-center">
              <button
                onClick={() => router.push(`/compare?groupId=${selectedGroupId}`)}
                className="text-sm text-[var(--primary-color)] hover:underline"
              >
                查看全部 {totalBatchCount} 条记录 →
              </button>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
              <span>💡</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">投资要点</h2>
              <p className="text-sm text-[var(--text-muted)]">《股票魔法师》核心策略</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { title: '量价突破', desc: '关注成交量与价格同步突破的股票', color: 'bg-green-500/20 text-green-400' },
              { title: '相对强弱', desc: '选择相对强度排名靠前的股票', color: 'bg-blue-500/20 text-blue-400' },
              { title: '趋势跟随', desc: '顺势而为，不要逆势操作', color: 'bg-yellow-500/20 text-yellow-400' },
              { title: '风险控制', desc: '严格执行止损，保护本金安全', color: 'bg-red-500/20 text-red-400' },
            ].map((item, index) => (
              <div
                key={index}
                className="p-3 bg-[var(--bg-dark)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${item.color.split(' ')[0]}`}></span>
                  <span className="font-medium text-[var(--text-primary)] text-sm">{item.title}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
