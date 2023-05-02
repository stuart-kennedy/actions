import type { Readable } from "node:stream";

import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join, posix, dirname } from "node:path";
import { inspect } from "node:util";
import { getInput, getMultilineInput, setFailed, info, debug, isDebug } from "@actions/core";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { filterCommonPrefixes } from "../utils.ts";

const s3 = new S3Client({});

try {
  const bucket = getInput("bucket", { required: true });
  const path = getMultilineInput("path", { required: true });
  const prefix = getInput("prefix");

  const keys = (await Promise.all(path.map(async (path) => listS3Objects(bucket, posix.join(prefix, path))))).flat();

  // Filter out directories that are common prefixes.
  const uniqueKeys = filterCommonPrefixes(Array.from(new Set(keys)));

  debug(`Matched S3 object keys: ${inspect(uniqueKeys)}`);

  const responseMetadata = await Promise.all(
    uniqueKeys.map(async (key) => {
      const filepath = join(process.cwd(), key.slice(prefix.length));

      if (key.at(-1) === "/") {
        // Is a directory.
        await mkdir(filepath, { recursive: true });
        info(`Downloaded: ${filepath}`);
        return 200;
      }

      const response = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      debug(`getObjectResponse: ${inspect(response)}`);

      if (response.Body !== undefined) {
        await mkdir(dirname(filepath), { recursive: true });
        const writeStream = createWriteStream(filepath);
        await pipeline(response.Body as Readable, writeStream);
        info(`Downloaded: ${filepath}`);
      }

      return response.$metadata.httpStatusCode ?? -1;
    })
  );

  const filesDownloaded = responseMetadata.filter((code) => code === 200).length;
  info(`### Total files downloaded: ${Intl.NumberFormat("en").format(filesDownloaded)} ###`);
} catch (err) {
  if (err instanceof Error) setFailed(err);
}

async function listS3Objects(bucket: string, prefix: string, continuationToken?: string): Promise<string[]> {
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    })
  );

  debug(`listObjectsV2Response: ${inspect(response)}`);

  const result = (response.Contents ?? []).map((obj) => obj.Key ?? "").filter(Boolean);

  if (response.IsTruncated) {
    return result.concat(await listS3Objects(bucket, prefix, response.NextContinuationToken));
  }

  return result;
}
