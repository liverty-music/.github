# liverty-music/.github

Org-wide community files and **reusable workflows** consumed by every other
liverty-music repository.

## Contents

| Path | Purpose |
|---|---|
| `.github/workflows/claude-review.yml` | Reusable workflow (`workflow_call`) that runs the `code-review@claude-code-plugins` Claude Code plugin against an open PR and publishes the verdict as a `Claude review` GitHub Check Run (`success` / `failure` / `neutral`). Consumed by every repo's `.github/workflows/claude-code-review.yml`. See [OpenSpec change `claude-review-check-run`](https://github.com/liverty-music/specification/tree/main/openspec/changes/archive/claude-review-check-run) for the design rationale. |

## Provisioning

This repository is created and managed via Pulumi in
[`liverty-music/cloud-provisioning`](https://github.com/liverty-music/cloud-provisioning)
(`src/github/components/organization.ts`). The Pulumi logical name is
`dot-github` and the GitHub repository name is `.github`.

## Versioning

Callers currently reference workflows via `@main`. A `v1` tag will be cut
once the Claude review workflow has been stable across all four
liverty-music repos for ~1 month.
