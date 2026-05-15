import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import type { StockBatch, StockPoolItem, StockCompareResult, StockDetail, DashboardStats, StockStatus, StockGroup, StockMetadata } from '../types'
import { getCache, setCache, invalidateCache } from './cache'
import type { ReportTemplateInput, ReportTemplateRecord } from './report-template'
import type { EastmoneyFinanceSummary } from './eastmoney-finance'
import type { ComparePageData, DashboardOverview } from './stocks-page-data'
import { isStockGroupSchemaReady, type StockGroupSchemaReadiness } from './db-schema'

const databaseUrl = process.env.DATABASE_URL
export const DEFAULT_STOCK_GROUP_NAME = '每日火车股票池'

let pool: Pool | null = null
let tablesInitialized = false
let initializationPromise: Promise<void> | null = null
let keepAliveTimer: ReturnType<typeof setInterval> | null = null
let defaultGroupIdCache: string | null = null

function normalizeGroupId(groupId?: string | number | null): string | undefined {
  return groupId === undefined || groupId === null || groupId === '' ? undefined : String(groupId)
}

function isMissingRelationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '42P01'
}

function invalidateStockPageCaches(date?: string, groupId?: string | number | null): void {
  const normalizedDate = date?.split('T')[0]
  const normalizedGroupId = normalizeGroupId(groupId)
  invalidateCache('batches')
  if (normalizedGroupId) {
    invalidateCache(`batches_${normalizedGroupId}`)
  }
  invalidateCache('groups_active')
  invalidateCache('groups_all')
  invalidateCache('dashboard_stats')
  invalidateCache('dashboard_overview_6')
  invalidateCache('dashboard_overview_default_6')
  if (normalizedGroupId) {
    invalidateCache(`dashboard_stats_${normalizedGroupId}`)
    invalidateCache(`dashboard_overview_${normalizedGroupId}_6`)
  }
  invalidateCache('compare_page_data_latest')
  invalidateCache('compare_page_data_default_latest')
  if (normalizedGroupId) {
    invalidateCache(`compare_page_data_${normalizedGroupId}_latest`)
  }

  if (normalizedDate) {
    invalidateCache(`compare_results_${normalizedDate}`)
    invalidateCache(`compare_page_data_${normalizedDate}`)
    invalidateCache(`compare_page_data_default_${normalizedDate}`)
    if (normalizedGroupId) {
      invalidateCache(`compare_results_${normalizedGroupId}_${normalizedDate}`)
      invalidateCache(`compare_page_data_${normalizedGroupId}_${normalizedDate}`)
    }
  }

  for (const minDays of [2, 3, 5, 10]) {
    invalidateCache(`continuous_ranking_${minDays}`)
    if (normalizedGroupId) {
      invalidateCache(`continuous_ranking_${normalizedGroupId}_${minDays}`)
    }
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

  console.log('Database pool initialized')

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

async function getStockGroupSchemaReadiness(client: Pool): Promise<StockGroupSchemaReadiness> {
  const metadataResult = await client.query(`
    SELECT
      (to_regclass('public.stock_groups') IS NOT NULL) as stock_groups_table_exists,
      (to_regclass('public.stock_batches') IS NOT NULL) as stock_batches_table_exists,
      (to_regclass('public.stock_pool_items') IS NOT NULL) as stock_pool_items_table_exists,
      (to_regclass('public.stock_compare_results') IS NOT NULL) as stock_compare_results_table_exists,
      (to_regclass('public.report_templates') IS NOT NULL) as report_templates_table_exists,
      (to_regclass('public.stock_financial_reports') IS NOT NULL) as stock_financial_reports_table_exists,
      (to_regclass('public.stock_metadata') IS NOT NULL) as stock_metadata_table_exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_batches'
          AND column_name = 'group_id'
      ) as batch_group_column_exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_batches'
          AND column_name = 'group_id'
          AND is_nullable = 'NO'
      ) as batch_group_column_required,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_compare_results'
          AND column_name = 'batch_id'
      ) as compare_batch_column_exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_compare_results'
          AND column_name = 'batch_id'
          AND is_nullable = 'NO'
      ) as compare_batch_column_required,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_compare_results'
          AND column_name = 'group_id'
      ) as compare_group_column_exists,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'stock_compare_results'
          AND column_name = 'group_id'
          AND is_nullable = 'NO'
      ) as compare_group_column_required,
      EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stock_batches_group_date_key'
      ) as batch_group_date_constraint_exists,
      EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stock_compare_results_batch_code_key'
      ) as compare_batch_code_constraint_exists,
      EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'stock_metadata_stock_code_key'
      ) as stock_metadata_stock_code_key_exists
  `)

  const metadata = metadataResult.rows[0]
  let defaultGroupExists = false

  if (metadata.stock_groups_table_exists) {
    const defaultGroupResult = await client.query(
      'SELECT EXISTS (SELECT 1 FROM stock_groups WHERE name = $1) as default_group_exists',
      [DEFAULT_STOCK_GROUP_NAME]
    )
    defaultGroupExists = Boolean(defaultGroupResult.rows[0]?.default_group_exists)
  }

  return {
    stock_groups_table_exists: Boolean(metadata.stock_groups_table_exists),
    stock_batches_table_exists: Boolean(metadata.stock_batches_table_exists),
    stock_pool_items_table_exists: Boolean(metadata.stock_pool_items_table_exists),
    stock_compare_results_table_exists: Boolean(metadata.stock_compare_results_table_exists),
    report_templates_table_exists: Boolean(metadata.report_templates_table_exists),
    stock_financial_reports_table_exists: Boolean(metadata.stock_financial_reports_table_exists),
    stock_metadata_table_exists: Boolean(metadata.stock_metadata_table_exists),
    default_group_exists: defaultGroupExists,
    batch_group_column_exists: Boolean(metadata.batch_group_column_exists),
    batch_group_column_required: Boolean(metadata.batch_group_column_required),
    compare_batch_column_exists: Boolean(metadata.compare_batch_column_exists),
    compare_batch_column_required: Boolean(metadata.compare_batch_column_required),
    compare_group_column_exists: Boolean(metadata.compare_group_column_exists),
    compare_group_column_required: Boolean(metadata.compare_group_column_required),
    batch_group_date_constraint_exists: Boolean(metadata.batch_group_date_constraint_exists),
    compare_batch_code_constraint_exists: Boolean(metadata.compare_batch_code_constraint_exists),
    stock_metadata_stock_code_key_exists: Boolean(metadata.stock_metadata_stock_code_key_exists)
  }
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
      const readiness = await getStockGroupSchemaReadiness(client)
      if (isStockGroupSchemaReady(readiness)) {
        tablesInitialized = true
        console.log('Database schema already initialized')
        return
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_groups (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      const defaultGroupResult = await client.query(
        `INSERT INTO stock_groups (name, is_active)
         VALUES ($1, TRUE)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [DEFAULT_STOCK_GROUP_NAME]
      )
      const defaultGroupId = defaultGroupResult.rows[0].id
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_batches (
          id SERIAL PRIMARY KEY,
          group_id INTEGER REFERENCES stock_groups(id),
          batch_date DATE NOT NULL,
          file_name TEXT NOT NULL,
          total_count INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT stock_batches_group_date_key UNIQUE(group_id, batch_date)
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
          batch_id INTEGER REFERENCES stock_batches(id) ON DELETE CASCADE,
          group_id INTEGER REFERENCES stock_groups(id),
          trade_date DATE NOT NULL,
          stock_code TEXT NOT NULL,
          stock_name TEXT,
          status TEXT NOT NULL,
          continuous_count INTEGER NOT NULL,
          total_appear_count INTEGER NOT NULL,
          last_seen_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT stock_compare_results_batch_code_key UNIQUE(batch_id, stock_code)
        )
      `)

      await client.query('ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES stock_groups(id)')
      await client.query('UPDATE stock_batches SET group_id = $1 WHERE group_id IS NULL', [defaultGroupId])
      await client.query('ALTER TABLE stock_batches ALTER COLUMN group_id SET NOT NULL')
      await client.query('ALTER TABLE stock_batches DROP CONSTRAINT IF EXISTS stock_batches_batch_date_key')
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'stock_batches_group_date_key'
          ) THEN
            ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_group_date_key UNIQUE (group_id, batch_date);
          END IF;
        END $$;
      `)

      await client.query('ALTER TABLE stock_compare_results ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES stock_batches(id) ON DELETE CASCADE')
      await client.query('ALTER TABLE stock_compare_results ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES stock_groups(id)')
      await client.query(
        `
        UPDATE stock_compare_results compare
        SET batch_id = batch.id,
            group_id = batch.group_id
        FROM stock_batches batch
        WHERE compare.trade_date = batch.batch_date
          AND batch.group_id = $1
          AND (compare.batch_id IS NULL OR compare.group_id IS NULL)
        `,
        [defaultGroupId]
      )
      await client.query('DELETE FROM stock_compare_results WHERE batch_id IS NULL OR group_id IS NULL')
      await client.query('ALTER TABLE stock_compare_results ALTER COLUMN batch_id SET NOT NULL')
      await client.query('ALTER TABLE stock_compare_results ALTER COLUMN group_id SET NOT NULL')
      await client.query('ALTER TABLE stock_compare_results DROP CONSTRAINT IF EXISTS stock_compare_results_trade_date_stock_code_key')
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'stock_compare_results_batch_code_key'
          ) THEN
            ALTER TABLE stock_compare_results ADD CONSTRAINT stock_compare_results_batch_code_key UNIQUE (batch_id, stock_code);
          END IF;
        END $$;
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

      await client.query(`
        CREATE TABLE IF NOT EXISTS stock_metadata (
          id SERIAL PRIMARY KEY,
          stock_code TEXT NOT NULL,
          stock_name TEXT NOT NULL,
          industry TEXT,
          concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
          source TEXT,
          fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT stock_metadata_stock_code_key UNIQUE(stock_code)
        )
      `)
      
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_groups_active_name ON stock_groups(is_active, name)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_batches_group_date_desc ON stock_batches(group_id, batch_date DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_pool_items_batch_id ON stock_pool_items(batch_id)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_pool_items_stock_code ON stock_pool_items(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_batch_id ON stock_compare_results(batch_id)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_group_trade_date ON stock_compare_results(group_id, trade_date)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_trade_date ON stock_compare_results(trade_date)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_stock_code ON stock_compare_results(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_status ON stock_compare_results(status)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_batches_batch_date_desc ON stock_batches(batch_date DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_trade_date_status_code ON stock_compare_results(trade_date, status, stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_compare_results_trade_date_continuous_count ON stock_compare_results(trade_date, continuous_count DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_report_templates_updated_at ON report_templates(updated_at DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_financial_reports_stock_code ON stock_financial_reports(stock_code)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_financial_reports_report_date ON stock_financial_reports(report_date DESC)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_metadata_industry ON stock_metadata(industry)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_metadata_concepts ON stock_metadata USING GIN(concepts)')
      await client.query('CREATE INDEX IF NOT EXISTS idx_stock_metadata_fetched_at ON stock_metadata(fetched_at DESC)')
      
      tablesInitialized = true
      console.log('Database tables and indexes initialized')
    } catch (error) {
      console.error('Error initializing tables:', error)
      throw error
    }
  })()
  
  await initializationPromise
}

export async function getDefaultGroup(): Promise<StockGroup | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      `SELECT id::text as id, name, is_active, created_at::text as created_at, updated_at::text as updated_at
       FROM stock_groups
       WHERE name = $1
       LIMIT 1`,
      [DEFAULT_STOCK_GROUP_NAME]
    )
    if (result.rows[0]?.id) {
      defaultGroupIdCache = result.rows[0].id
    }
    return result.rows[0] || null
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getDefaultGroup()
    }
    console.error('Error getting default group:', error)
    return null
  }
}

export async function resolveGroupId(groupId?: string | number | null): Promise<string | null> {
  try {
    const client = await getClient()
    const normalizedGroupId = normalizeGroupId(groupId)

    if (normalizedGroupId) {
      const groupResult = await client.query('SELECT id::text as id FROM stock_groups WHERE id = $1 LIMIT 1', [normalizedGroupId])
      if (groupResult.rows[0]?.id) {
        return groupResult.rows[0].id
      }
    }

    if (defaultGroupIdCache) {
      return defaultGroupIdCache
    }

    const defaultGroup = await getDefaultGroup()
    if (!defaultGroup) {
      await ensureTables()
      const initializedDefaultGroup = await getDefaultGroup()
      return initializedDefaultGroup?.id || null
    }

    return defaultGroup?.id || null
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return resolveGroupId(groupId)
    }
    console.error('Error resolving group id:', error)
    return null
  }
}

export async function getStockGroups(includeInactive: boolean = false): Promise<StockGroup[] | null> {
  const cacheKey = includeInactive ? 'groups_all' : 'groups_active'
  const cached = getCache<StockGroup[]>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      SELECT id::text as id, name, is_active, created_at::text as created_at, updated_at::text as updated_at
      FROM stock_groups
      WHERE $1::boolean OR is_active = TRUE
      ORDER BY is_active DESC, created_at ASC, name ASC
      `,
      [includeInactive]
    )
    setCache(cacheKey, result.rows)
    return result.rows
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getStockGroups(includeInactive)
    }
    console.error('Error getting stock groups:', error)
    return null
  }
}

