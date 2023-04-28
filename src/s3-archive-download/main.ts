import type { Readable } from "node:stream";

import { posix } from "node:path";
import { setInterval, clearInterval } from "node:timers";
import { getInput, setFailed, info, debug } from "@actions/core";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { extract as extractTar } from "tar";
import { asyncPipe } from "../utils.ts";

try {
  const bucket = getInput("bucket", { required: true });
  const name = getInput("name", { required: true });
  const prefix = getInput("prefix");

  info("Downloading...");
  const interval = setInterval(() => info("Still downloading..."), 10_000);

  const s3 = new S3Client({});
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: posix.join(prefix, name),
    })
  );

  debug(`getObjectResponse: ${JSON.stringify(response, null, 2)}`);

  if (response.Body !== undefined) {
    const writeStream = extractTar({ cwd: process.cwd() });
    await asyncPipe(response.Body as Readable, writeStream);
  }

  clearInterval(interval);
  info("Download complete.");
} catch (err) {
  info("Download failed.");
  if (err instanceof Error) setFailed(err);
}
