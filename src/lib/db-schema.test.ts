import { describe, expect, it } from 'vitest'
import { isStockGroupSchemaReady, type StockGroupSchemaReadiness } from './db-schema'

const readySchema: StockGroupSchemaReadiness = {
  stock_groups_table_exists: true,
  stock_batches_table_exists: true,
  stock_pool_items_table_exists: true,
  stock_compare_results_table_exists: true,
  report_templates_table_exists: true,
  stock_financial_reports_table_exists: true,
  default_group_exists: true,
  batch_group_column_exists: true,
  batch_group_column_required: true,
  compare_batch_column_exists: true,
  compare_batch_column_required: true,
  compare_group_column_exists: true,
  compare_group_column_required: true,
  batch_group_date_constraint_exists: true,
  compare_batch_code_constraint_exists: true
}

describe('isStockGroupSchemaReady', () => {
  it('returns true only when all required group schema checks pass', () => {
    expect(isStockGroupSchemaReady(readySchema)).toBe(true)
  })

  it('returns false when the default group is missing', () => {
    expect(isStockGroupSchemaReady({ ...readySchema, default_group_exists: false })).toBe(false)
  })

  it('returns false when group-aware comparison columns are not required yet', () => {
    expect(isStockGroupSchemaReady({ ...readySchema, compare_group_column_required: false })).toBe(false)
  })
})
