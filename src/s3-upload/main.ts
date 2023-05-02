import { join, posix } from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { inspect } from "node:util";
import { getInput, getMultilineInput, setFailed, info, debug } from "@actions/core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { globby } from "globby";
import { filterCommonPrefixes } from "../utils.ts";

const s3 = new S3Client({});

try {
  const bucket = getInput("bucket", { required: true });
  const path = getMultilineInput("path", { required: true });
  const prefix = getInput("prefix");

  const paths = await globby(path, { onlyFiles: false, markDirectories: true });

  debug(`Matched file system paths: ${inspect(paths)}`);

  // Filter out directories that are common prefixes.
  const files = filterCommonPrefixes(paths);

  const responseMetadata = await Promise.all(
    files.map(async (path) => {
      const isDir = path.at(-1) === "/";
      const filePath = join(process.cwd(), path);

      const key = posix.join(prefix, path);
      const body = isDir ? undefined : createReadStream(filePath);
      const contentLength = isDir ? undefined : (await stat(filePath)).size;

      const response = await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentLength: contentLength,
        })
      );

      debug(`putObjectResponse: ${inspect(response)}`);

      const { httpStatusCode } = response.$metadata;

      if (httpStatusCode === 200) {
        info(`Uploaded: ${filePath}`);
      }

      return httpStatusCode ?? -1;
    })
  );

  const filesUploaded = responseMetadata.filter((code) => code === 200).length;
  info(`### Total files uploaded: ${Intl.NumberFormat("en").format(filesUploaded)} ###`);
} catch (err) {
  if (err instanceof Error) setFailed(err);
}