export async function createStockGroup(name: string): Promise<StockGroup | null> {
  try {
    await ensureTables()
    const client = await getClient()
    const trimmedName = name.trim()
    if (!trimmedName) {
      return null
    }

    const result = await client.query(
      `
      INSERT INTO stock_groups (name, is_active)
      VALUES ($1, TRUE)
      ON CONFLICT (name) DO UPDATE
      SET is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP
      RETURNING id::text as id, name, is_active, created_at::text as created_at, updated_at::text as updated_at
      `,
      [trimmedName]
    )
    if (result.rows[0]?.name === DEFAULT_STOCK_GROUP_NAME) {
      defaultGroupIdCache = result.rows[0].id
    }
    invalidateStockPageCaches()
    return result.rows[0] || null
  } catch (error) {
    console.error('Error creating stock group:', error)
    return null
  }
}

export async function updateStockGroup(
  groupId: string | number,
  input: { name?: string; is_active?: boolean }
): Promise<StockGroup | null> {
  try {
    await ensureTables()
    const client = await getClient()
    const currentResult = await client.query(
      'SELECT name, is_active FROM stock_groups WHERE id = $1 LIMIT 1',
      [groupId]
    )
    const current = currentResult.rows[0]
    if (!current) {
      return null
    }

    const nextName = input.name !== undefined ? input.name.trim() : current.name
    if (!nextName) {
      return null
    }

    const nextActive = input.is_active !== undefined ? input.is_active : current.is_active
    const result = await client.query(
      `
      UPDATE stock_groups
      SET name = $2,
          is_active = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id::text as id, name, is_active, created_at::text as created_at, updated_at::text as updated_at
      `,
      [groupId, nextName, nextActive]
    )
    if (result.rows[0]?.name === DEFAULT_STOCK_GROUP_NAME) {
      defaultGroupIdCache = result.rows[0].id
    } else if (String(groupId) === defaultGroupIdCache) {
      defaultGroupIdCache = null
    }
    invalidateStockPageCaches(undefined, groupId)
    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating stock group:', error)
    return null
  }
}

