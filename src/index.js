import Omnitone from './third_party/omnitone/omnitone.js';
import ResonanceAudio from './third_party/resonance-audio/main.js';
import {AmbisonicEncoder} from './ambisonic-encoder/ambisonic-encoder.js';

const SUPPORTED_LAYOUTS = ['ambix', 'fuma'];
const SUPPORTED_NORMALIZATIONS = ['sn3d', 'fuma'];
const SUPPORTED_HRIR_SETS = ['default', 'custom-url'];
const MAX_SUPPORTED_ORDER = 3;
const FUMA_FOA_CHANNEL_MAP = [0, 3, 1, 2];
const AMBIX_FOA_CHANNEL_MAP = [0, 1, 2, 3];
const connectionRegistry = new WeakMap();
const sceneMuteState = new WeakMap();
const managedSourceRegistry = new WeakMap();
let managedSourceCounter = 0;

function createDomainError(code, message, fix, cause) {
  const error = new Error(message);
  error.name = 'AmbisonicsError';
  error.code = code;
  error.fix = fix;
  if (cause !== undefined) {
    error.cause = cause;
  }
  return error;
}

function toViolation(error, fallbackCode, fallbackFix) {
  return {
    code: error?.code || fallbackCode,
    message: error?.message || 'Unknown ambisonics error.',
    fix: error?.fix || fallbackFix,
    cause: error?.cause ?? error,
  };
}

function emitEvent(handler, event) {
  if (typeof handler === 'function') {
    handler(event);
  }
}

function safeDisconnect(node) {
  if (!node || typeof node.disconnect !== 'function') {
    return;
  }
  try {
    node.disconnect();
  } catch (_error) {
    // Ignore duplicate/invalid disconnection attempts.
  }
}

function withLifecycle(target, kind, onEvent, hasInitialize = false) {
  let state = 'created';
  target.getLifecycleState = () => state;
  target.dispose = () => {
    if (state === 'disposed') {
      return;
    }
    state = 'disposed';
    safeDisconnect(target.input);
    safeDisconnect(target.output);
    safeDisconnect(target.ambisonicInput);
    safeDisconnect(target.ambisonicOutput);
    emitEvent(onEvent, {type: 'disposed', kind, state});
  };

  if (hasInitialize && typeof target.initialize === 'function') {
    const initialize = target.initialize.bind(target);
    target.initialize = async (...args) => {
      state = 'initializing';
      emitEvent(onEvent, {type: 'init_start', kind, state});
      try {
        const result = await initialize(...args);
        state = 'ready';
        emitEvent(onEvent, {type: 'init_ready', kind, state});
        return result;
      } catch (error) {
        state = 'errored';
        emitEvent(onEvent, {type: 'error', kind, state, error});
        throw error;
      }
    };
  } else {
    state = 'ready';
    emitEvent(onEvent, {type: 'init_ready', kind, state});
  }

  return target;
}

function normalizeProfile(profile = {}) {
  const layout = profile.layout ?? 'ambix';
  const normalization = profile.normalization ?? (layout === 'fuma' ? 'fuma' : 'sn3d');
  const order = profile.order ?? 1;
  const hrirSet = profile.hrirSet ?? 'default';

  if (!SUPPORTED_LAYOUTS.includes(layout)) {
    throw createDomainError(
      'ERR_UNSUPPORTED_LAYOUT',
      `Unsupported ambisonic layout "${layout}". Supported: ${SUPPORTED_LAYOUTS.join(', ')}.`,
      'Use "ambix" for FOA/HOA or "fuma" for FOA.'
    );
  }
  if (!SUPPORTED_NORMALIZATIONS.includes(normalization)) {
    throw createDomainError(
      'ERR_UNSUPPORTED_NORMALIZATION',
      `Unsupported ambisonic normalization "${normalization}". Supported: ${SUPPORTED_NORMALIZATIONS.join(', ')}.`,
      'Use "sn3d" for AmbiX and "fuma" for FuMa.'
    );
  }
  if (!Number.isInteger(order) || order < 1 || order > MAX_SUPPORTED_ORDER) {
    throw createDomainError(
      'ERR_INVALID_ORDER',
      `Invalid ambisonic order "${order}". Supported integer range: 1-${MAX_SUPPORTED_ORDER}.`,
      `Use an integer ambisonic order between 1 and ${MAX_SUPPORTED_ORDER}.`
    );
  }
  if (!SUPPORTED_HRIR_SETS.includes(hrirSet)) {
    throw createDomainError(
      'ERR_INVALID_HRIR_SET',
      `Unsupported hrirSet "${hrirSet}". Supported: ${SUPPORTED_HRIR_SETS.join(', ')}.`,
      'Use "default" or "custom-url".'
    );
  }
  if (layout === 'fuma' && order !== 1) {
    throw createDomainError(
      'ERR_INVALID_PROFILE_COMBINATION',
      'FuMa is only valid for FOA (order 1). Use AmbiX for HOA.',
      'Set profile.order to 1 for FuMa, or switch layout to AmbiX.'
    );
  }
  if (layout === 'ambix' && normalization !== 'sn3d') {
    throw createDomainError(
      'ERR_INVALID_PROFILE_COMBINATION',
      'AmbiX requires SN3D normalization.',
      'Set profile.normalization to "sn3d".'
    );
  }
  if (layout === 'fuma' && normalization !== 'fuma') {
    throw createDomainError(
      'ERR_INVALID_PROFILE_COMBINATION',
      'FuMa layout requires FuMa normalization.',
      'Set profile.normalization to "fuma".'
    );
  }

  return {layout, normalization, order, hrirSet};
}

