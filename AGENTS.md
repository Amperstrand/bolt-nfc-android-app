# AGENTS.md — bolt-nfc-android-app (fork; legacy lineage)

**Line canon**: this repo is one node of the boltcard line. The canonical
doctrine — repo map, SUN read-path architecture, the vectors-as-oracle
conformance rule, bench touchpoints — lives in
[ntag424-vectors/AGENTS.md](https://github.com/Amperstrand/ntag424-vectors/blob/main/AGENTS.md).

## What this repo is (and is not)

Fork of `boltcard/bolt-nfc-android-app` — the **original** Android
provisioning app (React Native, writes keys + NDEF onto NTAG424 DNA
cards). Upstream has since consolidated Android support into
[bolt-card-programmer](https://github.com/Amperstrand/bolt-card-programmer)
(the upstream README here says "Moved Permanently"); this fork is kept as
the **legacy write-path lineage** with a few maintenance tweaks that
predate that consolidation:

- deeplink `program`/`reset` accepting lower-case key variable names
  (LNBits compatibility)
- SDK 34 / react-native-nfc-manager bumps

**Do not build new provisioning features here** — new write-path work
belongs in bolt-card-programmer (see its AGENTS.md). This fork exists so
the historical LNBits-compat behavior stays reproducible and diffable
against the successor app.

## Build / test

```bash
npm install
npm test            # Jest: conformance suite (ntag424-vectors) + snapshot
npm run vectors:check   # vendored-copy drift guard (sha256 vs LOCK)
# Android build via the React Native toolchain of the fork's era
# (npx react-native run-android with an attached device or emulator)
```

No CI; off-device verification is the conformance suite below — the NFC
write path itself still needs a physical card. Treat it as read-mostly.

### Conformance suite (ntag424-vectors)

`__tests__/ntag424-vectors.test.js` runs the vendored ntag424-vectors
oracle suite (reference-locked by sha256 in
`__tests__/conformance/ntag424-vectors/LOCK`). Every vector this app's
crypto surface can express must pass: `aes_cmac` (the vendored AES-CMAC in
`src/utils/Cmac.js`), `sv2_build`, `picc_decrypt`, `sun_mac`, and the full
`sdm_full` chain (positive + negative) via `src/utils/sunVerify.js` — the
core extracted verbatim from `Ntag424.testPAndC` (which now delegates to
it), so the suite exercises the legacy verification path this fork exists
to preserve, not a re-implementation. `derive_keys` vectors are skipped
aloud (26 of 46): K0–K4 arrive from the issuing service, never derived
on-device. This pins the historical LNBits-compat chain byte-for-byte
against the same AN12196 oracle the successor app (bolt-card-programmer)
and the worker consume — the legacy lineage stays diffable, per this
repo's purpose.

## Write-path contract (shared with bolt-card-programmer)

Provisioning = authenticate with key 0 (factory zeros), change keys 1–4,
configure file settings + SDM, write the NDEF URL. The keys the app
fetches from the issuing service must be the deterministic-derivation
keys the worker's `keygenerator` computes — the write path and the read
path share one key derivation, decided by the canonical vectors.

## Rules for agents

- Changes here should be minimal maintenance only; anything behavioral
  needs the question asked: "why not bolt-card-programmer?"
- No secrets in commits or docs — fetched keys live on the card and in
  the operator's issuing service, never in the repo.