export async function createBatch(batchDate: string, fileName: string, totalCount: number, groupId?: string | number | null): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const normalizedDate = batchDate.split('T')[0]
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      throw new Error('无法解析股票池分组')
    }
    console.log('Creating batch with date:', normalizedDate, 'group:', resolvedGroupId)
    
    const result = await client.query(
      'INSERT INTO stock_batches (group_id, batch_date, file_name, total_count) VALUES ($1, $2, $3, $4) RETURNING id::text as id, group_id::text as group_id, batch_date::text as batch_date, file_name, total_count, created_at::text as created_at',
      [resolvedGroupId, normalizedDate, fileName, totalCount]
    )
    
    invalidateStockPageCaches(normalizedDate, resolvedGroupId)
    
    return result.rows[0]
  } catch (error) {
    console.error('Error creating batch:', error)
    return null
  }
}

export async function getBatchByDate(date: string, groupId?: string | number | null): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const normalizedDate = date.split('T')[0]
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return null
    }
    console.log('Getting batch for date:', normalizedDate, 'group:', resolvedGroupId)
    
    const result = await client.query(
      'SELECT id::text as id, group_id::text as group_id, batch_date::text as batch_date, file_name, total_count, created_at::text as created_at FROM stock_batches WHERE batch_date::TEXT = $1 AND group_id = $2',
      [normalizedDate, resolvedGroupId]
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

export async function getBatchById(batchId: string | number): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT id::text as id, group_id::text as group_id, batch_date::text as batch_date, file_name, total_count, created_at::text as created_at FROM stock_batches WHERE id = $1',
      [batchId]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting batch by id:', error)
    return null
  }
}