function getExpectedChannelCount(order) {
  return (order + 1) * (order + 1);
}

/**
 * Largest ambisonic order N the destination device count allows, with
 * (N+1)^2 <= maxChannelCount. Uses floor(sqrt(maxChannels) - 1) for N >= 2;
 * first-order AmbiX needs four channels.
 * @param {BaseAudioContext|undefined} context
 * @returns {number|null} Platform limit, or null if unknown or fewer than four channels.
 */
export function resolveMaxOrder(context) {
  const maxCh = context?.destination?.maxChannelCount;
  if (!Number.isFinite(maxCh) || maxCh < 1) {
    return null;
  }
  const raw = Math.floor(Math.sqrt(maxCh) - 1);
  if (raw < 1) {
    return maxCh >= 4 ? 1 : null;
  }
  return raw;
}

function assertCustomHrirList(hrirSet, hrirPathList, order) {
  if (hrirSet !== 'custom-url') {
    return;
  }
  if (!Array.isArray(hrirPathList)) {
    throw createDomainError(
      'ERR_INVALID_CUSTOM_HRIR_LIST',
      'Custom HRIR set requires "hrirPathList" as an array of URLs.',
      'Provide hrirPathList as an array of URL strings.'
    );
  }
  if (!hrirPathList.every((item) => typeof item === 'string' && item.length > 0)) {
    throw createDomainError(
      'ERR_INVALID_CUSTOM_HRIR_LIST',
      'Custom HRIR list must contain only non-empty URL strings.',
      'Ensure every hrirPathList entry is a valid URL string.'
    );
  }
  if (order === 1 && hrirPathList.length !== 2) {
    throw createDomainError(
      'ERR_INVALID_CUSTOM_HRIR_LIST',
      'FOA custom HRIR requires exactly 2 URLs.',
      'Provide 2 stereo HRIR URLs for FOA.'
    );
  }
  const expectedHoaStereoBuffers = Math.ceil(getExpectedChannelCount(order) / 2);
  if (order > 1 && hrirPathList.length !== expectedHoaStereoBuffers) {
    throw createDomainError(
      'ERR_INVALID_CUSTOM_HRIR_LIST',
      `HOA order ${order} custom HRIR requires exactly ${expectedHoaStereoBuffers} URLs.`,
      `Provide ${expectedHoaStereoBuffers} stereo HRIR URLs for HOA order ${order}.`
    );
  }
}

function normalizeRendererConfig(config = {}) {
  return {
    ...config,
    profile: config.profile ?? {
      order: config.ambisonicOrder ?? 1,
      layout: 'ambix',
      normalization: 'sn3d',
      hrirSet: config.hrirPathList ? 'custom-url' : 'default',
    },
  };
}

function normalizeSceneOptions(options = {}) {
  return {
    ...options,
    profile: options.profile ?? {
      order: options.ambisonicOrder ?? 1,
      layout: 'ambix',
      normalization: 'sn3d',
    },
  };
}

