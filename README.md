# web-ambisonics

The most advanced JavaScript library for ambisonics audio.  

Browser-first 3D audio toolkit extending previous libraries Omnitone and the Resonance Audio Web SDK.

## Structure

- ESM public API in `src/index.js`
- Omnitone runtime source in `src/third_party/omnitone`
- Resonance Audio Web runtime source in `src/third_party/resonance-audio`


## Run example

```sh
python3 -m http.server 8080
# Open http://localhost:8080/example/

npm run typecheck
# Verification
```

1. Use headphones to hear a moving oscillator source in 3D.
2. Edit `example/main.js` to change source position, tone, and scene options.


## TypeScript architecture

- Runtime JavaScript in `src/`.
- Public contracts in `types/index.d.ts`.
- Ambisonics invariants in `types/contracts.d.ts`.
- Package exports ship ESM runtime + TypeScript types.

## Standards and Literature

- Encoder NFC: per-degree high-pass before gains (Daniel-style NFC-HOA).
- SH plane-wave coefficients: scipy N3D-ACN real, then Schmidt SN3D scaling.
- Angles: degrees API; internally azimuth and colatitude match spaudiopy conventions.
- Omnitone and AmbiX decoders expect ACN channel order, SN3D normalization.
- Web Audio API channel graphs; respect context.sampleRate and destination limits.
- Runtime capability defaults use maxChannelCount when context reports finite values.
- Vendored Omnitone/Resonance remain Apache-2.0 alongside project GPL at root.

## License and notices

- This repository currently keeps its root project license as GPL-3.0-or-later.
- Vendored Omnitone and Resonance Audio code remain under Apache-2.0 with preserved license and notices in their original copied paths.


