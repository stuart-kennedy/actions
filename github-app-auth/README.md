# GitHub App Auth Action

Generate a GitHub App installation token. Useful for performing actions as an authenticated GitHub application in workflows.

## Documentation

### Inputs

- `app-id` - The ID of a GitHub App.
- `private-key` - A generated private key for the associated GitHub App.

### Outputs

- `token` - The generated app installation token.

## Usage

```yaml
steps:
  - name: Generate a token
    uses: qriousnz/actions/github-app-auth@v1.0.0
    id: app_auth
    with:
      app-id: ${{ secrets.APP_ID }}
      key: ${{ secrets.APP_PRIVATE_KEY }}

  - name: Use the generated token
    env:
      GITHUB_TOKEN: ${{ steps.app_auth.outputs.token }}
    run: gh api octocat
```
