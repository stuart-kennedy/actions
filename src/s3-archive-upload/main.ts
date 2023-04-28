import { posix } from "node:path";
import { PassThrough } from "node:stream";
import { setInterval, clearInterval } from "node:timers";
import { getInput, getMultilineInput, getBooleanInput, setFailed, info } from "@actions/core";
import { S3Client, GetObjectAttributesCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { create as createTar } from "tar";
import glob from "globby";

async function main() {
  try {
    const bucket = getInput("bucket", { required: true });
    const name = getInput("name", { required: true });
    const path = getMultilineInput("path", { required: true });
    const prefix = getInput("prefix");
    const gzip = getBooleanInput("gzip");

    const paths = await glob(path, { onlyFiles: false, markDirectories: true });

    // Filter out directories that are common prefixes.
    const files = paths.filter((a, i, arr) => {
      return a.at(-1) !== "/" || !arr.some((b, j) => i !== j && b.startsWith(a) && b.length > a.length);
    });

    const s3 = new S3Client({});
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
    const interval = setInterval(() => info("Still uploading..."), 10_000);

    await upload.done();

    const { ObjectSize: objectSize } = await s3.send(
      new GetObjectAttributesCommand({
        Bucket: bucket,
        Key: key,
        ObjectAttributes: ["ObjectSize"],
      })
    );

    clearInterval(interval);
    info("Upload complete.");

    if (objectSize !== undefined) {
      info(`Size of uploaded archive: ${Intl.NumberFormat("en").format(objectSize)} bytes`);
    }
  } catch (err) {
    info("Upload failed.");
    if (err instanceof Error) setFailed(err);
  }
}

main();
