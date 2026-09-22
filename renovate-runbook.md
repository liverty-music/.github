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

## A BSR-generated Go module needs updating

**Why:** same root cause as `buf.lock` below, different symptom. The
`buf.build/gen/go/**` modules are ordinary `gomod` entries, so Renovate *reads*
them — but their version format defeats the lookup.
`v1.20.0-20260826021924-0ff29b2b0335.1` resembles a Go pseudo-version, so
Renovate splits the embedded commit out as a digest and then cannot resolve a
new one, the module being generated output with no repository behind it.

They are disabled rather than left failing, because an axis that looks
automated while proposing nothing is indistinguishable from one that is up to
date.

`liverty-music/schema/*` is a different case and needs nothing here — it is
advanced by the OpenSpec change that alters the schema, together with the code
migration, and `backend` and `frontend` must land on the same build.

**What to do** for `pocketsign/apis/*`, periodically:

```bash
cd backend
go get buf.build/gen/go/pocketsign/apis/connectrpc/go@latest
go get buf.build/gen/go/pocketsign/apis/protocolbuffers/go@latest
go mod tidy
make check
```

This is a third-party schema on someone else's cadence, so falling behind is
the risk here, not the safeguard. Both modules stay on the dependency dashboard
as disabled-with-an-update-available, so the dashboard is where you notice.

> If Renovate ever gains Buf Schema Registry support, re-enable `pocketsign`
> and leave `liverty-music/schema` excluded. The two are disabled for opposite
> reasons — one because automating it does not work, the other because
> automating it would be wrong.

---

## `buf.lock` needs updating

**Why:** one of two axes with no automation, both rooted in the Buf Schema
Registry (the other is above). Renovate ships no BSR manager or datasource, and
`buf.lock` records
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

`buf.build/gen/go/pocketsign/apis/*` also appears there, and is a DIFFERENT
case: it is disabled because Renovate cannot read the BSR version format, not
because it should not be bumped. Seeing it here IS the prompt to bump it — see
"A BSR-generated Go module needs updating" above.

---

## Turning automerge off in a hurry

One commit, appended to the END of `packageRules` in
[`renovate-config.json`](renovate-config.json):

```json
{
  "description": "EMERGENCY: stop all unattended merges. Remove to restore.",
  "matchPackageNames": ["**"],
  "automerge": false
}
```

It is inherited by every repository, so this stops unattended merges everywhere
at once. PR creation keeps running, so nothing is lost — updates simply queue
for a human. Remove the rule to restore.

**Two details decide whether this works, and both are easy to get wrong.**

*It must go at the end.* Renovate applies `packageRules` in array order and each
match overwrites the last, so a rule only overrides what precedes it. Appended,
it follows every automerge-enabling rule in the preset — and every repository's
own rules too, since a preset's rules are merged before the config that extends
it.

*Editing the top-level `"automerge": false` does nothing.* That key is already
`false`; automerge is granted by `packageRules` that override it per group, and
setting a value to what it already is changes nothing. This runbook said to do
exactly that until task 10.7 checked it — the kill switch was a no-op for as
long as it was documented, and nobody would have found out until they pulled it.

**Verify it, rather than trusting either this page or the diff:**

```bash
cd .github
npx --package renovate -- node scripts/check-automerge-policy.mjs
```

The script evaluates the real rules through Renovate's own `applyPackageRules`
and asserts what each of sixteen representative dependencies is allowed to do —
including that the kill switch above reduces every one of them to `human`. Run
it before merging any change to `renovate-config.json` or to a repository's
`renovate.json`.

It is worth running for ordinary policy changes too, not just emergencies. The
rules are written against shapes — a manager, a `depType`, an update type —
while the decisions they encode are about packages, and the two drift apart
quietly. `vite-plugin-pwa` is the case that motivated the script: a rule naming
`devDependencies` enabled automerge on a package an exclusion list had
explicitly named as forbidden. Nothing failed. Nothing could fail, because "no
pull request has merged itself yet" and "no pull request can merge itself" look
identical right up until one does.
