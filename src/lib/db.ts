import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import type { StockBatch, StockPoolItem, StockCompareResult, StockDetail, DashboardStats, StockStatus } from '../types'
import { getCache, setCache, invalidateCache } from './cache'
import type { ReportTemplateInput, ReportTemplateRecord } from './report-template'
import type { EastmoneyFinanceSummary } from './eastmoney-finance'
import type { ComparePageData, DashboardOverview } from './stocks-page-data'

const databaseUrl = process.env.DATABASE_URL

let pool: Pool | null = null
let tablesInitialized = false
let initializationPromise: Promise<void> | null = null
let keepAliveTimer: ReturnType<typeof setInterval> | null = null

function invalidateStockPageCaches(date?: string): void {
  const normalizedDate = date?.split('T')[0]
  invalidateCache('batches')
  invalidateCache('dashboard_stats')
  invalidateCache('dashboard_overview_6')
  invalidateCache('compare_page_data_latest')

  if (normalizedDate) {
    invalidateCache(`compare_results_${normalizedDate}`)
    invalidateCache(`compare_page_data_${normalizedDate}`)
  }

  for (const minDays of [2, 3, 5, 10]) {
    invalidateCache(`continuous_ranking_${minDays}`)
  }
}

async function getClient(): Promise<Pool> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  if (pool) {
    return pool
  }

  pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 0,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    max: 10
  })

  pool.on('error', (error) => {
    console.error('Idle database pool client error:', error)
  })

  const pooledClient = await pool.connect()
  try {
    await pooledClient.query("SET client_encoding = 'UTF8'")
    await pooledClient.query("SET NAMES 'UTF8'")
  } finally {
    pooledClient.release()
  }

  console.log('Database pool initialized with UTF-8 encoding')

  if (!keepAliveTimer) {
    keepAliveTimer = setInterval(() => {
      pool?.query('SELECT 1').catch((error) => {
        console.error('Database keepalive failed:', error)
      })
    }, 4 * 60 * 1000)
    keepAliveTimer.unref?.()
  }

  return pool
}

