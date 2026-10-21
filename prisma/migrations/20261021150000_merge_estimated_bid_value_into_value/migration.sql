-- Data-only migration: estimatedBidValue is scrapped; its amounts move into
-- "value". No schema change; the column stays (unused) until a later drop.
--
-- Rule: "value" wins unless it is empty, not a plain number ("NA",
-- "Not visible", PDF text) or 0, and estimatedBidValue is a plain number > 0.
-- The CASEs keep ::numeric away from non-numeric text.

UPDATE "tender_merged"
SET "value" = btrim("estimatedBidValue")
WHERE (CASE WHEN btrim("estimatedBidValue") ~ '^[0-9]+(\.[0-9]+)?$'
            THEN btrim("estimatedBidValue")::numeric > 0 ELSE false END)
  AND (CASE WHEN btrim("value") ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN btrim("value")::numeric = 0 ELSE true END);

UPDATE "gem_tenders"
SET "value" = btrim("estimatedBidValue")
WHERE (CASE WHEN btrim("estimatedBidValue") ~ '^[0-9]+(\.[0-9]+)?$'
            THEN btrim("estimatedBidValue")::numeric > 0 ELSE false END)
  AND (CASE WHEN btrim("value") ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN btrim("value")::numeric = 0 ELSE true END);

-- Imports: headers mapped to estimatedBidValue now map to value. A header
-- that already has a value mapping only loses its duplicate.
DELETE FROM "column_mappings" m
WHERE m."dbField" = 'estimatedBidValue'
  AND EXISTS (SELECT 1 FROM "column_mappings" v
              WHERE v."excelHeader" = m."excelHeader" AND v."dbField" = 'value');

UPDATE "column_mappings"
SET "dbField" = 'value', "updatedAt" = CURRENT_TIMESTAMP
WHERE "dbField" = 'estimatedBidValue';
