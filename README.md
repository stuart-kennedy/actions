# QriousNZ GitHub Actions

Custom GitHub actions for use in the `qriousnz` GitHub organisation.

For detailed help on creating custom GitHub actions, please see the [official documention](https://docs.github.com/en/actions/creating-actions).

## Repository structure

Each custom action has a directory at the root level of the repository, where the directory name is the action name, and which contains the action's `action.yml` file. An action can therefore be used in a workflow by referencing `qriousnz/actions/{action_name}@v{x.x.x}` where `{x.x.x}` is a tagged release version.

## Creating new actions

To create a new action, create a new directory at the repository root with a sensible name using `kebab-case`. If the action you are creating is a Node.js or composite action, this and a `README.md` documenting the action's usage will be the only files in the directory. A Docker container action will also require a Dockerfile and associated assets.

For Node.js actions, create a sub-directory of the same name in the `src` directory with a file named `main.ts`. The remaining structure of this directory is not important, but the entry point must be named `main.ts` and exist at the root level of the sub-directory.

Esbuild is used to create a single ESM bundle for each action. This bundle is automatically saved in the `lib` directory and so the value of `main` in `action.yml` should reference this file.

When adding a new action, add a link to its README to the list below.

## Actions

- [s3-upload](s3-upload/README.md) - Upload files to an S3 bucket.
- [s3-download](s3-download/README.md) - Download files from an S3 bucket.
- [s3-archive-upload](s3-archive-upload/README.md) - Upload files to an S3 bucket as a single archive.
- [s3-archive-download](s3-archive-download/README.md) - Download and extract archived files from an S3 bucket.
- [ecr-push](ecr-push/README.md) - Push a Docker image to ECR.
- [ecr-pull](ecr-push/README.md) - Pull a Docker image from ECR.
- [ssm-send-command](ssm-send-command/README.md) - Execute shell commands on an EC2 instance remotely.
