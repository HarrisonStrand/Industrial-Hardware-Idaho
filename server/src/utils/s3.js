import { S3Client } from "@aws-sdk/client-s3";

function cleanEnv(value = "") {
  return String(value || "").trim();
}

export const AWS_REGION = cleanEnv(process.env.AWS_REGION);
export const AWS_ACCESS_KEY_ID = cleanEnv(process.env.AWS_ACCESS_KEY_ID);
export const AWS_SECRET_ACCESS_KEY = cleanEnv(process.env.AWS_SECRET_ACCESS_KEY);
export const S3_BUCKET = cleanEnv(process.env.S3_BUCKET_NAME);
export const S3_PUBLIC_BASE_URL = cleanEnv(process.env.S3_PUBLIC_BASE_URL);

export function maskAwsAccessKeyId(value = AWS_ACCESS_KEY_ID) {
  const key = cleanEnv(value);
  if (!key) return "(missing)";
  if (key.length <= 8) return `${key.slice(0, 2)}…${key.slice(-2)}`;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function getS3ConfigStatus() {
  const missing = [];

  if (!AWS_REGION) missing.push("AWS_REGION");
  if (!AWS_ACCESS_KEY_ID) missing.push("AWS_ACCESS_KEY_ID");
  if (!AWS_SECRET_ACCESS_KEY) missing.push("AWS_SECRET_ACCESS_KEY");
  if (!S3_BUCKET) missing.push("S3_BUCKET_NAME");

  return {
    ready: missing.length === 0,
    missing,
    region: AWS_REGION || "(missing)",
    bucket: S3_BUCKET || "(missing)",
    accessKeyId: maskAwsAccessKeyId(),
    hasPublicBaseUrl: Boolean(S3_PUBLIC_BASE_URL),
  };
}

export const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