export async function ensureTables(): Promise<void> {
  if (tablesInitialized) {
    return
  }
  
  if (initializationPromise) {
    await initializationPromise
    return
  }
  
  initializationPromise = (async () => {
    try {
      const client = await getClient()
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_batches (
          id SERIAL PRIMARY KEY,
          batch_date DATE UNIQUE NOT NULL,
          file_name TEXT NOT NULL,
          total_count INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_pool_items (
          id SERIAL PRIMARY KEY,
          batch_id INTEGER REFERENCES stock_batches(id) ON DELETE CASCADE,
          trade_date DATE NOT NULL,
          stock_code TEXT NOT NULL,
          stock_name TEXT,
          source TEXT,
          note TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(batch_id, stock_code)
        )
      `)
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_compare_results (
          id SERIAL PRIMARY KEY,
          trade_date DATE NOT NULL,
          stock_code TEXT NOT NULL,
          stock_name TEXT,
          status TEXT NOT NULL,
          continuous_count INTEGER NOT NULL,
          total_appear_count INTEGER NOT NULL,
          last_seen_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(trade_date, stock_code)
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS report_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_financial_reports (
          id SERIAL PRIMARY KEY,
          stock_code TEXT NOT NULL,
          stock_name TEXT NOT NULL,
          org_type_code TEXT,
          org_type TEXT,
          report_date DATE NOT NULL,
          report_type TEXT NOT NULL,
          report_date_name TEXT,
          notice_date DATE,
          update_date DATE,
          eps NUMERIC,
          bps NUMERIC,
          cash_per_share NUMERIC,
          roe NUMERIC,
          revenue_yoy NUMERIC,
          net_profit_yoy NUMERIC,
          gross_margin NUMERIC,
          revenue NUMERIC,
          total_profit NUMERIC,
          net_profit NUMERIC,
          source_url TEXT NOT NULL,
          raw_payload JSONB NOT NULL,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(stock_code, report_date)
        )
      `)
      
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_pool_items_batch_id ON stock_pool_items(batch_id)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_pool_items_stock_code ON stock_pool_items(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_trade_date ON stock_compare_results(trade_date)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_stock_code ON stock_compare_results(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_status ON stock_compare_results(status)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_batches_batch_date_desc ON stock_batches(batch_date DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_trade_date_status_code ON stock_compare_results(trade_date, status, stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_trade_date_continuous_count ON stock_compare_results(trade_date, continuous_count DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_report_templates_updated_at ON report_templates(updated_at DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_financial_reports_stock_code ON stock_financial_reports(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_financial_reports_report_date ON stock_financial_reports(report_date DESC)')
      
      tablesInitialized = true
      console.log('Database tables and indexes initialized')
    } catch (error) {
      console.error('Error initializing tables:', error)
      throw error
    }
  })()
  
  await initializationPromise
}

export async function createBatch(batchDate: string, fileName: string, totalCount: number): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const normalizedDate = batchDate.split('T')[0]
    console.log('Creating batch with date:', normalizedDate)
    
    const result = await client.query(
      'INSERT INTO stock_batches (batch_date, file_name, total_count) VALUES ($1, $2, $3) RETURNING *',
      [normalizedDate, fileName, totalCount]
    )
    
    invalidateStockPageCaches(normalizedDate)
    
    return result.rows[0]
  } catch (error) {
    console.error('Error creating batch:', error)
    return null
  }
}

export async function getBatchByDate(date: string): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const normalizedDate = date.split('T')[0]
    console.log('Getting batch for date:', normalizedDate)
    
    const result = await client.query(
      'SELECT * FROM stock_batches WHERE batch_date::TEXT = $1',
      [normalizedDate]
    )
    
    if (result.rows[0]) {
      console.log('Found batch:', result.rows[0])
    }
    
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting batch:', error)
    return null
  }
}

export async function deleteBatch(batchId: number): Promise<boolean> {
  try {
    const client = await getClient()
    await client.query('DELETE FROM stock_batches WHERE id = $1', [batchId])
    
    invalidateStockPageCaches()
    
    return true
  } catch (error) {
    console.error('Error deleting batch:', error)
    return false
  }
}

export async function updateBatchDate(batchId: number, newDate: string): Promise<boolean> {
  try {
    const client = await getClient()
    const normalizedDate = newDate.split('T')[0]
    console.log('Updating batch', batchId, 'to date:', normalizedDate)
    
    const result = await client.query(
      'UPDATE stock_batches SET batch_date = $1 WHERE id = $2',
      [normalizedDate, batchId]
    )
    
    console.log('Update result:', result.rowCount, 'rows affected')
    
    invalidateStockPageCaches(normalizedDate)
    
    return (result.rowCount ?? 0) > 0
  } catch (error) {
    console.error('Error updating batch date:', error)
    return false
  }
}

export async function createStockItems(items: Omit<StockPoolItem, 'id' | 'created_at'>[]): Promise<StockPoolItem[] | null> {
  try {
    const client = await getClient()
    
    console.log('Creating stock items, first item:', items[0])
    
    const values = items.map((item, index) => 
      `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${index * 6 + 4}, $${index * 6 + 5}, $${index * 6 + 6})`
    ).join(', ')
    
    const params = items.flatMap(item => [item.batch_id, item.trade_date, item.stock_code, item.stock_name, item.source || null, item.note || null])
    
    const result = await client.query(
      `INSERT INTO stock_pool_items (batch_id, trade_date, stock_code, stock_name, source, note) VALUES ${values} RETURNING *`,
      params
    )
    
    console.log('Created', result.rows.length, 'stock items')
    if (items.length > 0) {
      invalidateStockPageCaches(items[0].trade_date)
    }
    return result.rows
  } catch (error) {
    console.error('Error creating stock items:', error)
    return null
  }
}

export async function getStockItemsByBatch(batchId: number): Promise<StockPoolItem[] | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT * FROM stock_pool_items WHERE batch_id = $1 ORDER BY stock_code',
      [batchId]
    )
    
    if (result.rows.length > 0) {
      console.log('Retrieved stock items, first item name:', result.rows[0].stock_name)
    }
    
    return result.rows
  } catch (error) {
    console.error('Error getting stock items:', error)
    return null
  }
}

export async function deleteStockItemsByBatch(batchId: number): Promise<boolean> {
  try {
    const client = await getClient()
    await client.query('DELETE FROM stock_pool_items WHERE batch_id = $1', [batchId])
    return true
  } catch (error) {
    console.error('Error deleting stock items:', error)
    return false
  }
}

export async function getLatestBatch(): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT * FROM stock_batches ORDER BY batch_date DESC LIMIT 1'
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting latest batch:', error)
    return null
  }
}

