# QriousNZ GitHub Actions

Custom GitHub actions for use in the `qriousnz` GitHub organisation.

For detailed help on creating custom GitHub actions, please see the [official documentation](https://docs.github.com/en/actions/creating-actions).

## Repository structure

Each custom action has a directory at the root level of the repository, where the directory name is the action name, and which contains the action's `action.yml` file. An action can therefore be used in a workflow by referencing `qriousnz/actions/{action_name}@{version}`, where `{version}` is a tagged release version such as `v1.0.0`.

The CI workflow will bump the patch version and create a new release tag every time new changes are merged to `main`.

## Creating new actions

To add a new action to this repository, create a new directory at the repository root with a sensible name using `kebab-case`. If the action you are creating is a Node.js or composite action, this and a `README.md` documenting the action's usage will be the only files in the directory. A Docker container action will also require a Dockerfile and associated assets.

For Node.js actions, create a sub-directory of the same name in the `src` directory with a file named `main.ts`. The remaining structure of this directory is not important, but the entry point must be named `main.ts` and exist at the root level of the sub-directory.

A single bundle for each action is created using _esbuild_. This bundle is automatically saved in the `lib` directory as part of the CI workflow, and so the value of `main` in `action.yml` should reference this file.

When adding a new action, add a link to its `README.md` to the list below.

## Actions

- [ecr-pull](ecr-pull/README.md) - Pull a Docker image from ECR.
- [ecr-push](ecr-push/README.md) - Push a Docker image to ECR.
- [git-tag](git-tag/README.md) - Create an annotated tag in a Github repository without checking out.
- [github-app-auth](github-app-auth/README.md) - Generate a GitHub App installation token.
- [s3-archive-download](s3-archive-download/README.md) - Download and extract an archive uploaded using s3-archive-upload.
- [s3-archive-upload](s3-archive-upload/README.md) - Create a tar archive and upload it to a designated S3 bucket.
- [s3-download](s3-download/README.md) - Download files and directories at the provided path(s) from an S3 bucket.
- [s3-upload](s3-upload/README.md) - Upload files and directories at the provided path(s) to an S3 bucket.
- [ssm-send-command](ssm-send-command/README.md) - Execute shell commands on an EC2 instance remotely.
