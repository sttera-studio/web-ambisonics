# web-ambisonics

The most advavanced JavaScript library for ambisonics audio.  

Browser-first 3D audio toolkit that vendors and modernizes Omnitone and the Resonance Audio Web SDK.

## Structure

- ESM public API in `src/index.js`
- Omnitone runtime source in `src/third_party/omnitone`
- Resonance Audio Web runtime source in `src/third_party/resonance-audio`


## Run example

```sh
python3 -m http.server 8080
# Open http://localhost:8080/example/
```

1. Use headphones to hear a moving oscillator source in 3D.
2. Edit `example/main.js` to change source position, tone, and scene options.

## License and notices

- This repository currently keeps its root project license as GPL-3.0-or-later.
- Vendored Omnitone and Resonance Audio code remain under Apache-2.0 with preserved license and notices in their original copied paths.