export function resolveProfileWithFallback(profile, capabilities = {}) {
  const requested = profile ?? {};
  const fallback = {...requested};
  const maxOrder = Math.min(MAX_SUPPORTED_ORDER, capabilities.maxAmbisonicOrder ?? MAX_SUPPORTED_ORDER);
  const warnings = [];

  if (typeof fallback.order === 'number' && fallback.order > maxOrder) {
    warnings.push(`Requested order ${fallback.order} exceeds max ${maxOrder}; using ${maxOrder}.`);
    fallback.order = maxOrder;
  }
  if (fallback.layout === 'fuma' && fallback.order && fallback.order > 1) {
    warnings.push('FuMa only supports FOA; forcing order 1.');
    fallback.order = 1;
  }
  if (capabilities.autoplayLikelyBlocked) {
    warnings.push('AudioContext is suspended; resume context after user interaction.');
  }

  return {
    requested,
    resolved: normalizeProfile(fallback),
    warnings,
  };
}

/**
 * Create an Omnitone renderer with a single entry point.
 * Defaults to FOA and automatically selects HOA when order > 1.
 */
export function createOmnitoneRenderer(context, config = {}) {
  const normalizedConfig = normalizeRendererConfig(config);
  const profile = normalizeProfile(normalizedConfig.profile);
  emitEvent(normalizedConfig.onEvent, {type: 'profile_validated', kind: 'renderer', profile});
  assertCustomHrirList(profile.hrirSet, normalizedConfig.hrirPathList, profile.order);

  const order = profile.order;
  const channelMap = normalizedConfig.channelMap ?? (profile.layout === 'fuma'
    ? FUMA_FOA_CHANNEL_MAP
    : AMBIX_FOA_CHANNEL_MAP);
  const {
    onEvent: _onEvent,
    profile: _profile,
    fallbackToSafeProfile: _fallbackToSafeProfile,
    ...rendererConfig
  } = normalizedConfig;

  if (order > 1) {
    const renderer = Omnitone.createHOARenderer(context, {
      ...rendererConfig,
      ambisonicOrder: order,
      hrirPathList: profile.hrirSet === 'custom-url' ? normalizedConfig.hrirPathList : undefined,
    });
    return withLifecycle(renderer, 'renderer', normalizedConfig.onEvent, true);
  }

  const renderer = Omnitone.createFOARenderer(context, {
    ...rendererConfig,
    channelMap,
    hrirPathList: profile.hrirSet === 'custom-url' ? normalizedConfig.hrirPathList : undefined,
  });
  return withLifecycle(renderer, 'renderer', normalizedConfig.onEvent, true);
}

/**
 * Create a Resonance Audio scene with modern defaults.
 */
export function createResonanceScene(context, options = {}) {
  const normalizedOptions = normalizeSceneOptions(options);
  const profile = normalizeProfile(normalizedOptions.profile);
  emitEvent(normalizedOptions.onEvent, {type: 'profile_validated', kind: 'scene', profile});
  const {
    onEvent: _onEvent,
    profile: _profile,
    fallbackToSafeProfile: _fallbackToSafeProfile,
    ...sceneOptions
  } = normalizedOptions;
  const scene = new ResonanceAudio(context, {
    ...sceneOptions,
    ambisonicOrder: profile.order,
    listenerChannelMap: profile.layout === 'fuma' ? FUMA_FOA_CHANNEL_MAP : undefined,
  });
  return withLifecycle(scene, 'scene', normalizedOptions.onEvent, false);
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
    throw createDomainError(
      'ERR_CHANNEL_COUNT_MISMATCH',
      `Invalid channel count ${channelCount} for order ${normalized.order}. Expected ${expected}.`,
      `Provide exactly ${expected} channels for order ${normalized.order}.`
    );
  }
  return true;
}

/**
 * Validate and return a structured custom HRIR configuration.
 */
export function validateHrirPathList(profile, hrirPathList) {
  const normalized = normalizeProfile(profile);
  const hrirSet = hrirPathList ? 'custom-url' : normalized.hrirSet;
  assertCustomHrirList(hrirSet, hrirPathList, normalized.order);
  return {
    mode: hrirSet,
    pathList: hrirPathList ?? [],
  };
}

/**
 * Mono-in / HOA-out plane-wave encoder (ACN / SN3D) with per-degree NFC-HOA
 * high-pass shaping before angular weighting.
 */
