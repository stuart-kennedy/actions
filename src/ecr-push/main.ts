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

  if (isDebug()) {
    debug(dockerLoginOutput.toString("utf8"));
  }

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
      const [pushedImage, newTagImage] = await Promise.all(
        [imageTag, tag].map(async (t) => {
          const response = await ecr.send(
            new BatchGetImageCommand({
              repositoryName,
              imageIds: [{ imageTag: t }],
            })
          );

          if (isDebug()) {
            debug(`batchGetImageResponse: ${inspect(response)}`);
          }

          return response;
        })
      );

      const pushedImageDigest = pushedImage.images?.[0]?.imageId?.imageDigest;
      const newTagImageDigest = newTagImage.images?.[0]?.imageId?.imageDigest;

      if (pushedImageDigest && pushedImageDigest !== newTagImageDigest) {
        const response = await ecr.send(
          new PutImageCommand({
            repositoryName,
            imageTag: tag,
            imageManifest: pushedImage.images?.[0].imageManifest,
          })
        );

        if (isDebug()) {
          debug(`putImageResponse: ${inspect(response)}`);
        }

        return response;
      }
    })
  );

  const dockerLogoutOutput = execFileSync("docker", ["logout", repositoryUrl]);

  if (isDebug()) {
    debug(dockerLogoutOutput.toString("utf8"));
  }
} catch (err) {
  if (err instanceof Error) setFailed(err);
}

async function getECRCredentials() {
  const response = await ecr.send(new GetAuthorizationTokenCommand({}));

  if (isDebug()) {
    debug(`getAuthorizationTokenResponse: ${inspect(response)}`);
  }

  const token = response.authorizationData?.[0].authorizationToken;

  if (token === undefined) {
    throw Error("Failed to retrieve ECR authorization token.");
  }

  const [user, password] = Buffer.from(token, "base64").toString("utf8").split(":");
  return { user, password };
}
