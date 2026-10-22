-- estimatedBidValue was merged into value (20261021150000). The "Value" column
-- group stacked value with estimatedBidValue and the old "Tender Value in Rs"
-- header; only value is left, so retire the group and let the plain value
-- column (rupee slider and currency cells) show instead.
UPDATE "column_groups"
SET "status" = 'deleted', "updatedAt" = now()
WHERE "status" = 'active' AND "fields" LIKE '%estimatedBidValue%';
