# Ranking Table Filters Design

## Context

The first ranking filter implementation used native multi-select controls above the table. In practice this is hard to use: filters apply immediately, several filter families combine with AND, and an empty result does not make it obvious which condition removed all rows.

## Goal

Make the continuous ranking page work like an analysis table: users first see the ranking rows for a group and minimum continuous-days condition, then refine, sort, export, or generate an AI report from the visible rows.

## UX Design

- Keep the top query area focused on base ranking scope:
  - group
  - minimum continuous days
  - explicit query/filter button
  - result count
- Show enriched fields directly in the table:
  - stock code
  - stock name
  - continuous days
  - total appearances
  - industry
  - concepts
  - latest report period
  - net profit
  - net profit YoY
  - revenue YoY
  - ROE
- Move filtering closer to the table:
  - industry filter is a table-level checkbox list with search, similar to Excel.
  - financial thresholds are explicit inputs that apply only after the user clicks the filter button.
  - empty results show active filters and a reset action.
- Sorting happens by clicking table headers for:
  - continuous days
  - total appearances
  - net profit
  - net profit YoY
  - revenue YoY
  - ROE

## Data Design

The existing ranking API already returns industry, concepts, and latest financial growth metrics. Extend the financial snapshot with net profit amount from `stock_financial_reports.net_profit`. CSV export and AI report context should include the amount when available.

## Constraints

- Filtering remains client-side after the base ranking query so users can adjust table filters quickly.
- The AI report and CSV export use the current visible rows.
- Missing financial values sort after available values and do not match active minimum thresholds.
