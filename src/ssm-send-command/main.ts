import type { GetCommandInvocationCommandOutput } from "@aws-sdk/client-ssm";

import { setInterval, clearInterval } from "node:timers";
import { scheduler } from "node:timers/promises";
import { inspect } from "node:util";
import { getBooleanInput, getInput, setOutput, setFailed, info, debug } from "@actions/core";
import {
  SSMClient,
  DescribeInstanceInformationCommand,
  SendCommandCommand,
  GetCommandInvocationCommand,
} from "@aws-sdk/client-ssm";
import { CloudWatchLogsClient, GetLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import styles from "ansi-styles";

const ssm = new SSMClient({});
const cloudWatchLogs = new CloudWatchLogsClient({});

try {
  const command = getInput("command", { required: true });
  const instanceId = getInput("instance-id") || process.env.SSM_COMMAND_INSTANCE_ID;
  const powershell = getBooleanInput("powershell");
  const waitForAgent = getBooleanInput("wait-for-agent");

  if (instanceId === undefined) {
    setFailed(Error("An instance ID must be provided."));
    process.exit(1);
  }

  if (waitForAgent) {
    info("Waiting for SSM agent to come online...");
    const timer = setInterval(() => info("Still waiting..."), 10_000);
    timer.unref(); // Don't let the timer prevent the event loop from exiting.

    await waitSsmAgent(instanceId);

    clearInterval(timer);
    info("SSM agent is online.");
  }

  const ssmDocumentName = powershell ? "AWS-RunPowerShellScript" : "AWS-RunShellScript";

  const sendCommandResponse = await ssm.send(
    new SendCommandCommand({
      DocumentName: ssmDocumentName,
      InstanceIds: [instanceId],
      Parameters: { commands: [command] },
      CloudWatchOutputConfig: { CloudWatchOutputEnabled: true },
    })
  );

  debug(`sendCommandOutput: ${inspect(sendCommandResponse)}`);

  const commandId = sendCommandResponse.Command?.CommandId;

  if (!commandId) {
    setFailed(Error("The 'SSM Send Command' command failed to return a command ID."));
    process.exit(1);
  }

  info("Waiting for remote command invocation to complete...");
  const timer = setInterval(() => info("Still waiting..."), 10_000);
  timer.unref(); // Don't let the timer prevent the event loop from exiting.

  const response = await waitCommandInvocationComplete(instanceId, commandId);

  clearInterval(timer);
  info(`Remote command invocation completed with status: "${response.Status ?? "undefined"}". Fetching output...`);

  // Add a slight delay to prevent returning before all logs are published to CloudWatch.
  await scheduler.wait(3000);

  if (response.StandardOutputContent) {
    const messages = await getLogMessages(response, "stdout");
    printContent(messages.join(""), "stdout");
  }

  if (response.StandardErrorContent) {
    const messages = await getLogMessages(response, "stderr");
    printContent(messages.join(""), "stderr");
  }

  if (!response.StandardOutputContent && !response.StandardErrorContent) {
    info(styles.gray.open + styles.bold.open + "No output found.");
  }

  if (response.ResponseCode !== undefined) {
    setOutput("exit-code", response.ResponseCode);
  }

  info(`Remote command invocation has completed with exit code: ${response.ResponseCode ?? "undefined"}`);
} catch (err) {
  if (err instanceof Error) setFailed(err);
}

async function waitSsmAgent(instanceId: string, i = 0): Promise<void> {
  const response = await ssm.send(
    new DescribeInstanceInformationCommand({
      Filters: [
        {
          Key: "InstanceIds",
          Values: [instanceId],
        },
      ],
    })
  );

  debug(`describeInstanceInformationOutput: ${inspect(response)}`);

  if (response.InstanceInformationList?.[0]?.PingStatus !== "Online") {
    await scheduler.wait(5000);
    return waitSsmAgent(instanceId, i + 1);
  }
}

async function waitCommandInvocationComplete(
  instanceId: string,
  commandId: string
): Promise<GetCommandInvocationCommandOutput> {
  await scheduler.wait(5000);

  const response = await ssm.send(
    new GetCommandInvocationCommand({
      InstanceId: instanceId,
      CommandId: commandId,
    })
  );

  debug(`getCommandInvocationOutput: ${inspect(response)}`);

  if (response.Status && ["Success", "Failed", "Cancelled", "TimedOut"].includes(response.Status)) {
    return response;
  }

  return waitCommandInvocationComplete(instanceId, commandId);
}

function printContent(content: string, stream: "stdout" | "stderr") {
  const style = stream === "stdout" ? styles.cyan.open : styles.red.open + styles.bold.open;
  info(style + `----- BEGIN ${stream.toUpperCase()} CONTENT -----`);
  content
    .trim()
    .split(/\r?\n/)
    .forEach((line) => info(style + line));
  info(style + `----- END ${stream.toUpperCase()} CONTENT -----`);
}

async function getLogMessages(
  commandInvocationOutput: GetCommandInvocationCommandOutput,
  stream: "stdout" | "stderr",
  token?: string
): Promise<string[]> {
  const { DocumentName, CommandId, InstanceId, PluginName } = commandInvocationOutput;

  if (!DocumentName) {
    throw Error("DocumentName is undefined.");
  }

  if (!CommandId) {
    throw Error("CommandId is undefined.");
  }

  if (!InstanceId) {
    throw Error("InstanceId is undefined.");
  }

  if (!PluginName) {
    throw Error("PluginName is undefined.");
  }

  const response = await cloudWatchLogs.send(
    new GetLogEventsCommand({
      logGroupName: "/aws/ssm/" + DocumentName,
      logStreamName: `${CommandId}/${InstanceId}/${PluginName.replace(":", "-")}/${stream}`,
      startFromHead: true,
      nextToken: token,
    })
  );

  debug(`getLogEventsCommandOutput: ${inspect(response)}`);

  const result = (response.events ?? []).map((e) => e.message).filter((m): m is string => m !== undefined);

  return token === response.nextForwardToken
    ? result
    : result.concat(await getLogMessages(commandInvocationOutput, stream, response.nextForwardToken));
}