export async function deleteBatch(batchId: number): Promise<boolean> {
  try {
    const client = await getClient()
    const batchResult = await client.query('SELECT batch_date::text as batch_date, group_id::text as group_id FROM stock_batches WHERE id = $1', [batchId])
    await client.query('DELETE FROM stock_batches WHERE id = $1', [batchId])
    
    invalidateStockPageCaches(batchResult.rows[0]?.batch_date, batchResult.rows[0]?.group_id)
    
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
      'UPDATE stock_batches SET batch_date = $1 WHERE id = $2 RETURNING group_id::text as group_id',
      [normalizedDate, batchId]
    )
    
    console.log('Update result:', result.rowCount, 'rows affected')
    
    invalidateStockPageCaches(normalizedDate, result.rows[0]?.group_id)
    
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
      `INSERT INTO stock_pool_items (batch_id, trade_date, stock_code, stock_name, source, note) VALUES ${values} RETURNING id::text as id, batch_id::text as batch_id, trade_date::text as trade_date, stock_code, stock_name, source, note, created_at::text as created_at`,
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
      'SELECT id::text as id, batch_id::text as batch_id, trade_date::text as trade_date, stock_code, stock_name, source, note, created_at::text as created_at FROM stock_pool_items WHERE batch_id = $1 ORDER BY stock_code',
      [batchId]
    )
    
    if (result.rows.length > 0) {
      console.log('Retrieved stock items, first item name:', result.rows[0].stock_name)
    }
    
    return result.rows
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getStockItemsByBatch(batchId)
    }
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

export async function getLatestBatch(groupId?: string | number | null): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return null
    }
    const result = await client.query(
      'SELECT id::text as id, group_id::text as group_id, batch_date::text as batch_date, file_name, total_count, created_at::text as created_at FROM stock_batches WHERE group_id = $1 ORDER BY batch_date DESC LIMIT 1',
      [resolvedGroupId]
    )
    return result.rows[0] || null
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getLatestBatch(groupId)
    }
    console.error('Error getting latest batch:', error)
    return null
  }
}

export async function getPreviousBatch(currentDate: string, groupId?: string | number | null): Promise<StockBatch | null> {
  try {
    const client = await getClient()
    const normalizedDate = currentDate.split('T')[0]
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return null
    }
    const result = await client.query(
      "SELECT id::text as id, group_id::text as group_id, batch_date::TEXT as batch_date, file_name, total_count, created_at::text as created_at FROM stock_batches WHERE batch_date::TEXT < $1 AND group_id = $2 ORDER BY batch_date DESC LIMIT 1",
      [normalizedDate, resolvedGroupId]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error getting previous batch:', error)
    return null
  }
}