export function createAmbisonicEncoder(context, options = {}) {
  const order = options.order ?? 1;
  if (!Number.isInteger(order) || order < 1 || order > MAX_SUPPORTED_ORDER) {
    throw createDomainError(
      'ERR_INVALID_ORDER',
      `Invalid ambisonic order "${order}". Supported integer range: 1-${MAX_SUPPORTED_ORDER}.`,
      `Use an integer ambisonic order between 1 and ${MAX_SUPPORTED_ORDER}.`
    );
  }
  return new AmbisonicEncoder(context, options);
}

/**
 * Runtime/browser capability and policy preflight helper.
 */
export function getWebAudioCapabilities(context) {
  const hasWindow = typeof window !== 'undefined';
  const hasAudioContext = hasWindow &&
    (typeof window.AudioContext !== 'undefined' ||
      typeof window.webkitAudioContext !== 'undefined');
  const contextState = context?.state ?? 'unknown';
  const autoplayLikelyBlocked = contextState === 'suspended';
  const maxDestinationChannels = context?.destination?.maxChannelCount ?? null;
  const platformMaxOrder = resolveMaxOrder(context);
  return {
    hasWindow,
    hasAudioContext,
    contextState,
    autoplayLikelyBlocked,
    maxDestinationChannels,
    maxAmbisonicOrder: platformMaxOrder ?? MAX_SUPPORTED_ORDER,
  };
}

/**
 * Safe creation wrapper for Omnitone renderer.
 */
export function safeCreateOmnitoneRenderer(context, config = {}) {
  try {
    const capabilities = getWebAudioCapabilities(context);
    const withFallback = config?.fallbackToSafeProfile === true;
    const fallbackResult = withFallback
      ? resolveProfileWithFallback(config.profile, capabilities)
      : null;
    const finalConfig = withFallback
      ? {...config, profile: fallbackResult.resolved}
      : config;
    emitEvent(config?.onEvent, {
      type: 'warning',
      kind: 'renderer',
      warnings: fallbackResult?.warnings ?? [],
    });
    const renderer = createOmnitoneRenderer(context, finalConfig);
    return {ok: true, value: renderer};
  } catch (error) {
    return {
      ok: false,
      error: toViolation(
        error,
        'ERR_PROFILE_VALIDATION_FAILED',
        'Check profile, HRIR configuration, and channel map.'
      ),
    };
  }
}

/**
 * Safe creation wrapper for Resonance scene.
 */
export function safeCreateResonanceScene(context, options = {}) {
  try {
    const capabilities = getWebAudioCapabilities(context);
    const withFallback = options?.fallbackToSafeProfile === true;
    const fallbackResult = withFallback
      ? resolveProfileWithFallback(options.profile, capabilities)
      : null;
    const finalOptions = withFallback
      ? {...options, profile: fallbackResult.resolved}
      : options;
    emitEvent(options?.onEvent, {
      type: 'warning',
      kind: 'scene',
      warnings: fallbackResult?.warnings ?? [],
    });
    const scene = createResonanceScene(context, finalOptions);
    return {ok: true, value: scene};
  } catch (error) {
    return {
      ok: false,
      error: toViolation(
        error,
        'ERR_PROFILE_VALIDATION_FAILED',
        'Check profile compatibility and listener options.'
      ),
    };
  }
}

/**
 * Safe connect helper that avoids duplicate graph edges.
 */
export function connectChecked(source, destination) {
  if (!source || typeof source.connect !== 'function' || !destination) {
    throw createDomainError(
      'ERR_INVALID_NODE_CONNECTION',
      'Invalid source or destination for connectChecked.',
      'Pass valid AudioNodes as source and destination.'
    );
  }
  let destinations = connectionRegistry.get(source);
  if (!destinations) {
    destinations = new WeakSet();
    connectionRegistry.set(source, destinations);
  }
  if (!destinations.has(destination)) {
    source.connect(destination);
    destinations.add(destination);
  }
  return true;
}

/**
 * Safe disconnect helper with optional destination targeting.
 */
export function disconnectSafe(source, destination) {
  if (!source || typeof source.disconnect !== 'function') {
    return false;
  }
  try {
    if (destination) {
      source.disconnect(destination);
      const destinations = connectionRegistry.get(source);
      if (destinations) {
        destinations.delete?.(destination);
      }
    } else {
      source.disconnect();
      connectionRegistry.delete(source);
    }
    return true;
  } catch (_error) {
    return false;
  }
}

function getSceneContext(scene) {
  return scene?._context ?? null;
}

