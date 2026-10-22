-- A deactivated user cannot sign in, and their open sessions end on the next
-- session check. Every existing user stays active.
ALTER TABLE "users" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
