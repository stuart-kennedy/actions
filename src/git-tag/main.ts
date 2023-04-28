import { getInput, setFailed, debug } from "@actions/core";
import { context, getOctokit } from "@actions/github";

try {
  const token = getInput("token");
  const tag = getInput("tag");
  const message = getInput("message") || tag;

  const octokit = getOctokit(token);
  const { owner, repo } = context.repo;

  if (process.env.GITHUB_SHA === undefined) {
    throw Error("Environment variable 'GITHUB_SHA' is undefined.");
  }

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

  debug(`createTagResponse: ${JSON.stringify(createTagResponse, null, 2)}`);

  const createRefResponse = await octokit.rest.git.createRef({
    owner,
    repo,
    sha: createTagResponse.data.sha,
    ref: "refs/tags/" + createTagResponse.data.tag,
  });

  debug(`createRefResponse: ${JSON.stringify(createRefResponse, null, 2)}`);
} catch (err) {
  if (err instanceof Error) setFailed(err);
}
