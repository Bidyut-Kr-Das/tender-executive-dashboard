-- value always holds plain rupees; "0" means no amount. New rows default to
-- '0', and existing empty values are backfilled so the column is all numbers.
ALTER TABLE "tender_merged" ALTER COLUMN "value" SET DEFAULT '0';

UPDATE "tender_merged" SET "value" = '0' WHERE "value" IS NULL OR btrim("value") = '';
