import Omnitone from './third_party/omnitone/omnitone.js';
import ResonanceAudio from './third_party/resonance-audio/main.js';

const SUPPORTED_LAYOUTS = ['ambix', 'fuma'];
const SUPPORTED_NORMALIZATIONS = ['sn3d', 'fuma'];
const SUPPORTED_HRIR_SETS = ['default', 'custom-url'];
const MAX_SUPPORTED_ORDER = 3;
const FUMA_FOA_CHANNEL_MAP = [0, 3, 1, 2];
const AMBIX_FOA_CHANNEL_MAP = [0, 1, 2, 3];

function normalizeProfile(profile = {}) {
  const layout = profile.layout ?? 'ambix';
  const normalization = profile.normalization ?? (layout === 'fuma' ? 'fuma' : 'sn3d');
  const order = profile.order ?? 1;
  const hrirSet = profile.hrirSet ?? 'default';

  if (!SUPPORTED_LAYOUTS.includes(layout)) {
    throw new Error(
      `Unsupported ambisonic layout "${layout}". Supported: ${SUPPORTED_LAYOUTS.join(', ')}.`
    );
  }
  if (!SUPPORTED_NORMALIZATIONS.includes(normalization)) {
    throw new Error(
      `Unsupported ambisonic normalization "${normalization}". Supported: ${SUPPORTED_NORMALIZATIONS.join(', ')}.`
    );
  }
  if (!Number.isInteger(order) || order < 1 || order > MAX_SUPPORTED_ORDER) {
    throw new Error(
      `Invalid ambisonic order "${order}". Supported integer range: 1-${MAX_SUPPORTED_ORDER}.`
    );
  }
  if (!SUPPORTED_HRIR_SETS.includes(hrirSet)) {
    throw new Error(
      `Unsupported hrirSet "${hrirSet}". Supported: ${SUPPORTED_HRIR_SETS.join(', ')}.`
    );
  }
  if (layout === 'fuma' && order !== 1) {
    throw new Error(
      'FuMa is only valid for FOA (order 1). Use AmbiX for HOA.'
    );
  }
  if (layout === 'ambix' && normalization !== 'sn3d') {
    throw new Error('AmbiX requires SN3D normalization.');
  }
  if (layout === 'fuma' && normalization !== 'fuma') {
    throw new Error('FuMa layout requires FuMa normalization.');
  }

  return {layout, normalization, order, hrirSet};
}

function getExpectedChannelCount(order) {
  return (order + 1) * (order + 1);
}

function assertCustomHrirList(hrirSet, hrirPathList, order) {
  if (hrirSet !== 'custom-url') {
    return;
  }
  if (!Array.isArray(hrirPathList)) {
    throw new Error(
      'Custom HRIR set requires "hrirPathList" as an array of URLs.'
    );
  }
  if (order === 1 && hrirPathList.length !== 2) {
    throw new Error('FOA custom HRIR requires exactly 2 URLs.');
  }
  const expectedHoaStereoBuffers = Math.ceil(getExpectedChannelCount(order) / 2);
  if (order > 1 && hrirPathList.length !== expectedHoaStereoBuffers) {
    throw new Error(
      `HOA order ${order} custom HRIR requires exactly ${expectedHoaStereoBuffers} URLs.`
    );
  }
}

/**
 * Create an Omnitone renderer with a single entry point.
 * Defaults to FOA and automatically selects HOA when order > 1.
 */
export function createOmnitoneRenderer(context, config = {}) {
  const profile = normalizeProfile(config.profile ?? {
    order: config.ambisonicOrder ?? 1,
    layout: 'ambix',
    normalization: 'sn3d',
    hrirSet: config.hrirPathList ? 'custom-url' : 'default',
  });
  assertCustomHrirList(profile.hrirSet, config.hrirPathList, profile.order);

  const order = profile.order;
  const channelMap = config.channelMap ?? (profile.layout === 'fuma'
    ? FUMA_FOA_CHANNEL_MAP
    : AMBIX_FOA_CHANNEL_MAP);

  if (order > 1) {
    return Omnitone.createHOARenderer(context, {
      ...config,
      ambisonicOrder: order,
      hrirPathList: profile.hrirSet === 'custom-url' ? config.hrirPathList : undefined,
    });
  }

  return Omnitone.createFOARenderer(context, {
    ...config,
    channelMap,
    hrirPathList: profile.hrirSet === 'custom-url' ? config.hrirPathList : undefined,
  });
}

/**
 * Create a Resonance Audio scene with modern defaults.
 */
export function createResonanceScene(context, options = {}) {
  const profile = normalizeProfile(options.profile ?? {
    order: options.ambisonicOrder ?? 1,
    layout: 'ambix',
    normalization: 'sn3d',
  });
  return new ResonanceAudio(context, {
    ...options,
    ambisonicOrder: profile.order,
    listenerChannelMap: profile.layout === 'fuma' ? FUMA_FOA_CHANNEL_MAP : undefined,
  });
}

/**
 * Validate an explicit profile without creating audio nodes.
 */
export function validateAmbisonicProfile(profile) {
  return normalizeProfile(profile);
}

/**
 * Assert that a stream/buffer channel count matches profile order.
 */
export function assertAmbisonicChannelCount(channelCount, profile) {
  const normalized = normalizeProfile(profile);
  const expected = getExpectedChannelCount(normalized.order);
  if (channelCount !== expected) {
    throw new Error(
      `Invalid channel count ${channelCount} for order ${normalized.order}. Expected ${expected}.`
    );
  }
  return true;
}

export {Omnitone, ResonanceAudio};
export {FUMA_FOA_CHANNEL_MAP, AMBIX_FOA_CHANNEL_MAP, MAX_SUPPORTED_ORDER};

export default {
  Omnitone,
  ResonanceAudio,
  createOmnitoneRenderer,
  createResonanceScene,
  validateAmbisonicProfile,
  assertAmbisonicChannelCount,
};
