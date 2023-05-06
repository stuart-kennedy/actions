import { inspect } from "node:util";
import { getInput, setSecret, setOutput, setFailed, debug } from "@actions/core";
import { createAppAuth } from "@octokit/auth-app";
import { getOctokit } from "@actions/github";

try {
  const appId = getInput("app-id", { required: true });
  const privateKey = getInput("private-key", { required: true });

  const auth = createAppAuth({ appId, privateKey });

  const appAuthentication = await auth({ type: "app" });

  debug(`appAuthentication: ${inspect(appAuthentication)}`);

  const octokit = getOctokit(appAuthentication.token);

  const installations = await octokit.rest.apps.listInstallations({ per_page: 100 });
  const installationId = installations.data.find((installation) => String(installation.app_id) === appId)?.id;

  if (installationId === undefined) {
    throw Error("No installation ID found for the provided GitHub App ID.");
  }

  debug(`installationId: ${installationId}`);

  const installationAuthentication = await auth({ type: "installation", installationId });

  debug(`installationAuthentication: ${inspect(installationAuthentication)}`);

  const token = installationAuthentication.token;

  setSecret(token);
  setOutput("token", token);
} catch (err) {
  if (err instanceof Error) setFailed(err);
}