export async function getAllBatches(groupId?: string | number | null): Promise<StockBatch[] | null> {
  const resolvedGroupId = await resolveGroupId(groupId)
  if (!resolvedGroupId) {
    return null
  }
  const cacheKey = `batches_${resolvedGroupId}`
  const cached = getCache<StockBatch[]>(cacheKey)
  if (cached) {
    return cached
  }
  
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT id::text as id, group_id::text as group_id, batch_date::TEXT as batch_date, file_name, total_count, created_at::text as created_at FROM stock_batches WHERE group_id = $1 ORDER BY batch_date DESC',
      [resolvedGroupId]
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

export async function getDashboardOverview(recentLimit: number = 6, groupId?: string | number | null): Promise<DashboardOverview | null> {
  const normalizedGroupId = normalizeGroupId(groupId)
  const cachedDefaultGroupId = normalizedGroupId ? null : defaultGroupIdCache
  const cacheKey = cachedDefaultGroupId
    ? `dashboard_overview_${cachedDefaultGroupId}_${recentLimit}`
    : `dashboard_overview_${normalizedGroupId || 'default'}_${recentLimit}`
  const cached = getCache<DashboardOverview>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      WITH active_groups AS (
        SELECT COALESCE(json_agg(row_to_json(group_row)), '[]'::json) as groups
        FROM (
          SELECT id::text as id, name, is_active, created_at::text as created_at, updated_at::text as updated_at
          FROM stock_groups
          WHERE is_active = TRUE
          ORDER BY is_active DESC, created_at ASC, name ASC
        ) group_row
      ),
      requested_group AS (
        SELECT id, id::text as id_text
        FROM stock_groups
        WHERE $2::text IS NOT NULL
          AND id::text = $2::text
        LIMIT 1
      ),
      default_group AS (
        SELECT id, id::text as id_text
        FROM stock_groups
        WHERE name = $3
        LIMIT 1
      ),
      selected_group AS (
        SELECT id, id_text FROM requested_group
        UNION ALL
        SELECT id, id_text
        FROM default_group
        WHERE NOT EXISTS (SELECT 1 FROM requested_group)
        LIMIT 1
      ),
      latest_batch AS (
        SELECT id, batch_date
        FROM stock_batches
        WHERE group_id = (SELECT id FROM selected_group)
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
        WHERE batch_id = (SELECT id FROM latest_batch)
          AND group_id = (SELECT id FROM selected_group)
      ),
      recent_batches AS (
        SELECT COALESCE(json_agg(row_to_json(batch_row)), '[]'::json) as batches
        FROM (
          SELECT
            id::text as id,
            group_id::text as group_id,
            batch_date::text as batch_date,
            file_name,
            total_count,
            created_at::text as created_at
          FROM stock_batches
          WHERE group_id = (SELECT id FROM selected_group)
          ORDER BY batch_date DESC
          LIMIT $1::int
        ) batch_row
      ),
      batch_count AS (
        SELECT COUNT(*)::int as total_batch_count
        FROM stock_batches
        WHERE group_id = (SELECT id FROM selected_group)
      )
      SELECT
        (SELECT groups FROM active_groups) as groups,
        (SELECT id_text FROM selected_group) as selected_group_id,
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
      [recentLimit, normalizedGroupId || null, DEFAULT_STOCK_GROUP_NAME]
    )

    const row = result.rows[0]
    const selectedGroupId = row?.selected_group_id || ''
    const groups = row?.groups || []
    if (!selectedGroupId) {
      return null
    }
    if (!normalizedGroupId) {
      defaultGroupIdCache = selectedGroupId
    }
    setCache('groups_active', groups)
    const overview: DashboardOverview = {
      stats: row ? {
        today_count: Number(row.today_count) || 0,
        today_new: Number(row.today_new) || 0,
        today_removed: Number(row.today_removed) || 0,
        continuous_3d_count: Number(row.continuous_3d_count) || 0,
        continuous_5d_count: Number(row.continuous_5d_count) || 0
      } : emptyDashboardStats,
      batches: row?.batches || [],
      totalBatchCount: Number(row?.total_batch_count) || 0,
      groups,
      selectedGroupId
    }

    setCache(`dashboard_overview_${selectedGroupId}_${recentLimit}`, overview)
    if (cacheKey !== `dashboard_overview_${selectedGroupId}_${recentLimit}`) {
      setCache(cacheKey, overview)
    }
    return overview
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getDashboardOverview(recentLimit, groupId)
    }
    console.error('Error getting dashboard overview:', error)
    return null
  }
}

