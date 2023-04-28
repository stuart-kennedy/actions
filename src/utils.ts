import type { Readable, Writable } from "node:stream";

export function asyncPipe(readStream: Readable, writeStream: Writable) {
  return new Promise<void>((resolve, reject) => {
    readStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("close", resolve);
    readStream.pipe(writeStream);
  });
}