export async function getPreviousBatch(currentDate: string): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const normalizedDate = currentDate.split('T')[0]
    const result = await client.query(
      "SELECT id, batch_date::TEXT as batch_date, file_name, total_count, created_at FROM stock_batches WHERE batch_date::TEXT < $1 ORDER BY batch_date DESC LIMIT 1",
      [normalizedDate]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting previous batch:', error)
    return null
  }
}

export async function getAllBatches(): Promise<StockBatch[] | null> {
  const cacheKey = 'batches'
  const cached = getCache<StockBatch[]>(cacheKey)
  if (cached) {
    return cached
  }
  
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT id, batch_date::TEXT as batch_date, file_name, total_count, created_at FROM stock_batches ORDER BY batch_date DESC'
    )
    setCache(cacheKey, result.rows)
    return result.rows
  } catch (error) {
    console.error('Error getting batches:', error)
    return null
  }
}

const emptyDashboardStats: DashboardStats = {
  today_count: 0,
  today_new: 0,
  today_removed: 0,
  continuous_3d_count: 0,
  continuous_5d_count: 0
}

export async function getDashboardOverview(recentLimit: number = 6): Promise<DashboardOverview | null> {
  const cacheKey = `dashboard_overview_${recentLimit}`
  const cached = getCache<DashboardOverview>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      WITH latest_batch AS (
        SELECT id, batch_date
        FROM stock_batches
        ORDER BY batch_date DESC
        LIMIT 1
      ),
      stats AS (
        SELECT
          COALESCE((SELECT COUNT(*) FROM stock_pool_items WHERE batch_id = (SELECT id FROM latest_batch)), 0)::int as today_count,
          COALESCE(SUM(CASE WHEN status IN ('new', 'first_seen', 'reappeared') THEN 1 ELSE 0 END), 0)::int as today_new,
          COALESCE(SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END), 0)::int as today_removed,
          COALESCE(SUM(CASE WHEN continuous_count >= 3 THEN 1 ELSE 0 END), 0)::int as continuous_3d_count,
          COALESCE(SUM(CASE WHEN continuous_count >= 5 THEN 1 ELSE 0 END), 0)::int as continuous_5d_count
        FROM stock_compare_results
        WHERE trade_date = (SELECT batch_date FROM latest_batch)
      ),
      recent_batches AS (
        SELECT COALESCE(json_agg(row_to_json(batch_row)), '[]'::json) as batches
        FROM (
          SELECT
            id::text as id,
            batch_date::text as batch_date,
            file_name,
            total_count,
            created_at::text as created_at
          FROM stock_batches
          ORDER BY batch_date DESC
          LIMIT $1
        ) batch_row
      ),
      batch_count AS (
        SELECT COUNT(*)::int as total_batch_count
        FROM stock_batches
      )
      SELECT
        stats.today_count,
        stats.today_new,
        stats.today_removed,
        stats.continuous_3d_count,
        stats.continuous_5d_count,
        recent_batches.batches,
        batch_count.total_batch_count
      FROM stats
      CROSS JOIN recent_batches
      CROSS JOIN batch_count
      `,
      [recentLimit]
    )

    const row = result.rows[0]
    const overview: DashboardOverview = {
      stats: row ? {
        today_count: Number(row.today_count) || 0,
        today_new: Number(row.today_new) || 0,
        today_removed: Number(row.today_removed) || 0,
        continuous_3d_count: Number(row.continuous_3d_count) || 0,
        continuous_5d_count: Number(row.continuous_5d_count) || 0
      } : emptyDashboardStats,
      batches: row?.batches || [],
      totalBatchCount: Number(row?.total_batch_count) || 0
    }

    setCache(cacheKey, overview)
    return overview
  } catch (error) {
    console.error('Error getting dashboard overview:', error)
    return null
  }
}

export async function getComparePageData(requestedDate?: string | null): Promise<ComparePageData | null> {
  const normalizedDate = requestedDate?.split('T')[0]
  const safeDate = normalizedDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ? normalizedDate : null
  const cacheKey = `compare_page_data_${safeDate || 'latest'}`
  const cached = getCache<ComparePageData>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      WITH batches AS (
        SELECT
          id::text as id,
          batch_date::text as batch_date,
          batch_date as raw_batch_date,
          file_name,
          total_count,
          created_at::text as created_at
        FROM stock_batches
        ORDER BY batch_date DESC
      ),
      selected_batch AS (
        SELECT COALESCE(
          (SELECT raw_batch_date FROM batches WHERE raw_batch_date = $1::date LIMIT 1),
          (SELECT raw_batch_date FROM batches LIMIT 1)
        ) as batch_date
      ),
      batch_json AS (
        SELECT COALESCE(json_agg(row_to_json(batch_row)), '[]'::json) as batches
        FROM (
          SELECT id, batch_date, file_name, total_count, created_at
          FROM batches
        ) batch_row
      ),
      result_json AS (
        SELECT COALESCE(json_agg(row_to_json(result_row)), '[]'::json) as results
        FROM (
          SELECT
            id::text as id,
            trade_date::text as trade_date,
            stock_code,
            stock_name,
            status,
            continuous_count,
            total_appear_count,
            last_seen_date::text as last_seen_date,
            created_at::text as created_at
          FROM stock_compare_results
          WHERE trade_date = (SELECT batch_date FROM selected_batch)
          ORDER BY status, stock_code
        ) result_row
      )
      SELECT
        batch_json.batches,
        COALESCE((SELECT batch_date::text FROM selected_batch), '') as selected_date,
        result_json.results
      FROM batch_json
      CROSS JOIN result_json
      `,
      [safeDate]
    )

    const row = result.rows[0]
    const pageData: ComparePageData = {
      batches: row?.batches || [],
      selectedDate: row?.selected_date || '',
      results: row?.results || []
    }

    setCache(cacheKey, pageData)
    return pageData
  } catch (error) {
    console.error('Error getting compare page data:', error)
    return null
  }
}

