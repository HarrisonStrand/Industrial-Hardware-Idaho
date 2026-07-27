import "../config/env.js";
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import {
  s3,
  S3_BUCKET,
  getS3ConfigStatus,
} from "../utils/s3.js";

function formatAwsError(err) {
  return {
    message: err?.message || String(err),
    code: err?.Code || err?.name || "Unknown",
    httpStatusCode: err?.$metadata?.httpStatusCode,
    requestId: err?.$metadata?.requestId || err?.RequestId,
  };
}

async function main() {
  const status = getS3ConfigStatus();

  console.log("===== S3 AVATAR CONFIG CHECK =====");
  console.log(JSON.stringify(status, null, 2));

  if (!status.ready) {
    console.error(`❌ Missing required env vars: ${status.missing.join(", ")}`);
    process.exit(1);
  }

  const testKey = `avatars/__s3-config-test-${Date.now()}.txt`;

  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
    console.log("✅ Bucket exists and credentials can reach it");

    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: testKey,
        Body: "S3 avatar config test",
        ContentType: "text/plain",
      }),
    );
    console.log("✅ PutObject succeeded for avatars test key");

    await s3.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: testKey,
      }),
    );
    console.log("✅ DeleteObject succeeded for avatars test key");

    console.log("✅ S3 avatar config looks good");
  } catch (err) {
    console.error("❌ S3 avatar config check failed:");
    console.error(JSON.stringify(formatAwsError(err), null, 2));

    if (err?.Code === "InvalidAccessKeyId") {
      console.error(
        "The AWS_ACCESS_KEY_ID loaded by the server does not exist in AWS. Create or copy a valid access key and update server/.env and Render environment variables.",
      );
    } else if (err?.Code === "SignatureDoesNotMatch") {
      console.error(
        "The AWS_SECRET_ACCESS_KEY does not match the AWS_ACCESS_KEY_ID. Replace both values as a pair.",
      );
    } else if (err?.Code === "AccessDenied") {
      console.error(
        "The key exists, but it does not have the needed S3 permissions for this bucket.",
      );
    } else if (err?.Code === "PermanentRedirect" || err?.Code === "AuthorizationHeaderMalformed") {
      console.error(
        "The configured AWS_REGION may not match the bucket region.",
      );
    }

    process.exit(1);
  }
}

main();
