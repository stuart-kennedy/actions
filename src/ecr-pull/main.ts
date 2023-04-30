import { execFileSync } from "node:child_process";
import { inspect } from "node:util";
import { debug, getInput, getMultilineInput, isDebug, setFailed } from "@actions/core";
import { ECRClient, GetAuthorizationTokenCommand } from "@aws-sdk/client-ecr";

const ecr = new ECRClient({});

try {
  const repositoryUrl = getInput("repository-url", { required: true });
  const image = getInput("image", { required: true });
  const tags = getMultilineInput("tags");

  const { user, password } = await getECRCredentials();
  const dockerLoginOutput = execFileSync("docker", ["login", "--username", user, "--password-stdin", repositoryUrl], {
    input: password,
  });

  if (isDebug()) {
    debug(dockerLoginOutput.toString("utf8"));
  }

  const imageTag = image.split(":")[1] || "latest";
  const remoteImageName = `${repositoryUrl}:${imageTag}`;
  execFileSync("docker", ["pull", remoteImageName].concat(isDebug() ? ["-D"] : []), { stdio: "inherit" });
  execFileSync("docker", ["tag", remoteImageName, image].concat(isDebug() ? ["-D"] : []), { stdio: "inherit" });
  execFileSync("docker", ["rmi", remoteImageName].concat(isDebug() ? ["-D"] : []), { stdio: "inherit" });

  if (tags.length) {
    const imageName = image.split(":")[0];
    tags.forEach((tag) => {
      execFileSync("docker", ["tag", image, `${imageName}:${tag}`].concat(isDebug() ? ["-D"] : []), {
        stdio: "inherit",
      });
    });
  }

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