export async function createCompareResults(results: Omit<StockCompareResult, 'id' | 'created_at'>[]): Promise<StockCompareResult[] | null> {
  try {
    const client = await getClient()
    const values = results.map((item, index) => 
      `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
    ).join(', ')
    
    const params = results.flatMap(item => [item.trade_date, item.stock_code, item.stock_name, item.status, item.continuous_count, item.total_appear_count, item.last_seen_date || null])
    
    const result = await client.query(
      `INSERT INTO stock_compare_results (trade_date, stock_code, stock_name, status, continuous_count, total_appear_count, last_seen_date) VALUES ${values} RETURNING *`,
      params
    )
    
    invalidateStockPageCaches(results[0]?.trade_date)
    if (results.length > 0) {
      invalidateCache(`compare_results_${results[0].trade_date}`)
    }
    
    return result.rows
  } catch (error) {
    console.error('Error creating compare results:', error)
    return null
  }
}

export async function deleteCompareResultsByDate(date: string): Promise<boolean> {
  try {
    const client = await getClient()
    const normalizedDate = date.split('T')[0]
    await client.query('DELETE FROM stock_compare_results WHERE trade_date = $1', [normalizedDate])
    invalidateStockPageCaches(normalizedDate)
    return true
  } catch (error) {
    console.error('Error deleting compare results:', error)
    return false
  }
}

export async function getCompareResultsByDate(date: string): Promise<StockCompareResult[] | null> {
  const normalizedDate = date.split('T')[0]
  const cacheKey = `compare_results_${normalizedDate}`
  const cached = getCache<StockCompareResult[]>(cacheKey)
  if (cached) {
    return cached
  }
  
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT * FROM stock_compare_results WHERE trade_date = $1 ORDER BY status, stock_code',
      [normalizedDate]
    )
    setCache(cacheKey, result.rows)
    return result.rows
  } catch (error) {
    console.error('Error getting compare results:', error)
    return null
  }
}

export async function getDashboardStats(): Promise<DashboardStats | null> {
  const cacheKey = 'dashboard_stats'
  const cached = getCache<DashboardStats>(cacheKey)
  if (cached) {
    return cached
  }
  
  try {
    const client = await getClient()
    
    const latestBatchResult = await client.query(
      'SELECT id, batch_date::TEXT as batch_date FROM stock_batches ORDER BY batch_date DESC LIMIT 1'
    )
    
    if (!latestBatchResult.rows[0]) {
      const emptyStats: DashboardStats = {
        today_count: 0,
        today_new: 0,
        today_removed: 0,
        continuous_3d_count: 0,
        continuous_5d_count: 0
      }
      setCache(cacheKey, emptyStats)
      return emptyStats
    }
    
    const latestBatch = latestBatchResult.rows[0]
    
    const [todayCountResult, statsResult] = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM stock_pool_items WHERE batch_id = $1', [latestBatch.id]),
      client.query(`
        SELECT 
          SUM(CASE WHEN status IN ('new', 'first_seen', 'reappeared') THEN 1 ELSE 0 END) as today_new,
          SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END) as today_removed,
          SUM(CASE WHEN continuous_count >= 3 THEN 1 ELSE 0 END) as continuous_3d_count,
          SUM(CASE WHEN continuous_count >= 5 THEN 1 ELSE 0 END) as continuous_5d_count
        FROM stock_compare_results 
        WHERE trade_date = $1
      `, [latestBatch.batch_date])
    ])
    
    const todayCount = parseInt(todayCountResult.rows[0].count) || 0
    const statsRow = statsResult.rows[0]
    
    const stats: DashboardStats = {
      today_count: todayCount,
      today_new: parseInt(statsRow.today_new) || 0,
      today_removed: parseInt(statsRow.today_removed) || 0,
      continuous_3d_count: parseInt(statsRow.continuous_3d_count) || 0,
      continuous_5d_count: parseInt(statsRow.continuous_5d_count) || 0
    }
    
    setCache(cacheKey, stats)
    return stats
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    return {
      today_count: 0,
      today_new: 0,
      today_removed: 0,
      continuous_3d_count: 0,
      continuous_5d_count: 0
    }
  }
}

export async function getStockDetail(stockCode: string): Promise<StockDetail | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT trade_date, stock_name FROM stock_pool_items WHERE stock_code = $1 ORDER BY trade_date',
      [stockCode]
    )
    
    if (!result.rows || result.rows.length === 0) {
      return null
    }

    const stockName = result.rows[0].stock_name
    const appearanceDates = [...new Set(result.rows.map((item: { trade_date: string }) => item.trade_date))].sort()
    
    let breakCount = 0
    let currentContinuous = 0
    
    for (let i = 0; i < appearanceDates.length; i++) {
      if (i === 0) {
        currentContinuous = 1
      } else {
        const prevDate = new Date(appearanceDates[i - 1])
        const currDate = new Date(appearanceDates[i])
        const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        
        if (diffDays === 1) {
          currentContinuous++
        } else {
          breakCount++
          currentContinuous = 1
        }
      }
    }

    const today = new Date().toISOString().split('T')[0]
    const lastDate = appearanceDates[appearanceDates.length - 1]
    const isCurrent = lastDate === today
    
    return {
      stock_code: stockCode,
      stock_name: stockName,
      first_seen_date: appearanceDates[0],
      last_seen_date: lastDate,
      total_appear_count: appearanceDates.length,
      current_continuous_count: isCurrent ? currentContinuous : 0,
      break_count: breakCount,
      appearance_dates: appearanceDates
    }
  } catch (error) {
    console.error('Error getting stock detail:', error)
    return null
  }
}

export async function getContinuousRanking(minDays: number = 2): Promise<StockCompareResult[] | null> {
  const cacheKey = `continuous_ranking_${minDays}`
  const cached = getCache<StockCompareResult[]>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      WITH latest_batch AS (
        SELECT batch_date
        FROM stock_batches
        ORDER BY batch_date DESC
        LIMIT 1
      )
      SELECT
        id::text as id,
        trade_date::text as trade_date,
        stock_code,
        stock_name,
        status,
        continuous_count,
        total_appear_count,
        last_seen_date::text as last_seen_date,
        created_at::text as created_at
      FROM stock_compare_results
      WHERE trade_date = (SELECT batch_date FROM latest_batch)
        AND continuous_count >= $1
      ORDER BY continuous_count DESC, stock_code
      `,
      [minDays]
    )
    setCache(cacheKey, result.rows)
    return result.rows
  } catch (error) {
    console.error('Error getting continuous ranking:', error)
    return null
  }
}

