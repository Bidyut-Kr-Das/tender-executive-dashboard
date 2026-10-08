import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Shared S3 upload utility.
 *
 * Two upload flows are supported:
 *
 * 1. Client-direct (presigned) — recommended for user uploads:
 *      a. Server: `const { uploadUrl, publicUrl, key } = await createPresignedUpload({ fileName, contentType, folder })`
 *      b. Client: `await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": contentType } })`
 *      c. Server: store `publicUrl` (and `key`) and create the DB entry.
 *
 * 2. Server-side (file already on disk) — for scripts/jobs:
 *      `const { publicUrl, key } = await uploadLocalFile(absPath, { folder })`
 *
 * Required env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME
 * Optional env:
 *   S3_ENDPOINT          — custom S3-compatible host (MinIO, Ceph, R2, ...); enables path-style.
 *   S3_PUBLIC_BASE_URL   — custom/CDN base for the permanent public URL.
 *   S3_ACL               — canned ACL to send (default: "public-read" for AWS, none for custom endpoints).
 */

const REGION = process.env.AWS_REGION ?? "us-east-1";
const BUCKET = process.env.S3_BUCKET_NAME ?? "";
const ENDPOINT = process.env.S3_ENDPOINT?.replace(/\/+$/, "") || undefined;
// MinIO/self-hosted buckets usually enforce public access via a bucket policy
// (mc anonymous set download), not canned ACLs — so only send an ACL for AWS
// unless S3_ACL is set explicitly.
const ACL = (process.env.S3_ACL ?? (ENDPOINT ? undefined : "public-read")) as
  | ObjectCannedACL
  | undefined;

let client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!client) {
    if (!BUCKET) throw new Error("S3_BUCKET_NAME is not set");
    client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      forcePathStyle: Boolean(ENDPOINT),
    });
  }
  return client;
}

export function buildPublicUrl(key: string): string {
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (base) return `${base}/${key}`;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  if (ENDPOINT) return `${ENDPOINT}/${BUCKET}/${encoded}`;
  const host =
    REGION === "us-east-1"
      ? `https://${BUCKET}.s3.amazonaws.com`
      : `https://${BUCKET}.s3.${REGION}.amazonaws.com`;
  return `${host}/${encoded}`;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildKey(fileName: string, folder?: string): string {
  const prefix = folder
    ? folder.split("/").filter(Boolean).map(sanitizeSegment).join("/") + "/"
    : "";
  return `${prefix}${crypto.randomUUID()}-${sanitizeSegment(fileName)}`;
}

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

/** Generate a presigned PUT URL for a client-direct upload. */
export async function createPresignedUpload(input: {
  fileName: string;
  contentType?: string;
  folder?: string;
  expiresIn?: number;
}): Promise<PresignedUpload> {
  const key = buildKey(input.fileName, input.folder);
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: input.contentType || "application/octet-stream",
    ACL,
  });
  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: input.expiresIn ?? 600,
  });
  return { key, uploadUrl, publicUrl: buildPublicUrl(key) };
}

async function putObject(
  key: string,
  body: Buffer | fs.ReadStream,
  contentType: string,
): Promise<string> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL,
    }),
  );
  return buildPublicUrl(key);
}

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".txt": "text/plain",
};

export function contentTypeFor(fileName: string): string {
  return CONTENT_TYPES[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
}

/** Upload a Buffer (server-side). */
export async function uploadBuffer(
  buffer: Buffer,
  input: { fileName: string; contentType?: string; folder?: string },
): Promise<{ key: string; publicUrl: string }> {
  const key = buildKey(input.fileName, input.folder);
  const publicUrl = await putObject(
    key,
    buffer,
    input.contentType || contentTypeFor(input.fileName),
  );
  return { key, publicUrl };
}

/** Upload a file already on disk (server-side, streamed). */
export async function uploadLocalFile(
  absPath: string,
  input: { key?: string; fileName?: string; contentType?: string; folder?: string } = {},
): Promise<{ key: string; publicUrl: string }> {
  const fileName = input.fileName ?? path.basename(absPath);
  const key = input.key ?? buildKey(fileName, input.folder);
  const publicUrl = await putObject(
    key,
    fs.createReadStream(absPath),
    input.contentType || contentTypeFor(fileName),
  );
  return { key, publicUrl };
}

export async function deleteObject(key: string): Promise<void> {
  await getS3Client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
