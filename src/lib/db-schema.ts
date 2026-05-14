export interface StockGroupSchemaReadiness {
  stock_groups_table_exists: boolean
  stock_batches_table_exists: boolean
  stock_pool_items_table_exists: boolean
  stock_compare_results_table_exists: boolean
  report_templates_table_exists: boolean
  stock_financial_reports_table_exists: boolean
  default_group_exists: boolean
  batch_group_column_exists: boolean
  batch_group_column_required: boolean
  compare_batch_column_exists: boolean
  compare_batch_column_required: boolean
  compare_group_column_exists: boolean
  compare_group_column_required: boolean
  batch_group_date_constraint_exists: boolean
  compare_batch_code_constraint_exists: boolean
}

export function isStockGroupSchemaReady(readiness: StockGroupSchemaReadiness): boolean {
  return Object.values(readiness).every(Boolean)
}