export async function getReportTemplates(): Promise<ReportTemplateRecord[] | null> {
  try {
    const client = await getClient()
    const result = await client.query(`
      SELECT
        id,
        name,
        content,
        created_at::TEXT as created_at,
        updated_at::TEXT as updated_at
      FROM report_templates
      ORDER BY updated_at DESC, created_at DESC
    `)
    return result.rows
  } catch (error) {
    console.error('Error getting report templates:', error)
    return null
  }
}

export async function createReportTemplate(input: ReportTemplateInput): Promise<ReportTemplateRecord | null> {
  try {
    const client = await getClient()
    const id = `report_template_${Date.now()}_${randomUUID().slice(0, 8)}`
    const result = await client.query(
      `INSERT INTO report_templates (id, name, content)
       VALUES ($1, $2, $3)
       RETURNING id, name, content, created_at::TEXT as created_at, updated_at::TEXT as updated_at`,
      [id, input.name, input.content]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error creating report template:', error)
    return null
  }
}

export async function updateReportTemplate(id: string, input: ReportTemplateInput): Promise<ReportTemplateRecord | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      `UPDATE report_templates
       SET name = $2, content = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name, content, created_at::TEXT as created_at, updated_at::TEXT as updated_at`,
      [id, input.name, input.content]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating report template:', error)
    return null
  }
}

