# Mobile dependency compatibility patches

React Navigation 7 depends on CommonJS `query-string@7.1.3`. Its legacy decoder
can consume exponential CPU on a malformed deep-link query
([GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)).

The `decode-uri-component` override selects the patched `0.5.0` release. That
release exports an ES module default; the one-line `query-string` patch reads
that default without changing React Navigation's query-string API. `postinstall`
applies the patch and fails if it can no longer be applied. Remove the patch and
override when the supported navigation stack adopts a patched decoder itself.

The Metro overrides keep all Metro modules on `0.83.8`, which removes the
vulnerable `image-size` dependency while retaining Expo SDK 54. Validate changes
with mobile tests, typecheck, `expo install --check`, and iOS/Android exports.

The Expo CLI patch adapts Metro 0.83's grouped file-change events to the older
`eventsQueue` format expected by SDK 54. Without it, editing a file while the
native app is open crashes the development server with `eventsQueue is not
iterable`. It preserves TypeScript detection, environment reloads, and file
change callbacks. Remove it when upgrading to an Expo CLI that supports the
new Metro watcher events.
