export interface StockGroup {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StockBatch {
  id: string
  group_id?: string
  batch_date: string
  file_name: string
  total_count: number
  created_at: string
}

export interface StockPoolItem {
  id: string
  batch_id: string
  trade_date: string
  stock_code: string
  stock_name: string
  source?: string
  note?: string
  created_at: string
}

export type StockStatus = 'first_seen' | 'new' | 'continued' | 'removed' | 'reappeared'

export interface StockCompareResult {
  id: string
  batch_id?: string
  group_id?: string
  trade_date: string
  stock_code: string
  stock_name: string
  status: StockStatus
  continuous_count: number
  total_appear_count: number
  last_seen_date?: string
  created_at: string
}

export interface StockMetadata {
  stock_code: string
  stock_name: string
  industry?: string | null
  concepts: string[]
  source?: string | null
  fetched_at?: string
  updated_at?: string
}

export interface RankingFinanceSnapshot {
  reportDate?: string
  reportType?: string
  netProfitYoy?: number | null
  revenueYoy?: number | null
  roe?: number | null
}

export interface EnrichedRankingResult extends StockCompareResult {
  industry?: string | null
  concepts?: string[]
  finance?: RankingFinanceSnapshot
}

export interface RankingFilters {
  industries?: string[]
  concepts?: string[]
  netProfitGrowthMin?: number | null
  revenueGrowthMin?: number | null
  roeMin?: number | null
}

export interface RankingExportContext {
  groupName?: string
  minDays: number
  filters: RankingFilters
}

export interface StockDetail {
  stock_code: string
  stock_name: string
  first_seen_date: string
  last_seen_date: string
  total_appear_count: number
  current_continuous_count: number
  break_count: number
  appearance_dates: string[]
}

export interface DashboardStats {
  today_count: number
  today_new: number
  today_removed: number
  continuous_3d_count: number
  continuous_5d_count: number
}

export interface CompareResult {
  new_stocks: StockPoolItem[]
  removed_stocks: StockPoolItem[]
  continued_stocks: StockPoolItem[]
  reappeared_stocks: StockPoolItem[]
}
