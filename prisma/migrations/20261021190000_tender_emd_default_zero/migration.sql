-- emd always holds plain rupees; "0" means no EMD amount. New rows default to
-- '0', and existing empty values are backfilled so the column is all numbers.
ALTER TABLE "tender_merged" ALTER COLUMN "emd" SET DEFAULT '0';

UPDATE "tender_merged" SET "emd" = '0' WHERE "emd" IS NULL OR btrim("emd") = '';
