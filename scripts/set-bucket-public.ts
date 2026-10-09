import "dotenv/config";
import { PutBucketPolicyCommand } from "@aws-sdk/client-s3";
import { getS3Client, BUCKET } from "../lib/s3";

function policy(bucket: string) {
  return JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

async function main() {
  if (!BUCKET) throw new Error("S3_BUCKET_NAME is not set");
  await getS3Client().send(
    new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: policy(BUCKET) }),
  );
  console.log(`[bucket-policy] public-read (GetObject) applied to "${BUCKET}"`);
}

main().catch((err) => {
  console.error("[bucket-policy] FAILED:", err);
  process.exit(1);
});
