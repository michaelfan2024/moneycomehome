# Stock Groups Design

## Goal

Add group support to the stock pool upload, daily comparison, and continuous ranking workflows. Each group is an independent upload timeline. Data can only be compared within the same group, and continuous rankings are generated from that group's own batch history.

## Approved Decisions

- Groups are independent timelines.
- Existing historical data migrates into the default group named `每日火车股票池`.
- Users can add groups, rename groups, and deactivate/reactivate groups.
- Upload, dashboard, daily comparison, and continuous ranking views all use a selected group.
- Continuous count is based on consecutive uploads within the same group, not consecutive calendar days.
- A group's first uploaded batch is only a baseline and does not generate comparison results.
- Re-uploading the same date in the same group replaces that group's existing data for that date.
- Re-uploading or changing a historical batch recalculates comparison results for that group from the changed batch forward.

## Data Model

Add a new `stock_groups` table:

- `id`
- `name`
- `is_active`
- `created_at`
- `updated_at`

Initialize the table with one default group, `每日火车股票池`.

Extend `stock_batches`:

- Add `group_id`.
- Replace the global `batch_date UNIQUE` rule with `UNIQUE(group_id, batch_date)`.
- Keep each upload as one batch belonging to one group.

Extend `stock_compare_results`:

- Add `batch_id`.
- Add `group_id` for direct filtering and indexing.
- Replace `UNIQUE(trade_date, stock_code)` with `UNIQUE(batch_id, stock_code)`.
- Keep `trade_date` as a display and compatibility field, but treat `batch_id` and `group_id` as the business keys.

## Migration

The migration should be safe for existing installations:

1. Create `stock_groups` if it does not exist.
2. Insert `每日火车股票池` if missing.
3. Add nullable `group_id` to `stock_batches`, backfill all existing batches to the default group, then make it required.
4. Add nullable `batch_id` and `group_id` to `stock_compare_results`.
5. Backfill comparison rows by matching `stock_compare_results.trade_date` to the default group's `stock_batches.batch_date`.
6. Add or replace indexes and unique constraints for group-aware queries.
7. Keep legacy API behavior by resolving missing `groupId` to the default group.

## Upload Flow

The upload page requires a group before import:

1. User creates a group or selects an active group.
2. User selects date and uploads/pastes stock data.
3. API looks up an existing batch by `groupId + date`.
4. If a batch exists, replace that batch's stock items and delete affected comparison results for that group from that batch forward.
5. Save the new batch and stock items.
6. Find the previous batch in the same group by batch order/date.
7. If no previous batch exists, stop after saving baseline data.
8. If a previous batch exists, compute comparisons using only batches from the same group.

## Comparison Rules

Daily comparison is group-local:

- Current stocks come from the selected group's selected batch.
- Previous stocks come from that same group's immediately previous uploaded batch.
- Historical appearances only include that same group.
- Stocks from other groups never affect status, total appearance count, or continuous count.

Status semantics remain:

- `first_seen`: appears for the first time in this group.
- `continued`: appears in both current and previous group batches.
- `reappeared`: appears in current group batch, not previous group batch, but existed earlier in the same group.
- `removed`: appeared in previous group batch but not current group batch.

The first batch in a group does not create comparison rows, so the daily comparison page should show a baseline empty state for that group/date.

## Continuous Count

Continuous count is based on consecutive uploaded batches in the same group.

If a group uploads on May 10 and May 13, and the same stock appears in both uploads, the May 13 comparison should count the stock as continuous for 2 group batches. Missing calendar days do not break continuity.

If a stock is absent from any uploaded batch in that group, its continuous count resets when it appears again.

## Recalculation

Recalculation must be scoped to one group:

- Recalculate only the changed group's batches.
- Start from the changed/deleted/updated batch position.
- Delete stale comparison rows for affected batches.
- Rebuild comparison rows in group batch order.
- Do not touch other groups.

Deleting or editing a batch date should also recalculate only that batch's group.

## API Design

Add group APIs:

- `GET /api/stocks/groups`
- `POST /api/stocks/groups`
- `PUT /api/stocks/groups?id=<id>`

Group update supports:

- Rename group.
- Deactivate group.
- Reactivate group.

Adjust existing APIs to accept `groupId`:

- `POST /api/stocks/upload`
- `POST /api/stocks/upload/text`
- `GET /api/stocks/dashboard`
- `GET /api/stocks/batches`
- `DELETE /api/stocks/batches`
- `PUT /api/stocks/batch`
- `DELETE /api/stocks/batch`
- `GET /api/stocks/compare`
- `GET /api/stocks/compare/page-data`
- `POST /api/stocks/compare/recalculate`
- `GET /api/stocks/ranking`
- `GET /api/stocks/detail`

When `groupId` is absent, APIs should resolve to the default group for backward compatibility.

Recommended URLs:

- `/compare?groupId=<id>&date=2026-05-14`
- `/ranking?groupId=<id>&minDays=3`

Old URLs such as `/compare?date=2026-05-14` should still open using `每日火车股票池`.

## Page Design

Dashboard:

- Add a group selector near the top.
- Default to `每日火车股票池`.
- Show stats and historical batches only for the selected group.
- Keep links to comparison and ranking pages with `groupId` in the URL.

Upload:

- Add group selection before date selection.
- Disable import until an active group is selected.
- Add a quick "new group" action near the group selector.
- Update upload guidance to say same group and date uploads replace existing data.

Daily comparison:

- Add group selector.
- Date selector lists only selected group's batches.
- Results and summary cards only use the selected group.
- If a selected date is a baseline batch with no comparison rows, show: `当前组已有基准数据，上传下一份数据后生成对比结果`.

Continuous ranking:

- Add group selector.
- Ranking uses the selected group's latest comparable batch.
- Minimum-days filter remains unchanged.

Group management:

- Place the main management entry in Settings.
- Show active and inactive groups.
- Allow add, rename, deactivate, and reactivate.
- Deactivated groups are hidden from upload and normal selectors, but their historical data remains queryable.

## Testing Requirements

Unit tests should cover:

- Default group creation and fallback resolution.
- Same date can be uploaded in different groups.
- Same group and same date upload replaces only that group's batch.
- First group batch creates no comparison results.
- Second group batch creates comparison results.
- Continuous count follows group upload sequence rather than calendar-day adjacency.
- Recalculation after replacement affects only the changed group and its later batches.
- Inactive groups are excluded from upload selectors.
- Dashboard, comparison, and ranking data are isolated by group.

Integration or route tests should cover:

- Upload APIs with `groupId`.
- Legacy upload/query behavior without `groupId` falling back to `每日火车股票池`.
- Comparison page data with group-specific date lists.
- Ranking API with group-specific results.

Run:

- `pnpm test`
- `pnpm build`

## Out of Scope

- Cross-group comparison.
- Moving a batch from one group to another.
- Merging groups.
- Per-stock membership in multiple groups inside one upload.
- Role-based permissions for group management.
