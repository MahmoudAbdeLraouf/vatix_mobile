# Vatix OTA (self-hosted, replaces EAS Update)

Cloudflare Worker + R2 at `https://updates.vatix.store`, speaking the Expo Updates protocol v1.
Manifests are signed **locally** with `~/.vatix-ota/keys/private-key.pem`; the app only accepts
updates signed by the key matching `certs/certificate.pem`. Lose the key → no more OTA until a new
store build ships with a new certificate. Back up `~/.vatix-ota/`.

## Everyday use (from the mobile root)

```bash
npm run ota -- publish -m "what changed"          # export + sign + upload + go live (both platforms)
npm run ota -- publish -m "..." --platform ios
npm run ota -- history                             # what's live per platform/runtime
npm run ota -- rollback --to <updateId>            # re-publish an older update
npm run ota -- rollback-embedded                   # back to the bundle inside the binary
```

`--dry-run` exports and signs without uploading. The production env comes from `eas.json`
(`build.production.env`), never from your shell.

## Runtime version

`runtimeVersion.policy = fingerprint`: any native change (deps with native code, app.json,
plugins, eas.json, .easignore…) produces a new runtime, and OTA updates only reach binaries built
from the same fingerprint. If `publish` prints a runtime no store build has, ship a new build.

## Builds

```bash
eas build --local --platform ios --profile production
eas build --local --platform android --profile production   # needs JDK 17
eas submit --platform ios --path <file.ipa>
eas submit --platform android --path <file.aab>
```

## Worker

```bash
cd ota && npx wrangler deploy
npx wrangler secret put ADMIN_TOKEN < ~/.vatix-ota/admin-token   # once
```