export async function getComparePageData(requestedDate?: string | null, groupId?: string | number | null): Promise<ComparePageData | null> {
  const normalizedGroupId = normalizeGroupId(groupId)
  const normalizedDate = requestedDate?.split('T')[0]
  const safeDate = normalizedDate && /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) ? normalizedDate : null
  const cachedDefaultGroupId = normalizedGroupId ? null : defaultGroupIdCache
  const cacheKey = cachedDefaultGroupId
    ? `compare_page_data_${cachedDefaultGroupId}_${safeDate || 'latest'}`
    : `compare_page_data_${normalizedGroupId || 'default'}_${safeDate || 'latest'}`
  const cached = getCache<ComparePageData>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      WITH active_groups AS (
        SELECT COALESCE(json_agg(row_to_json(group_row)), '[]'::json) as groups
        FROM (
          SELECT id::text as id, name, is_active, created_at::text as created_at, updated_at::text as updated_at
          FROM stock_groups
          WHERE is_active = TRUE
          ORDER BY is_active DESC, created_at ASC, name ASC
        ) group_row
      ),
      requested_group AS (
        SELECT id, id::text as id_text
        FROM stock_groups
        WHERE $1::text IS NOT NULL
          AND id::text = $1::text
        LIMIT 1
      ),
      default_group AS (
        SELECT id, id::text as id_text
        FROM stock_groups
        WHERE name = $2
        LIMIT 1
      ),
      selected_group AS (
        SELECT id, id_text FROM requested_group
        UNION ALL
        SELECT id, id_text
        FROM default_group
        WHERE NOT EXISTS (SELECT 1 FROM requested_group)
        LIMIT 1
      ),
      batches AS (
        SELECT
          id,
          id::text as id_text,
          group_id::text as group_id,
          batch_date::text as batch_date,
          batch_date as raw_batch_date,
          file_name,
          total_count,
          created_at::text as created_at
        FROM stock_batches
        WHERE group_id = (SELECT id FROM selected_group)
      ),
      batch_json AS (
        SELECT COALESCE(json_agg(row_to_json(batch_row)), '[]'::json) as batches
        FROM (
          SELECT id_text as id, group_id, batch_date, file_name, total_count, created_at
          FROM batches
          ORDER BY raw_batch_date DESC
        ) batch_row
      )
      SELECT
        (SELECT groups FROM active_groups) as groups,
        (SELECT id_text FROM selected_group) as selected_group_id,
        (SELECT batches FROM batch_json) as batches
      `,
      [normalizedGroupId || null, DEFAULT_STOCK_GROUP_NAME]
    )

    const row = result.rows[0]
    const selectedGroupId = row?.selected_group_id || ''
    if (!selectedGroupId) {
      return null
    }
    if (!normalizedGroupId) {
      defaultGroupIdCache = selectedGroupId
    }
    const groups = row?.groups || []
    setCache('groups_active', groups)
    const batches = row?.batches || []
    const selectedBatch = safeDate
      ? batches.find((batch: StockBatch) => batch.batch_date.split('T')[0] === safeDate) || batches[0]
      : batches[0]

    const compareResult = selectedBatch
      ? await client.query(
        `
          SELECT
            id::text as id,
            batch_id::text as batch_id,
            group_id::text as group_id,
            trade_date::text as trade_date,
            stock_code,
            stock_name,
            status,
            continuous_count,
            total_appear_count,
            last_seen_date::text as last_seen_date,
            created_at::text as created_at
          FROM stock_compare_results
          WHERE batch_id = $1
            AND group_id = $2
          ORDER BY status, stock_code
        `,
        [selectedBatch.id, selectedGroupId]
      )
      : { rows: [] }

    const pageData: ComparePageData = {
      groups,
      selectedGroupId,
      batches,
      selectedDate: selectedBatch?.batch_date || '',
      results: compareResult.rows || []
    }

    setCache(`compare_page_data_${selectedGroupId}_${safeDate || 'latest'}`, pageData)
    if (cacheKey !== `compare_page_data_${selectedGroupId}_${safeDate || 'latest'}`) {
      setCache(cacheKey, pageData)
    }
    return pageData
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getComparePageData(requestedDate, groupId)
    }
    console.error('Error getting compare page data:', error)
    return null
  }
}

export async function createCompareResults(results: Omit<StockCompareResult, 'id' | 'created_at'>[]): Promise<StockCompareResult[] | null> {
  try {
    if (results.length === 0) {
      return []
    }

    const client = await getClient()
    const values = results.map((item, index) => 
      `($${index * 9 + 1}, $${index * 9 + 2}, $${index * 9 + 3}, $${index * 9 + 4}, $${index * 9 + 5}, $${index * 9 + 6}, $${index * 9 + 7}, $${index * 9 + 8}, $${index * 9 + 9})`
    ).join(', ')
    
    const params = results.flatMap(item => [item.batch_id, item.group_id, item.trade_date, item.stock_code, item.stock_name, item.status, item.continuous_count, item.total_appear_count, item.last_seen_date || null])
    
    const result = await client.query(
      `INSERT INTO stock_compare_results (batch_id, group_id, trade_date, stock_code, stock_name, status, continuous_count, total_appear_count, last_seen_date) VALUES ${values} RETURNING id::text as id, batch_id::text as batch_id, group_id::text as group_id, trade_date::text as trade_date, stock_code, stock_name, status, continuous_count, total_appear_count, last_seen_date::text as last_seen_date, created_at::text as created_at`,
      params
    )
    
    invalidateStockPageCaches(results[0]?.trade_date, results[0]?.group_id)
    if (results.length > 0) {
      invalidateCache(`compare_results_${results[0].group_id}_${results[0].trade_date}`)
    }
    
    return result.rows
  } catch (error) {
    console.error('Error creating compare results:', error)
    return null
  }
}

export async function deleteCompareResultsByDate(date: string, groupId?: string | number | null): Promise<boolean> {
  try {
    const client = await getClient()
    const normalizedDate = date.split('T')[0]
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return false
    }
    await client.query('DELETE FROM stock_compare_results WHERE trade_date = $1 AND group_id = $2', [normalizedDate, resolvedGroupId])
    invalidateStockPageCaches(normalizedDate, resolvedGroupId)
    return true
  } catch (error) {
    console.error('Error deleting compare results:', error)
    return false
  }
}

export async function deleteCompareResultsByBatchIds(batchIds: Array<string | number>, groupId?: string | number | null): Promise<boolean> {
  try {
    if (batchIds.length === 0) {
      return true
    }

    const client = await getClient()
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return false
    }
    await client.query(
      'DELETE FROM stock_compare_results WHERE batch_id = ANY($1::int[]) AND group_id = $2',
      [batchIds.map(Number), resolvedGroupId]
    )
    invalidateStockPageCaches(undefined, resolvedGroupId)
    return true
  } catch (error) {
    console.error('Error deleting compare results by batch ids:', error)
    return false
  }
}

export async function getCompareResultsByDate(date: string, groupId?: string | number | null): Promise<StockCompareResult[] | null> {
  const normalizedDate = date.split('T')[0]
  const resolvedGroupId = await resolveGroupId(groupId)
  if (!resolvedGroupId) {
    return null
  }
  const cacheKey = `compare_results_${resolvedGroupId}_${normalizedDate}`
  const cached = getCache<StockCompareResult[]>(cacheKey)
  if (cached) {
    return cached
  }
  
  try {
    const client = await getClient()
    const result = await client.query(
      'SELECT id::text as id, batch_id::text as batch_id, group_id::text as group_id, trade_date::text as trade_date, stock_code, stock_name, status, continuous_count, total_appear_count, last_seen_date::text as last_seen_date, created_at::text as created_at FROM stock_compare_results WHERE trade_date = $1 AND group_id = $2 ORDER BY status, stock_code',
      [normalizedDate, resolvedGroupId]
    )
    setCache(cacheKey, result.rows)
    return result.rows
  } catch (error) {
    console.error('Error getting compare results:', error)
    return null
  }
}

export async function getDashboardStats(groupId?: string | number | null): Promise<DashboardStats | null> {
  const resolvedGroupId = await resolveGroupId(groupId)
  if (!resolvedGroupId) {
    return emptyDashboardStats
  }
  const cacheKey = `dashboard_stats_${resolvedGroupId}`
  const cached = getCache<DashboardStats>(cacheKey)
  if (cached) {
    return cached
  }
  
  try {
    const client = await getClient()
    
    const latestBatchResult = await client.query(
      'SELECT id, batch_date::TEXT as batch_date FROM stock_batches WHERE group_id = $1 ORDER BY batch_date DESC LIMIT 1',
      [resolvedGroupId]
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
        WHERE batch_id = $1
          AND group_id = $2
      `, [latestBatch.id, resolvedGroupId])
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