export async function deleteReportTemplate(id: string): Promise<boolean> {
  try {
    const client = await getClient()
    const result = await client.query('DELETE FROM report_templates WHERE id = $1', [id])
    return (result.rowCount ?? 0) > 0
  } catch (error) {
    console.error('Error deleting report template:', error)
    return false
  }
}

export async function getLatestFinancialReport(stockCode: string): Promise<EastmoneyFinanceSummary | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      `SELECT
        stock_code as "stockCode",
        stock_name as "stockName",
        org_type_code as "orgTypeCode",
        org_type as "orgType",
        report_date::TEXT as "reportDate",
        report_type as "reportType",
        report_date_name as "reportDateName",
        notice_date::TEXT as "noticeDate",
        update_date::TEXT as "updateDate",
        eps,
        bps,
        cash_per_share as "cashPerShare",
        roe,
        revenue_yoy as "revenueYoy",
        net_profit_yoy as "netProfitYoy",
        gross_margin as "grossMargin",
        revenue,
        total_profit as "totalProfit",
        net_profit as "netProfit",
        source_url as "sourceUrl",
        raw_payload as raw
      FROM stock_financial_reports
      WHERE stock_code = $1
      ORDER BY report_date DESC, fetched_at DESC
      LIMIT 1`,
      [stockCode]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting latest financial report:', error)
    return null
  }
}

export async function upsertFinancialReport(report: EastmoneyFinanceSummary): Promise<boolean> {
  try {
    const client = await getClient()
    const result = await client.query(
      `INSERT INTO stock_financial_reports (
        stock_code,
        stock_name,
        org_type_code,
        org_type,
        report_date,
        report_type,
        report_date_name,
        notice_date,
        update_date,
        eps,
        bps,
        cash_per_share,
        roe,
        revenue_yoy,
        net_profit_yoy,
        gross_margin,
        revenue,
        total_profit,
        net_profit,
        source_url,
        raw_payload,
        fetched_at
      ) VALUES (
        $1, $2, $3, $4, $5::date, $6, $7, $8::date, $9::date, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP
      )
      ON CONFLICT (stock_code, report_date) DO UPDATE SET
        stock_name = EXCLUDED.stock_name,
        org_type_code = EXCLUDED.org_type_code,
        org_type = EXCLUDED.org_type,
        report_type = EXCLUDED.report_type,
        report_date_name = EXCLUDED.report_date_name,
        notice_date = EXCLUDED.notice_date,
        update_date = EXCLUDED.update_date,
        eps = EXCLUDED.eps,
        bps = EXCLUDED.bps,
        cash_per_share = EXCLUDED.cash_per_share,
        roe = EXCLUDED.roe,
        revenue_yoy = EXCLUDED.revenue_yoy,
        net_profit_yoy = EXCLUDED.net_profit_yoy,
        gross_margin = EXCLUDED.gross_margin,
        revenue = EXCLUDED.revenue,
        total_profit = EXCLUDED.total_profit,
        net_profit = EXCLUDED.net_profit,
        source_url = EXCLUDED.source_url,
        raw_payload = EXCLUDED.raw_payload,
        fetched_at = CURRENT_TIMESTAMP`,
      [
        report.stockCode,
        report.stockName,
        report.orgTypeCode || null,
        report.orgType || null,
        report.reportDate,
        report.reportType,
        report.reportDateName || null,
        report.noticeDate || null,
        report.updateDate || null,
        report.eps ?? null,
        report.bps ?? null,
        report.cashPerShare ?? null,
        report.roe ?? null,
        report.revenueYoy ?? null,
        report.netProfitYoy ?? null,
        report.grossMargin ?? null,
        report.revenue ?? null,
        report.totalProfit ?? null,
        report.netProfit ?? null,
        report.sourceUrl,
        JSON.stringify(report.raw)
      ]
    )

    return (result.rowCount ?? 0) > 0
  } catch (error) {
    console.error('Error upserting financial report:', error)
    return false
  }
}
