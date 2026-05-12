import { Client } from 'pg'
import type { StockBatch, StockPoolItem, StockCompareResult, StockDetail, DashboardStats, StockStatus } from '../types'
import { getCache, setCache, invalidateCache } from './cache'

const databaseUrl = process.env.DATABASE_URL

let client: Client | null = null
let tablesInitialized = false
let initializationPromise: Promise<void> | null = null

async function getClient(): Promise<Client> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }

  if (client) {
    try {
      await client.query('SELECT 1')
      return client
    } catch (error) {
      console.error('Existing client connection failed, reconnecting...')
      client = null
    }
  }

  client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
  })

  await client.connect()
  
  await client.query("SET client_encoding = 'UTF8'")
  await client.query("SET NAMES 'UTF8'")
  
  console.log('Database connected with UTF-8 encoding')

  return client
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
      
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_pool_items_batch_id ON stock_pool_items(batch_id)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_pool_items_stock_code ON stock_pool_items(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_trade_date ON stock_compare_results(trade_date)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_stock_code ON stock_compare_results(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_status ON stock_compare_results(status)')
      
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
    
    invalidateCache('batches')
    invalidateCache('dashboard_stats')
    
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
    
    invalidateCache('batches')
    invalidateCache('dashboard_stats')
    
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
    
    invalidateCache('batches')
    invalidateCache('dashboard_stats')
    
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
    
    invalidateCache('dashboard_stats')
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
    await client.query('DELETE FROM stock_compare_results WHERE trade_date = $1', [date])
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
  const latestBatch = await getLatestBatch()
  if (!latestBatch) return null

  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT * FROM stock_compare_results WHERE trade_date = $1 AND continuous_count >= $2 ORDER BY continuous_count DESC',
      [latestBatch.batch_date, minDays]
    )
    return result.rows
  } catch (error) {
    console.error('Error getting continuous ranking:', error)
    return null
  }
}
