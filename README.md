# liverty-music/.github

Org-wide community files and **reusable workflows** consumed by every other
liverty-music repository.

## Contents

| Path | Purpose |
|---|---|
| `.github/workflows/claude-review.yml` | Reusable workflow (`workflow_call`) that reviews a pull request with Claude and leaves inline comments or a summary comment. Consumed by every repo's `.github/workflows/claude-code-review.yml`. It skips Renovate's non-major updates, reviews only the commits pushed since the last review, and gives a pull request that changes only Markdown the document review. |
| `.github/workflows/report-main-ci.yml` | Reusable workflow (`workflow_call`) that keeps the Issue "CI failing on main" in step with the nightly CI result of frontend and backend: a failed night opens it or comments, a green night closes it (labelled `flaky` when the same commit failed earlier). Only Issues and comments by `github-actions[bot]` are trusted. |
| `review/code.md` | Code review instructions, adapted from the `code-review` plugin of anthropics/claude-plugins-official (Apache License 2.0) to review a given scope. |
| `review/code-single.md` | The code review instructions before the review subagents were required: the main session may review alone. Selected by a caller with `review-profile: single`, as a fallback when the subagents cost too much time or tokens. |
| `review/docs.md` | Review instructions for pull requests that change only Markdown, such as OpenSpec plans and archives. |
| `routines/fix-main-ci.md` | Instructions for the Claude Code routine that triages a nightly CI failure on `main` of frontend or backend: classifies the cause, opens a fix pull request when it can, comments on the Issue and posts to Slack. The routine's prompt only points here; its settings are in cloud-provisioning `docs/runbooks/main-ci-auto-fix.md`. |

## Provisioning

This repository is created and managed via Pulumi in
[`liverty-music/cloud-provisioning`](https://github.com/liverty-music/cloud-provisioning)
(`src/github/components/organization.ts`). The Pulumi logical name is
`dot-github` and the GitHub repository name is `.github`.

## Versioning

Callers currently reference workflows via `@main`. A `v1` tag will be cut
once the Claude review workflow has been stable across all four
liverty-music repos for ~1 month.
