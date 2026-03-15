import Omnitone from './third_party/omnitone/omnitone.js';
import ResonanceAudio from './third_party/resonance-audio/main.js';

/**
 * Create an Omnitone renderer with a single entry point.
 * Defaults to FOA and automatically selects HOA when order > 1.
 */
export function createOmnitoneRenderer(context, config = {}) {
  const order = config.ambisonicOrder ?? 1;
  if (order > 1) {
    return Omnitone.createHOARenderer(context, {
      ...config,
      ambisonicOrder: order,
    });
  }
  return Omnitone.createFOARenderer(context, config);
}

/**
 * Create a Resonance Audio scene with modern defaults.
 */
export function createResonanceScene(context, options = {}) {
  return new ResonanceAudio(context, options);
}

export {Omnitone, ResonanceAudio};

export default {
  Omnitone,
  ResonanceAudio,
  createOmnitoneRenderer,
  createResonanceScene,
};
