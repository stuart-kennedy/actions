import { inspect } from "node:util";
import { getInput, setFailed, debug } from "@actions/core";
import { context, getOctokit } from "@actions/github";

try {
  if (process.env.GITHUB_SHA === undefined) {
    throw Error("Environment variable 'GITHUB_SHA' is undefined.");
  }

  const token = getInput("token", { required: true });
  const tag = getInput("tag", { required: true });
  const message = getInput("message") || tag;

  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;

  const createTagResponse = await octokit.rest.git.createTag({
    owner,
    repo,
    tag,
    message,
    object: process.env.GITHUB_SHA,
    type: "commit",
    tagger: {
      name: "github-actions[bot]",
      email: "41898282+github-actions[bot]@users.noreply.github.com",
    },
  });

  debug(`createTagResponse: ${inspect(createTagResponse)}`);

  const createRefResponse = await octokit.rest.git.createRef({
    owner,
    repo,
    sha: createTagResponse.data.sha,
    ref: "refs/tags/" + createTagResponse.data.tag,
  });

  debug(`createRefResponse: ${inspect(createRefResponse)}`);
} catch (err) {
  if (err instanceof Error) setFailed(err);
}
