// Evaluate the organization's Renovate rules against a fixed set of
// dependencies and assert what each one is allowed to do.
//
// This exists because the rules are written against SHAPES — a manager, a
// depType, an update type — while the decisions they encode are about
// PACKAGES. `vite-plugin-pwa` is the case that motivated it: a rule naming
// `devDependencies` swept in a package an exclusion list had named as
// forbidden, and nothing failed, because "no pull request merged itself yet"
// and "no pull request can merge itself" look identical until one does.
//
// Run it before merging a change to `renovate-config.json` or to any
// repository's `renovate.json`:
//
//   node scripts/check-automerge-policy.mjs [path-to-checkout-root]
//
// The root defaults to the parent of this repository's directory and must
// contain the five repositories side by side. Renovate must be installed
// (`npx --package renovate -- node scripts/check-automerge-policy.mjs` works).
//
// It also checks the kill switch documented in renovate-runbook.md still
// zeroes every automerge, which is the property that makes the rollback in
// that runbook a rollback rather than a no-op.

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const here = path.dirname(fileURLToPath(import.meta.url))
const root = process.argv[2] ?? path.resolve(here, '..', '..')

const renovateEntry = pathToFileURL(
  require.resolve('renovate/dist/util/package-rules/index.js'),
).href
const { applyPackageRules } = await import(renovateEntry)

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const preset = read(path.join(root, '.github', 'renovate-config.json'))

// The kill switch from renovate-runbook.md. A packageRule with no matchers is
// rejected by renovate-config-validator, so it matches on `**`, which matches
// bare names as well as slashed ones.
const KILL_SWITCH = {
  description: 'EMERGENCY: stop all unattended merges. See renovate-runbook.md.',
  matchPackageNames: ['**'],
  automerge: false,
}

// depName, and every field a rule in this organization matches on.
const dep = (repo, depName, extra) => ({ repo, depName, packageName: depName, ...extra })
const npm = { datasource: 'npm', manager: 'npm' }
const gomod = { datasource: 'go', manager: 'gomod', depType: 'require' }

// `expect` is what the dependency is allowed to do, and each entry names the
// decision it encodes. 'disabled' means Renovate must not propose it at all.
const CASES = [
  [dep('frontend', 'vite-plugin-pwa', { ...npm, depType: 'devDependencies', updateType: 'minor' }),
    'human', 'install-prompt behaviour has no CI coverage (task 10.4c)'],
  [dep('frontend', '@playwright/test', { ...npm, depType: 'devDependencies', updateType: 'minor' }),
    'human', 'invalidates committed screenshot baselines Renovate cannot regenerate'],
  [dep('frontend', 'mcr.microsoft.com/playwright',
    { datasource: 'docker', manager: 'github-actions', updateType: 'minor' }),
    'disabled', 'the custom manager moves this tag with @playwright/test; a second path would split them'],
  [dep('frontend', 'fflate', { ...npm, depType: 'overrides', updateType: 'minor' }),
    'human', 'an override is resolved by removal as often as by upgrade'],
  [dep('frontend', 'posthog-js', { ...npm, depType: 'dependencies', updateType: 'major' }),
    'human', 'no major update automerges'],
  [dep('frontend', 'workbox-precaching', { ...npm, depType: 'devDependencies', updateType: 'minor' }),
    'automerge', 'the pwa Playwright project covers what a workbox upgrade breaks'],
  [dep('frontend', 'workbox-background-sync', { ...npm, depType: 'dependencies', updateType: 'minor' }),
    'automerge', 'same family as workbox-precaching, different depType — both must agree'],
  [dep('frontend', 'aurelia', { ...npm, depType: 'dependencies', updateType: 'minor' }),
    'automerge', 'app-shell tests repaired in task 2.8 (design D17)'],
  [dep('cloud-provisioning', '@pulumi/gcp', { ...npm, depType: 'dependencies', updateType: 'minor' }),
    'human', 'needs a pulumi preview a reviewer runs themselves (design D6)'],
  [dep('cloud-provisioning', 'asia-northeast2-docker.pkg.dev/liverty-music-prod/backend/api',
    { datasource: 'docker', manager: 'kustomize', updateType: 'minor' }),
    'disabled', 'changing a newTag is a deployment; bump-prod-pin.yml owns these (design D7)'],
  [dep('cloud-provisioning', 'external-secrets', { datasource: 'helm', manager: 'helmv3', updateType: 'minor' }),
    'human', 'ArgoCD syncs the cluster from these; never enabled for automerge'],
  [dep('backend', 'go', { datasource: 'golang-version', manager: 'gomod', depType: 'toolchain', updateType: 'patch' }),
    'automerge', 'a Go patch release (task 10.5)'],
  [dep('backend', 'go', { datasource: 'golang-version', manager: 'gomod', depType: 'golang', updateType: 'minor' }),
    'human', 'Renovate calls 1.27 -> 1.28 a minor; Go calls it a language release'],
  [dep('backend', 'go.opentelemetry.io/otel', { ...gomod, updateType: 'minor' }),
    'automerge', 'go build, go test and golangci-lint all gate the merge'],
  [dep('backend', 'buf.build/gen/go/liverty-music/schema/protocolbuffers/go', { ...gomod, updateType: 'minor' }),
    'disabled', 'advances with its OpenSpec change and that change code migration'],
  [dep('specification', 'actions/checkout', { datasource: 'github-tags', manager: 'github-actions', updateType: 'patch' }),
    'automerge', 'stage 1 (task 10.3)'],
  [dep('.github', 'actions/checkout', { datasource: 'github-tags', manager: 'github-actions', updateType: 'patch' }),
    'human', 'this repository has no CI and no branch protection (design D11)'],
]

const rulesFor = (repo) => [
  // mergeChildConfig concatenates mergeable arrays parent-then-child, and
  // applyPackageRules applies each match over the last — so a repository's own
  // rules are evaluated after the preset's and win. Several exclusions above
  // depend on that and would be silently lost if it stopped being true.
  ...(preset.packageRules ?? []),
  ...(read(path.join(root, repo, 'renovate.json')).packageRules ?? []),
]

const verdict = async (c, withKillSwitch) => {
  const rules = rulesFor(c.repo)
  const resolved = await applyPackageRules({
    ...c,
    repository: `liverty-music/${c.repo}`,
    automerge: false,
    packageRules: withKillSwitch ? [...rules, KILL_SWITCH] : rules,
  })
  if (resolved.enabled === false) return 'disabled'
  return resolved.automerge === true ? 'automerge' : 'human'
}

const failures = []
for (const [c, expected, why] of CASES) {
  const got = await verdict(c, false)
  const line = `${c.repo.padEnd(19)} ${c.depName.slice(0, 55).padEnd(56)} ${String(c.updateType).padEnd(6)}`
  if (got === expected) {
    console.log(`  ok   ${line} ${got}`)
    continue
  }
  console.log(`  FAIL ${line} expected ${expected}, got ${got}`)
  failures.push(`${c.repo}/${c.depName} (${c.updateType}): expected ${expected}, got ${got} — ${why}`)
}

// A dependency that is `disabled` is not proposed at all, so the kill switch
// has nothing to say about it; everything else must land on `human`.
for (const [c, expected] of CASES) {
  if (expected === 'disabled') continue
  const got = await verdict(c, true)
  if (got !== 'human') {
    failures.push(`kill switch did not stop ${c.repo}/${c.depName} (${c.updateType}): got ${got}`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} policy expectation(s) violated:`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`\n${CASES.length} policy expectations hold, and the kill switch zeroes every one of them.`)
