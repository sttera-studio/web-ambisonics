# web-ambisonics

The most advanced JavaScript library for ambisonics audio.  

Browser-first 3D audio toolkit extending older packages Omnitone and the Resonance Audio Web SDK.

## Structure

- ESM public API in `src/index.js`
- Omnitone runtime source in `src/third_party/omnitone`
- Resonance Audio SDK runtime source in `src/third_party/resonance-audio`

## Run example

```sh
python3 -m http.server 8080
# Open http://localhost:8080/example/

npm run typecheck
# Validates the type contracts
```

1. Use headphones to hear a moving oscillator source in 3D.
2. Edit `example/main.js` to change source position, tone, and scene options.

## TypeSript architecture

- Runtime - JavaScript in `src/`.
- Public API contracts - `types/index.d.ts`.
- Ambisonics domain invariants - `types/contracts.d.ts`.
- `package.json` exports ESM runtime and bundled TypeScript types.

## License and notices

- This repository currently keeps its root project license as GPL-3.0-or-later.
- Vendored Omnitone and Resonance Audio code remain under Apache-2.0 with preserved license and notices in their original copied paths.

