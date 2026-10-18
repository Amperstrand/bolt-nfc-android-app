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
# Android build via the React Native toolchain of the fork's era
# (npx react-native run-android with an attached device or emulator)
```

No CI; verification is manual on-device (NFC write path needs a physical
card). Treat it as read-mostly.

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