function parseVector3(value, label) {
  if (!value) {
    return null;
  }
  if (Array.isArray(value) && value.length === 3) {
    const [x, y, z] = value;
    if ([x, y, z].every((n) => Number.isFinite(n))) {
      return [x, y, z];
    }
  }
  if (typeof value === 'object' &&
      Number.isFinite(value.x) &&
      Number.isFinite(value.y) &&
      Number.isFinite(value.z)) {
    return [value.x, value.y, value.z];
  }
  throw createDomainError(
    'ERR_INVALID_POSE',
    `Invalid ${label}; expected [x,y,z] or {x,y,z}.`,
    `Provide ${label} as three finite numbers.`
  );
}

function scheduleAtAudioTime(context, atTime, callback) {
  const now = context?.currentTime ?? 0;
  const delayMs = Math.max(0, (atTime - now) * 1000);
  if (delayMs <= 0) {
    callback();
    return;
  }
  setTimeout(callback, delayMs);
}

function assertScene(scene) {
  if (!scene || typeof scene !== 'object' || typeof scene.createSource !== 'function') {
    throw createDomainError(
      'ERR_INVALID_SCENE',
      'Invalid scene handle.',
      'Pass a scene created by createResonanceScene or safeCreateResonanceScene.'
    );
  }
}

function assertSource(source) {
  if (!source || typeof source !== 'object' || typeof source.setPosition !== 'function') {
    throw createDomainError(
      'ERR_INVALID_SOURCE',
      'Invalid source handle.',
      'Pass a source created by scene.createSource or createManagedSource.'
    );
  }
}

function assertRenderer(renderer) {
  if (!renderer || typeof renderer !== 'object' || typeof renderer.setRenderingMode !== 'function') {
    throw createDomainError(
      'ERR_INVALID_RENDERER',
      'Invalid renderer handle.',
      'Pass a renderer created by createOmnitoneRenderer or safeCreateOmnitoneRenderer.'
    );
  }
}

function getManagedSourceMap(scene) {
  let map = managedSourceRegistry.get(scene);
  if (!map) {
    map = new Map();
    managedSourceRegistry.set(scene, map);
  }
  return map;
}

/**
 * Set scene master gain with optional smoothing ramp.
 */
export function setMasterGain(scene, gain, rampMs = 0) {
  assertScene(scene);
  if (!Number.isFinite(gain) || !scene.output?.gain) {
    throw createDomainError(
      'ERR_INVALID_SCENE',
      'Scene output gain node is unavailable or gain is invalid.',
      'Ensure scene.output is connected and gain is a finite number.'
    );
  }
  const context = getSceneContext(scene);
  const now = context?.currentTime ?? 0;
  const rampSec = Math.max(0, rampMs / 1000);
  if (rampSec > 0) {
    scene.output.gain.setTargetAtTime(gain, now, Math.max(0.001, rampSec / 3));
  } else {
    scene.output.gain.value = gain;
  }
  return true;
}

/**
 * Mute or unmute the scene while preserving previous gain.
 */
export function muteScene(scene, muted, rampMs = 0) {
  assertScene(scene);
  if (!scene.output?.gain) {
    throw createDomainError(
      'ERR_INVALID_SCENE',
      'Scene output gain node is unavailable.',
      'Ensure the scene output exists before muting.'
    );
  }
  if (muted) {
    sceneMuteState.set(scene, scene.output.gain.value);
    return setMasterGain(scene, 0, rampMs);
  }
  const previousGain = sceneMuteState.get(scene);
  const restored = Number.isFinite(previousGain) ? previousGain : 1;
  sceneMuteState.delete(scene);
  return setMasterGain(scene, restored, rampMs);
}

/**
 * Set listener position/orientation in a single call.
 */
export function setListenerPose(scene, pose) {
  assertScene(scene);
  const position = parseVector3(pose?.position, 'listener position');
  const forward = parseVector3(pose?.forward, 'listener forward');
  const up = parseVector3(pose?.up, 'listener up');
  if (position) {
    scene.setListenerPosition(position[0], position[1], position[2]);
  }
  if (forward || up) {
    const safeForward = forward ?? [0, 0, -1];
    const safeUp = up ?? [0, 1, 0];
    scene.setListenerOrientation(
      safeForward[0], safeForward[1], safeForward[2],
      safeUp[0], safeUp[1], safeUp[2]
    );
  }
  return true;
}

/**
 * Set source position/orientation with optional control smoothing.
 */
