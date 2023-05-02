import type { Readable } from "node:stream";

import { posix } from "node:path";
import { setInterval, clearInterval } from "node:timers";
import { inspect } from "node:util";
import { pipeline } from "node:stream/promises";
import { getInput, setFailed, info, debug } from "@actions/core";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { extract as extractTar } from "tar";

const s3 = new S3Client({});

try {
  const bucket = getInput("bucket", { required: true });
  const name = getInput("name", { required: true });
  const prefix = getInput("prefix");

  info("Downloading...");
  const timer = setInterval(() => info("Still downloading..."), 10_000);
  timer.unref(); // Don't let the timer prevent the event loop from exiting.

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: posix.join(prefix, name),
    })
  );

  debug(`getObjectResponse: ${inspect(response)}`);

  if (response.Body !== undefined) {
    const writeStream = extractTar({ cwd: process.cwd() });
    await pipeline(response.Body as Readable, writeStream);
  }

  clearInterval(timer);
  info("Download complete.");
} catch (err) {
  info("Download failed.");
  if (err instanceof Error) setFailed(err);
}
