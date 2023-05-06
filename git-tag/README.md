# Git Tag Action

Create an annotated tag in a Github repository without checking out. Uses the value of environment variable `GITHUB_SHA` as the git object to tag.

## Documentation

### Inputs

- `token` - Your GitHub token.
- `tag` - The tag to create.
- `message` - The commit message for the tag. If not provded the tag value itself will be used. Default: `false`

## Usage

```yaml
steps:
  - name: Create a git tag
    uses: qriousnz/actions/git-tag@v1.0.0
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
      tag: v1.2.3
      message: Update to version 1.2.3
```