export async function getStockDetail(stockCode: string, groupId?: string | number | null): Promise<StockDetail | null> {
  try {
    const client = await getClient()
    const resolvedGroupId = await resolveGroupId(groupId)
    if (!resolvedGroupId) {
      return null
    }
    const result = await client.query(
      `
      SELECT item.trade_date::text as trade_date, item.stock_name
      FROM stock_pool_items item
      INNER JOIN stock_batches batch ON batch.id = item.batch_id
      WHERE item.stock_code = $1
        AND batch.group_id = $2
      ORDER BY item.trade_date
      `,
      [stockCode, resolvedGroupId]
    )
    
    if (!result.rows || result.rows.length === 0) {
      return null
    }

    const stockName = result.rows[0].stock_name
    const appearanceDates = [...new Set(result.rows.map((item: { trade_date: string }) => item.trade_date))].sort()
    
    let breakCount = 0
    let currentContinuous = 0
    
    currentContinuous = appearanceDates.length

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
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getStockDetail(stockCode, groupId)
    }
    console.error('Error getting stock detail:', error)
    return null
  }
}

export async function getContinuousRanking(minDays: number = 2, groupId?: string | number | null): Promise<StockCompareResult[] | null> {
  const resolvedGroupId = await resolveGroupId(groupId)
  if (!resolvedGroupId) {
    return null
  }
  const cacheKey = `continuous_ranking_${resolvedGroupId}_${minDays}`
  const cached = getCache<StockCompareResult[]>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      WITH latest_batch AS (
        SELECT id
        FROM stock_batches
        WHERE group_id = $2
        ORDER BY batch_date DESC
        LIMIT 1
      )
      SELECT
        id::text as id,
        batch_id::text as batch_id,
        group_id::text as group_id,
        trade_date::text as trade_date,
        stock_code,
        stock_name,
        status,
        continuous_count,
        total_appear_count,
        last_seen_date::text as last_seen_date,
        created_at::text as created_at
      FROM stock_compare_results
      WHERE batch_id = (SELECT id FROM latest_batch)
        AND group_id = $2
        AND continuous_count >= $1
      ORDER BY continuous_count DESC, stock_code
      `,
      [minDays, resolvedGroupId]
    )
    setCache(cacheKey, result.rows)
    return result.rows
  } catch (error) {
    console.error('Error getting continuous ranking:', error)
    return null
  }
}

function normalizeMetadataConcepts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return normalizeMetadataConcepts(parsed)
    } catch {
      return value.split(/[;,，、]/).map((item) => item.trim()).filter(Boolean)
    }
  }

  return []
}

function mapStockMetadataRow(row: {
  stock_code: string
  stock_name: string
  industry?: string | null
  concepts?: unknown
  source?: string | null
  fetched_at?: string
  updated_at?: string
}): StockMetadata {
  return {
    stock_code: row.stock_code,
    stock_name: row.stock_name,
    industry: row.industry || null,
    concepts: normalizeMetadataConcepts(row.concepts),
    source: row.source || null,
    fetched_at: row.fetched_at,
    updated_at: row.updated_at,
  }
}

export async function getStockMetadataByCodes(stockCodes: string[]): Promise<StockMetadata[]> {
  const uniqueCodes = [...new Set(stockCodes.map((code) => String(code).trim()).filter(Boolean))]
  if (uniqueCodes.length === 0) {
    return []
  }

  try {
    const client = await getClient()
    const result = await client.query(
      `
      SELECT
        stock_code,
        stock_name,
        industry,
        concepts,
        source,
        fetched_at::text as fetched_at,
        updated_at::text as updated_at
      FROM stock_metadata
      WHERE stock_code = ANY($1::text[])
      `,
      [uniqueCodes]
    )

    return result.rows.map(mapStockMetadataRow)
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return getStockMetadataByCodes(stockCodes)
    }
    console.error('Error getting stock metadata:', error)
    return []
  }
}

export async function upsertStockMetadata(
  metadataItems: Omit<StockMetadata, 'fetched_at' | 'updated_at'>[]
): Promise<StockMetadata[] | null> {
  const normalizedItems = metadataItems
    .map((item) => ({
      stock_code: String(item.stock_code).trim(),
      stock_name: String(item.stock_name).trim(),
      industry: item.industry?.trim() || null,
      concepts: [...new Set((item.concepts || []).map((concept) => concept.trim()).filter(Boolean))],
      source: item.source?.trim() || null,
    }))
    .filter((item) => item.stock_code && item.stock_name)

  if (normalizedItems.length === 0) {
    return []
  }

  try {
    const client = await getClient()
    const values: unknown[] = []
    const placeholders = normalizedItems.map((item, index) => {
      const offset = index * 5
      values.push(item.stock_code, item.stock_name, item.industry, JSON.stringify(item.concepts), item.source)
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::jsonb, $${offset + 5}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    })

    const result = await client.query(
      `
      INSERT INTO stock_metadata (
        stock_code,
        stock_name,
        industry,
        concepts,
        source,
        fetched_at,
        updated_at
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (stock_code) DO UPDATE SET
        stock_name = EXCLUDED.stock_name,
        industry = EXCLUDED.industry,
        concepts = EXCLUDED.concepts,
        source = EXCLUDED.source,
        fetched_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        stock_code,
        stock_name,
        industry,
        concepts,
        source,
        fetched_at::text as fetched_at,
        updated_at::text as updated_at
      `,
      values
    )

    return result.rows.map(mapStockMetadataRow)
  } catch (error) {
    if (isMissingRelationError(error)) {
      await ensureTables()
      return upsertStockMetadata(metadataItems)
    }
    console.error('Error upserting stock metadata:', error)
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

export async function upsertReportTemplate(id: string, input: ReportTemplateInput): Promise<ReportTemplateRecord | null> {
  try {
    const client = await getClient()
    const result = await client.query(
      `INSERT INTO report_templates (id, name, content)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           content = EXCLUDED.content,
           updated_at = CURRENT_TIMESTAMP
       RETURNING id, name, content, created_at::TEXT as created_at, updated_at::TEXT as updated_at`,
      [id, input.name, input.content]
    )
    return result.rows[0] || null
  } catch (error) {
    console.error('Error upserting report template:', error)
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
