import { createPrivateKey } from "node:crypto";
import { inspect } from "node:util";
import { getInput, setSecret, setOutput, setFailed, debug } from "@actions/core";
import { createAppAuth } from "@octokit/auth-app";

try {
  const appId = getInput("app-id", { required: true });
  const privateKey = getInput("private-key", { required: true });

  const privateKeyPkcs8 = createPrivateKey(privateKey).export({ type: "pkcs8", format: "pem" });

  const auth = createAppAuth({ appId, privateKey: privateKeyPkcs8.toString("utf8") });

  const appAuthentication = await auth({ type: "app" });

  debug(`appAuthentication: ${inspect(appAuthentication)}`);

  const token = appAuthentication.token;

  setSecret(token);
  setOutput("token", token);
} catch (err) {
  if (err instanceof Error) setFailed(err);
}
