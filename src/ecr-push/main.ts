import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { cwd } from "node:process";
import { inspect } from "node:util";
import { debug, getInput, getMultilineInput, setFailed, isDebug } from "@actions/core";
import { ECRClient, GetAuthorizationTokenCommand, BatchGetImageCommand, PutImageCommand } from "@aws-sdk/client-ecr";

const ecr = new ECRClient({});

try {
  const repositoryUrl = getInput("repository-url", { required: true });
  const image = getInput("image", { required: true });
  const tags = getMultilineInput("tags");
  const buildPath = getInput("build-path") || undefined;

  const repositoryName = repositoryUrl.slice(repositoryUrl.lastIndexOf("/") + 1);

  const { user, password } = await getECRCredentials();
  const dockerLoginOutput = execFileSync("docker", ["login", "--username", user, "--password-stdin", repositoryUrl], {
    input: password,
  });

  debug(dockerLoginOutput.toString("utf8"));

  const imageTag = image.split(":")[1] || "latest";
  const remoteImageName = `${repositoryUrl}:${imageTag}`;

  if (buildPath !== undefined) {
    const path = join(cwd(), buildPath);
    execFileSync("docker", ["build", "-t", remoteImageName, path].concat(isDebug() ? ["-D"] : []), {
      stdio: "inherit",
    });
  } else {
    execFileSync("docker", ["tag", image, remoteImageName].concat(isDebug() ? ["-D"] : []), { stdio: "inherit" });
  }

  execFileSync("docker", ["push", remoteImageName].concat(isDebug() ? ["-D"] : []), { stdio: "inherit" });

   await Promise.all(
    tags.map(async (tag) => {
      const batchGetImageResponse = await ecr.send(
        new BatchGetImageCommand({
          repositoryName,
          imageIds: [{ imageTag }, { imageTag: tag }],
        })
      );

      debug(`batchGetImageResponse: ${inspect(batchGetImageResponse)}`);

      const pushedImage = batchGetImageResponse.images?.find((image) => {
        return image.imageId?.imageTag === imageTag;
      });

      const newTagImage = batchGetImageResponse.images?.find((image) => {
        return image.imageId?.imageTag === tag;
      });

      const pushedImageDigest = pushedImage?.imageId?.imageDigest;
      const newImageTagDigest = newTagImage?.imageId?.imageDigest;

      if (pushedImageDigest && pushedImageDigest !== newImageTagDigest) {
        const putImageResponse = await ecr.send(
          new PutImageCommand({
            repositoryName,
            imageManifest: pushedImage.imageManifest,
            imageTag: tag,
          })
        );

        debug(`putImageResponse: ${inspect(putImageResponse)}`);

        return putImageResponse;
      }
    })
  );

  const dockerLogoutOutput = execFileSync("docker", ["logout", repositoryUrl]);

  debug(dockerLogoutOutput.toString("utf8"));
} catch (err) {
  if (err instanceof Error) setFailed(err);
}

async function getECRCredentials() {
  const response = await ecr.send(new GetAuthorizationTokenCommand({}));

  debug(`getAuthorizationTokenResponse: ${inspect(response)}`);

  const token = response.authorizationData?.[0].authorizationToken;

  if (token === undefined) {
    throw Error("Failed to retrieve ECR authorization token.");
  }

  const [user, password] = Buffer.from(token, "base64").toString("utf8").split(":");
  return { user, password };
}
