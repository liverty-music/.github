# liverty-music/.github

Org-wide community files and **reusable workflows** consumed by every other
liverty-music repository.

## Contents

| Path | Purpose |
|---|---|
| `.github/workflows/claude-review.yml` | Reusable workflow (`workflow_call`) that reviews a pull request with Claude and leaves inline comments or a summary comment. Consumed by every repo's `.github/workflows/claude-code-review.yml`. It skips Renovate's non-major updates, reviews only the commits pushed since the last review, and gives a pull request that changes only Markdown the document review. |
| `review/code.md` | Code review instructions, adapted from the `code-review` plugin of anthropics/claude-plugins-official (Apache License 2.0) to review a given scope. |
| `review/docs.md` | Review instructions for pull requests that change only Markdown, such as OpenSpec plans and archives. |

## Provisioning

This repository is created and managed via Pulumi in
[`liverty-music/cloud-provisioning`](https://github.com/liverty-music/cloud-provisioning)
(`src/github/components/organization.ts`). The Pulumi logical name is
`dot-github` and the GitHub repository name is `.github`.

## Versioning

Callers currently reference workflows via `@main`. A `v1` tag will be cut
once the Claude review workflow has been stable across all four
liverty-music repos for ~1 month.