export function setSourcePose(source, pose, smoothMs = 0) {
  assertSource(source);
  const position = parseVector3(pose?.position, 'source position');
  const forward = parseVector3(pose?.forward, 'source forward');
  const up = parseVector3(pose?.up, 'source up');

  const applyPose = () => {
    if (position) {
      source.setPosition(position[0], position[1], position[2]);
    }
    if (forward || up) {
      const safeForward = forward ?? [0, 0, -1];
      const safeUp = up ?? [0, 1, 0];
      source.setOrientation(
        safeForward[0], safeForward[1], safeForward[2],
        safeUp[0], safeUp[1], safeUp[2]
      );
    }
  };

  if (smoothMs > 0) {
    setTimeout(applyPose, smoothMs);
  } else {
    applyPose();
  }
  return true;
}

/**
 * Batch source parameter updates with guardrails.
 */
export function setSourceParams(source, params) {
  assertSource(source);
  if (params.gain !== undefined) {
    source.setGain(params.gain);
  }
  if (params.minDistance !== undefined) {
    source.setMinDistance(params.minDistance);
  }
  if (params.maxDistance !== undefined) {
    source.setMaxDistance(params.maxDistance);
  }
  if (params.rolloff !== undefined) {
    source.setRolloff(params.rolloff);
  }
  if (params.sourceWidth !== undefined) {
    source.setSourceWidth(params.sourceWidth);
  }
  if (params.alpha !== undefined || params.sharpness !== undefined) {
    const alpha = params.alpha ?? 0;
    const sharpness = params.sharpness ?? 1;
    source.setDirectivityPattern(alpha, sharpness);
  }
  return true;
}

/**
 * Update room-related parameters in one call.
 */
export function setRoom(scene, config) {
  assertScene(scene);
  if (config?.dimensions || config?.materials) {
    scene.setRoomProperties(config.dimensions ?? {}, config.materials ?? {});
  }
  if (config?.speedOfSound !== undefined) {
    scene.setSpeedOfSound(config.speedOfSound);
  }
  return true;
}

/**
 * Schedule source gain automation at an AudioContext timeline time.
 */
export function scheduleSourceGain(source, value, atTime, timeConstant = 0.01) {
  assertSource(source);
  if (!source.input?.gain) {
    throw createDomainError(
      'ERR_INVALID_SOURCE',
      'Source input gain node is unavailable.',
      'Ensure source.input is a valid GainNode.'
    );
  }
  source.input.gain.setTargetAtTime(value, atTime, Math.max(0.001, timeConstant));
  return true;
}

/**
 * Schedule source position updates.
 */
export function scheduleSourcePosition(source, position, atTime) {
  assertSource(source);
  const parsed = parseVector3(position, 'source position');
  const context = source._scene?._context;
  scheduleAtAudioTime(context, atTime, () => {
    source.setPosition(parsed[0], parsed[1], parsed[2]);
  });
  return true;
}

/**
 * Schedule listener position updates.
 */
export function scheduleListenerPosition(scene, position, atTime) {
  assertScene(scene);
  const parsed = parseVector3(position, 'listener position');
  scheduleAtAudioTime(getSceneContext(scene), atTime, () => {
    scene.setListenerPosition(parsed[0], parsed[1], parsed[2]);
  });
  return true;
}

/**
 * Schedule renderer mode change on timeline.
 */
export function scheduleRenderingModeChange(renderer, mode, atTime) {
  assertRenderer(renderer);
  scheduleAtAudioTime(renderer._context, atTime, () => {
    renderer.setRenderingMode(mode);
  });
  return true;
}

/**
 * Crossfade-like mode transition wrapper.
 */
export function crossfadeRenderingMode(renderer, mode, durationMs = 0) {
  assertRenderer(renderer);
  if (durationMs <= 0) {
    renderer.setRenderingMode(mode);
    return {applied: true, mode, durationMs: 0};
  }
  const atTime = (renderer._context?.currentTime ?? 0) + (durationMs / 1000);
  scheduleRenderingModeChange(renderer, mode, atTime);
  return {applied: true, mode, durationMs};
}

/**
 * Snapshot scene state for diagnostics and tooling.
 */
export function getSceneSnapshot(scene) {
  assertScene(scene);
  return {
    ambisonicOrder: Number.isFinite(scene._ambisonicOrder) ? scene._ambisonicOrder : null,
    sourceCount: Array.isArray(scene._sources) ? scene._sources.length : 0,
    listenerPosition: scene._listener?.position ? Array.from(scene._listener.position) : null,
    hasOutput: Boolean(scene.output),
    hasAmbisonicInput: Boolean(scene.ambisonicInput),
    hasAmbisonicOutput: Boolean(scene.ambisonicOutput),
    lifecycleState: typeof scene.getLifecycleState === 'function'
      ? scene.getLifecycleState()
      : 'unknown',
  };
}

