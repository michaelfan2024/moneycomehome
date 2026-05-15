export interface StockGroupSchemaReadiness {
  stock_groups_table_exists: boolean
  stock_batches_table_exists: boolean
  stock_pool_items_table_exists: boolean
  stock_compare_results_table_exists: boolean
  report_templates_table_exists: boolean
  stock_financial_reports_table_exists: boolean
  stock_metadata_table_exists: boolean
  default_group_exists: boolean
  batch_group_column_exists: boolean
  batch_group_column_required: boolean
  compare_batch_column_exists: boolean
  compare_batch_column_required: boolean
  compare_group_column_exists: boolean
  compare_group_column_required: boolean
  batch_group_date_constraint_exists: boolean
  compare_batch_code_constraint_exists: boolean
  stock_metadata_stock_code_key_exists: boolean
}

export function isStockGroupSchemaReady(readiness: StockGroupSchemaReadiness): boolean {
  const requiredChecks: (keyof StockGroupSchemaReadiness)[] = [
    'stock_groups_table_exists',
    'stock_batches_table_exists',
    'stock_pool_items_table_exists',
    'stock_compare_results_table_exists',
    'report_templates_table_exists',
    'stock_financial_reports_table_exists',
    'stock_metadata_table_exists',
    'default_group_exists',
    'batch_group_column_exists',
    'batch_group_column_required',
    'compare_batch_column_exists',
    'compare_batch_column_required',
    'compare_group_column_exists',
    'compare_group_column_required',
    'batch_group_date_constraint_exists',
    'compare_batch_code_constraint_exists',
    'stock_metadata_stock_code_key_exists',
  ]

  return requiredChecks.every((check) => readiness[check] === true)
}
