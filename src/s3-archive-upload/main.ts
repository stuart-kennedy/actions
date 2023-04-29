import { posix } from "node:path";
import { PassThrough } from "node:stream";
import { setInterval, clearInterval } from "node:timers";
import { inspect } from "node:util";
import { getInput, getMultilineInput, getBooleanInput, setFailed, info, debug, isDebug } from "@actions/core";
import { S3Client, GetObjectAttributesCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { create as createTar } from "tar";
import { globby } from "globby";
import { filterCommonPrefixes } from "../utils.ts";

const s3 = new S3Client({});

try {
  const bucket = getInput("bucket", { required: true });
  const name = getInput("name", { required: true });
  const path = getMultilineInput("path", { required: true });
  const prefix = getInput("prefix");
  const gzip = getBooleanInput("gzip");

  const paths = await globby(path, { onlyFiles: false, markDirectories: true });

  if (isDebug()) {
    debug(`Matched file system paths: ${inspect(paths)}`);
  }

  // Filter out directories that are common prefixes.
  const files = filterCommonPrefixes(paths);

  const key = posix.join(prefix, name);
  // Piping to PassThrough is required for compatibility with @aws-sdk/lib-storage.
  const stream = createTar({ gzip }, files).pipe(new PassThrough());

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: stream,
    },
  });

  info("Uploading...");
  const timer = setInterval(() => info("Still uploading..."), 10_000);
  timer.unref(); // Don't let the timer prevent the event loop from exiting.

  const multipartUploadResponse = await upload.done();

  if (isDebug()) {
    debug(`multipartUploadResponse: ${inspect(multipartUploadResponse)}`);
  }

  const getObjectAttributesResponse = await s3.send(
    new GetObjectAttributesCommand({
      Bucket: bucket,
      Key: key,
      ObjectAttributes: ["ObjectSize"],
    })
  );

  if (isDebug()) {
    debug(`getObjectAttributesResponse: ${inspect(getObjectAttributesResponse)}`);
  }

  clearInterval(timer);
  info("Upload complete.");

  const { ObjectSize: objectSize } = getObjectAttributesResponse;

  if (objectSize !== undefined) {
    info(`Size of uploaded archive: ${Intl.NumberFormat("en").format(objectSize)} bytes`);
  }
} catch (err) {
  info("Upload failed.");
  if (err instanceof Error) setFailed(err);
}
