# Scheduled sync jobs

These jobs used to run from a Kestra container (`kestra-ted` in
`docker-compose.yml`, flows in `kestra/flows/`). Kestra was removed. Nothing
calls these routes on a schedule now. Point any external scheduler (cron,
systemd timer, n8n, GitHub Actions, etc.) at the routes below to restore them.

## How each call worked

- Schedule: every job ran hourly, cron `0 * * * *` (minute 0 of every hour).
- Request: `POST http://tender-executive-dashboard:3126<route>` from inside the
  `infra` Docker network. Outside Docker, use the app's public URL.
- Body: none. `/api/sync-bom` accepts optional JSON (see below).
- Auth: every route calls `requireApiKey` (`lib/dal.ts`). Send the key as
  `Authorization: Bearer <key>` or `x-api-key: <key>`. The key must equal the
  app's `EXTERNAL_API_KEY` env var. Kestra read it from its
  `KESTRA_EXTERNAL_API_KEY` secret.
- Proxy: the routes are listed in `publicApiPaths` in `proxy.ts`, so they skip
  the session login check and rely on the API key only.
- Logging: every route wraps its work in `withLog`, so each run writes an
  activity-log entry.

Example:

```sh
curl -X POST http://tender-executive-dashboard:3126/api/sync-dockets \
  -H "x-api-key: $EXTERNAL_API_KEY"
```

## Jobs

The order below is the order data flows in. All four jobs fired at the same
minute, so in practice each run usually picked up the previous hour's output
of the job before it.

### 1. `sync_dockets` — `POST /api/sync-dockets`

- Code: `services/smartsheetDocketSync.ts` (`syncDocketFromSmartsheet`).
- Acts on: `TenderMerged` rows where `docketNo` is `null` or empty.
- Does: matches the tender `referenceNo` against the Smartsheet columns
  "Email Subject Line (Debosmita Nath)" and "Enquiry Tender No (Marketing
  Team)". On a match, copies "Docket No (Debosmita Nath)" from the same row
  into `docketNo`.
- Secondary lookup only. The main docket source is the Google Sheet
  "Docket No-enq" flow.

### 2. `sync_costing_smartsheet` — `POST /api/sync-costing-smartsheet`

- Code: `services/smartsheetCostingSync.ts` (`syncCostingFromSmartsheet`).
- Acts on: `TenderMerged` rows that have a non-empty `docketNo` and no
  `CostingSheetDetails` rows yet.
- Does: reads Smartsheet sheet `SALES_ENQUIRY_ITEM_LIST_ERP_ID` (default
  `2033506099089284`) by "DOCKET NO.". Parses "PROPOSE ERP ITEM NAME @ CODE"
  and QTY, enriches each item from `Items.itemSchedule`, then inserts
  `CostingSheetDetails`. Rows without an item name are skipped.

### 3. `sync_bom` — `POST /api/sync-bom`

- Code: `services/bomSync.ts` (`syncBomFromItemSchedule`). Route
  `maxDuration` is 300 s.
- Acts on: every distinct `CostingSheetDetails.proposedErpItemName`.
- Does: looks the names up in batches against the BOM item-schedule API
  (`BOM_API_URL`, `BOM_API_KEY`) and upserts `Bom` rows keyed by
  `(itemCode, bomId)`.
- Optional JSON body (the scheduler sent none):
  `limit`, `batchSize`, `dryRun`, `verbose`, `apiUrl`, `itemNames[]`.

### 4. `sync_to_merged` — `POST /api/sync-to-merged`

- Code: `services/sheetToTenderMergedService.ts` (`syncSheetToTenderMerged`).
- Acts on: Google Sheet tender rows fetched with
  `onlyTendersMissingCosting: true`, matched to `TenderMerged` by
  "Tender No / NIT No" = `referenceNo`.
- Does: for each matched row that has an attachment URL, replaces the tender's
  `COSTING_ATTACHMENT` `TenderFile` with the sheet URL (source `SHEET_SYNC`) and
  publishes a costing parsing job to the queue (`publishCostingParsingJob`).

## Removed jobs

The WhatsApp notification flows and the `/api/test` flow were removed earlier.
They were already disabled. See `docs/notifications.md`.