/**
 * Snapshot source state for diagnostics and tooling.
 */
export function getSourceSnapshot(source) {
  assertSource(source);
  return {
    position: source._position ? Array.from(source._position) : null,
    forward: source._forward ? Array.from(source._forward) : null,
    up: source._up ? Array.from(source._up) : null,
    gain: Number.isFinite(source.input?.gain?.value) ? source.input.gain.value : null,
    minDistance: Number.isFinite(source._attenuation?.minDistance) ? source._attenuation.minDistance : null,
    maxDistance: Number.isFinite(source._attenuation?.maxDistance) ? source._attenuation.maxDistance : null,
    disposed: Boolean(source._isDisposed),
  };
}

/**
 * Inspect graph health for high-level operational checks.
 */
export function getGraphHealth(scene) {
  assertScene(scene);
  const lifecycleState = typeof scene.getLifecycleState === 'function'
    ? scene.getLifecycleState()
    : 'unknown';
  return {
    sceneReady: lifecycleState === 'ready' || lifecycleState === 'unknown',
    sourceCount: Array.isArray(scene._sources) ? scene._sources.length : 0,
    disposed: lifecycleState === 'disposed',
    hasOutputNode: Boolean(scene.output),
    hasAmbisonicInputNode: Boolean(scene.ambisonicInput),
    hasAmbisonicOutputNode: Boolean(scene.ambisonicOutput),
  };
}

/**
 * Create and register a source with a stable managed ID.
 */
export function createManagedSource(scene, options = {}) {
  assertScene(scene);
  const source = scene.createSource(options);
  const id = `src_${++managedSourceCounter}`;
  const sourceMap = getManagedSourceMap(scene);
  sourceMap.set(id, source);
  return {id, source};
}

/**
 * Remove source by managed ID.
 */
export function removeSourceById(scene, id) {
  assertScene(scene);
  const sourceMap = getManagedSourceMap(scene);
  const source = sourceMap.get(id);
  if (!source) {
    return false;
  }
  const removed = typeof scene.removeSource === 'function'
    ? scene.removeSource(source)
    : false;
  if (removed) {
    sourceMap.delete(id);
  }
  return removed;
}

/**
 * Dispose all scene sources and clear managed registry.
 */
export function disposeAllSources(scene) {
  assertScene(scene);
  const sourceMap = getManagedSourceMap(scene);
  const ids = Array.from(sourceMap.keys());
  let disposedCount = 0;
  ids.forEach((id) => {
    if (removeSourceById(scene, id)) {
      disposedCount += 1;
    }
  });
  return disposedCount;
}

/**
 * Return managed source IDs for a scene.
 */
export function listSourceIds(scene) {
  assertScene(scene);
  return Array.from(getManagedSourceMap(scene).keys());
}

export {Omnitone, ResonanceAudio, AmbisonicEncoder};
export {FUMA_FOA_CHANNEL_MAP, AMBIX_FOA_CHANNEL_MAP, MAX_SUPPORTED_ORDER};
export {getExpectedChannelCount};

export default {
  Omnitone,
  ResonanceAudio,
  AmbisonicEncoder,
  createOmnitoneRenderer,
  createResonanceScene,
  createAmbisonicEncoder,
  safeCreateOmnitoneRenderer,
  safeCreateResonanceScene,
  validateAmbisonicProfile,
  assertAmbisonicChannelCount,
  validateHrirPathList,
  createAmbisonicEncoder,
  getWebAudioCapabilities,
  resolveMaxOrder,
  resolveProfileWithFallback,
  connectChecked,
  disconnectSafe,
  getExpectedChannelCount,
  setMasterGain,
  muteScene,
  setListenerPose,
  setSourcePose,
  setSourceParams,
  setRoom,
  scheduleSourceGain,
  scheduleSourcePosition,
  scheduleListenerPosition,
  scheduleRenderingModeChange,
  crossfadeRenderingMode,
  getSceneSnapshot,
  getSourceSnapshot,
  getGraphHealth,
  createManagedSource,
  removeSourceById,
  disposeAllSources,
  listSourceIds,
};
