# Renovate — the parts that still need a person

Most updates merge themselves. This lists the ones that do not, and what to do
about each. Policy lives in [`renovate-config.json`](renovate-config.json) and
in each repository's `renovate.json`.

If you are here because a pull request is red or stuck, find it below before
overriding anything — each of these is deliberate.

---

## A `@playwright/test` bump is red

**Why:** a Playwright upgrade changes how Chromium renders, so the committed
`toMatchScreenshot` baselines no longer match. Renovate cannot regenerate them.
This PR is excluded from automerge for exactly this reason.

**What to do** — regenerate the baselines *inside the pinned container*, so the
renderer matches the one CI validates with:

```bash
cd frontend
docker run --rm -v "$PWD":/work -w /work -e HOME=/tmp \
  mcr.microsoft.com/playwright:v<NEW_VERSION>-noble \
  npx vitest run --project=storybook --update
```

Use the version the PR proposes, not the one currently in `AGENTS.md` — the PR
updates that line too, and all three locations (`package.json`, `ci.yaml`,
`AGENTS.md`) move together.

Then review the PNG diffs in the PR. **Look at them.** A rendering change that
is not explained by the upgrade is the finding; adopting the new baselines
without looking converts a regression test into a rubber stamp.

> The container runs as root and will leave root-owned `node_modules/.vite-temp`,
> `.vite` and `.cache` behind, after which local `make test` fails with `EACCES`.
> Either add `--user $(id -u):$(id -g)`, or clean up afterwards:
> `docker run --rm -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v<NEW_VERSION>-noble rm -rf node_modules/.vite-temp node_modules/.vite node_modules/.cache`

---

## A Pulumi preview reports resource changes

**Why:** infrastructure provider updates are never automerged, and the preview
does not run on dependency PRs at all — producing one means executing the
proposed package against production credentials before anyone has read it.

**What to do:** obtain the preview yourself.

```bash
cd cloud-provisioning
pulumi preview -s prod --diff
```

Read the resource summary. Replacements and deletions are the ones that matter;
`~ update` on a monitoring dashboard is not the same event as `-` on a Cloud SQL
instance. If anything would be replaced or deleted, do not merge — work out why
a provider bump wants to do that first.

**Never** widen the Pulumi Cloud trigger `paths` to make previews run on
dependency PRs. That is the exposure the exclusion exists to prevent; see the
comment in `cloud-provisioning/src/pulumi-cloud/deployment-settings.ts`.

---

## An urgent fix is being held by the release-age delay

**Why:** nothing is proposed until it has been published for 3 days. This is
deliberate and it applies to vulnerability fixes too — Renovate skips
`schedule` and the concurrency limits for those, but **not** `minimumReleaseAge`.

That is the intended behaviour, not an oversight. A release claiming to be a
security fix is exactly what a compromised maintainer account publishes, and
the delay is what gives registries and scanners time to pull it.

**What to do** when something genuinely cannot wait: apply it by hand, in a
normal reviewed pull request, the way you would have before any of this existed.

**Do not** lower `minimumReleaseAge` or add an exemption to get one update
through. An exemption is a standing change to the policy made under time
pressure, and it will outlive the incident.

---

## `buf.lock` needs updating

**Why:** this is the one dependency axis with no automation at all. Renovate
ships no Buf Schema Registry manager or datasource, and `buf.lock` records
registry commit identifiers rather than versions, so no generic mechanism
applies either. Nothing will raise a PR and nothing will appear on the
dashboard.

Its contents are third-party modules — `bufbuild/protovalidate`,
`googleapis/googleapis` — so falling behind is the risk here, not the safeguard.

**What to do**, periodically (a good moment is when you are in the repo anyway):

```bash
cd specification
buf dep update
buf lint && buf breaking --against '.git#branch=main'
```

Commit the `buf.lock` change as an ordinary reviewed PR.

---

## A schema SDK shows on the dashboard as "disabled, update available"

**Why:** `buf.build/gen/go/liverty-music/schema/*` and
`@buf/liverty-music_schema.*` are disabled on purpose, with `enabled: false`
rather than `ignoreDeps` precisely so they stay visible. Seeing one here is the
feature working: it means a schema release exists that its consumers have not
adopted.

**What to do:** do NOT bump it from the dashboard. These advance as part of the
OpenSpec change that alters the schema, together with the code migration that
change requires — `backend` and `frontend` are meant to sit on the same build,
and bumping them independently opens a skew window with the migration undone.

Treat the dashboard entry as a prompt to ask whether that OpenSpec change
stalled.

`buf.build/gen/go/pocketsign/apis/*` is different — third-party, on someone
else's cadence, and updated normally.

---

## Turning automerge off in a hurry

One commit, in [`renovate-config.json`](renovate-config.json):

```json
"automerge": false
```

It is inherited by every repository, so this stops unattended merges everywhere
at once. PR creation keeps running, so nothing is lost — updates simply queue
for a human.
