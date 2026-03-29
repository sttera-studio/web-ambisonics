import type {
  AmbisonicOrder,
  AmbisonicProfile,
  NormalizedAmbisonicProfile,
} from './contracts';

export type {
  AmbisonicOrder,
  AmbisonicLayout,
  AmbisonicNormalization,
  HrirSetMode,
  AmbixProfile,
  FumaProfile,
  AmbisonicProfile,
  NormalizedAmbisonicProfile,
  DomainErrorCode,
  DomainInvariantViolation,
  RendererLifecycleState,
  ObservabilityEvent,
  SafeResult,
  Vector3Tuple,
  Vector3Object,
  Vector3Like,
  Pose3D,
  SourceParams,
  RoomConfig,
  RampOptions,
  SceneSnapshot,
  SourceSnapshot,
  GraphHealth,
  ManagedSourceHandle,
} from './contracts';

export type RenderingMode = 'ambisonic' | 'bypass' | 'off';
export type FoaChannelMap = readonly [number, number, number, number];

export interface OmnitoneRenderer {
  input: AudioNode;
  output: AudioNode;
  initialize(): Promise<void>;
  setRenderingMode(mode: RenderingMode): void;
  setRotationMatrix3(matrix: ArrayLike<number>): void;
  setRotationMatrix4(matrix: ArrayLike<number>): void;
  dispose(): void;
  getLifecycleState(): import('./contracts').RendererLifecycleState;
}

export interface ResonanceSource {
  input: AudioNode;
  setPosition(x: number, y: number, z: number): void;
  dispose(): void;
}

export interface ResonanceScene {
  output: AudioNode;
  ambisonicInput: AudioNode;
  ambisonicOutput: AudioNode;
  createSource(options?: Record<string, unknown>): ResonanceSource;
  removeSource(source: ResonanceSource): boolean;
  setRoomProperties(dimensions: Record<string, number>, materials: Record<string, string>): void;
  setSpeedOfSound(speedOfSound: number): void;
  setListenerPosition(x: number, y: number, z: number): void;
  setListenerOrientation(
    forwardX: number,
    forwardY: number,
    forwardZ: number,
    upX: number,
    upY: number,
    upZ: number
  ): void;
  dispose(): void;
  getLifecycleState(): import('./contracts').RendererLifecycleState;
}

export interface OmnitoneRendererConfig {
  profile?: AmbisonicProfile;
  ambisonicOrder?: AmbisonicOrder;
  channelMap?: FoaChannelMap | number[];
  hrirPathList?: string[];
  renderingMode?: RenderingMode;
  fallbackToSafeProfile?: boolean;
  onEvent?: (event: import('./contracts').ObservabilityEvent) => void;
}

export interface ResonanceSceneOptions {
  profile?: AmbisonicProfile;
  ambisonicOrder?: AmbisonicOrder;
  listenerPosition?: Float32Array;
  listenerForward?: Float32Array;
  listenerUp?: Float32Array;
  dimensions?: Record<string, number>;
  materials?: Record<string, string>;
  speedOfSound?: number;
  fallbackToSafeProfile?: boolean;
  onEvent?: (event: import('./contracts').ObservabilityEvent) => void;
}

export const MAX_SUPPORTED_ORDER: 3;
export const FUMA_FOA_CHANNEL_MAP: readonly [0, 3, 1, 2];
export const AMBIX_FOA_CHANNEL_MAP: readonly [0, 1, 2, 3];

export function createOmnitoneRenderer(
  context: BaseAudioContext,
  config?: OmnitoneRendererConfig
): OmnitoneRenderer;

export function createResonanceScene(
  context: BaseAudioContext,
  options?: ResonanceSceneOptions
): ResonanceScene;

export function validateAmbisonicProfile(
  profile: AmbisonicProfile
): NormalizedAmbisonicProfile;

export function assertAmbisonicChannelCount(
  channelCount: number,
  profile: AmbisonicProfile
): true;

export function validateHrirPathList(
  profile: AmbisonicProfile,
  hrirPathList?: string[]
): {mode: 'default' | 'custom-url'; pathList: string[]};

export interface AmbisonicEncoderConfig {
  order?: AmbisonicOrder;
  /** Degrees; 0 = front (+x), 90 = left (+y). */
  azimuthDeg?: number;
  /** Degrees; −90…90, positive above horizontal. */
  elevationDeg?: number;
  /** Meters; NFC corner frequencies use f_l = l·c/(2πr). */
  distance?: number;
  speedOfSound?: number;
  /** Minimum clamp for `setDistance` / NFC (meters). */
  minDistance?: number;
}

export declare class AmbisonicEncoder {
  constructor(context: BaseAudioContext, config?: AmbisonicEncoderConfig);
  input: GainNode;
  output: GainNode;
  readonly order: AmbisonicOrder;
  setDirection(azimuthDeg: number, elevationDeg: number): void;
  setDistance(rMeters: number): void;
  setSpeedOfSound(c: number): void;
  dispose(): void;
}

export function createAmbisonicEncoder(
  context: BaseAudioContext,
  config?: AmbisonicEncoderConfig
): AmbisonicEncoder;

/** Platform HOA order limit from `context.destination.maxChannelCount`, or null if unusable. */
export function resolveMaxOrder(context?: BaseAudioContext): number | null;

export function getWebAudioCapabilities(context?: BaseAudioContext): {
  hasWindow: boolean;
  hasAudioContext: boolean;
  contextState: string;
  autoplayLikelyBlocked: boolean;
  maxDestinationChannels: number | null;
  /** Upper bound implied by the destination channel count; may exceed {@link MAX_SUPPORTED_ORDER}. */
  maxAmbisonicOrder: number;
};

export function resolveProfileWithFallback(
  profile: AmbisonicProfile | undefined,
  capabilities?: {
    maxAmbisonicOrder?: number;
    autoplayLikelyBlocked?: boolean;
  }
): {
  requested: AmbisonicProfile | Record<string, never>;
  resolved: NormalizedAmbisonicProfile;
  warnings: string[];
};

export function safeCreateOmnitoneRenderer(
  context: BaseAudioContext,
  config?: OmnitoneRendererConfig
): import('./contracts').SafeResult<OmnitoneRenderer>;

export function safeCreateResonanceScene(
  context: BaseAudioContext,
  options?: ResonanceSceneOptions
): import('./contracts').SafeResult<ResonanceScene>;

export function connectChecked(source: AudioNode, destination: AudioNode): true;
export function disconnectSafe(source: AudioNode, destination?: AudioNode): boolean;
export function getExpectedChannelCount(order: AmbisonicOrder): number;
export function setMasterGain(
  scene: ResonanceScene,
  gain: number,
  rampMs?: number
): true;
export function muteScene(
  scene: ResonanceScene,
  muted: boolean,
  rampMs?: number
): true;
export function setListenerPose(
  scene: ResonanceScene,
  pose: import('./contracts').Pose3D
): true;
export function setSourcePose(
  source: ResonanceSource,
  pose: import('./contracts').Pose3D,
  smoothMs?: number
): true;
export function setSourceParams(
  source: ResonanceSource,
  params: import('./contracts').SourceParams
): true;
export function setRoom(
  scene: ResonanceScene,
  config: import('./contracts').RoomConfig
): true;
export function scheduleSourceGain(
  source: ResonanceSource,
  value: number,
  atTime: number,
  timeConstant?: number
): true;
export function scheduleSourcePosition(
  source: ResonanceSource,
  position: import('./contracts').Vector3Like,
  atTime: number
): true;
export function scheduleListenerPosition(
  scene: ResonanceScene,
  position: import('./contracts').Vector3Like,
  atTime: number
): true;
export function scheduleRenderingModeChange(
  renderer: OmnitoneRenderer,
  mode: RenderingMode,
  atTime: number
): true;
export function crossfadeRenderingMode(
  renderer: OmnitoneRenderer,
  mode: RenderingMode,
  durationMs?: number
): {applied: true; mode: RenderingMode; durationMs: number};
export function getSceneSnapshot(scene: ResonanceScene): import('./contracts').SceneSnapshot;
export function getSourceSnapshot(source: ResonanceSource): import('./contracts').SourceSnapshot;
export function getGraphHealth(scene: ResonanceScene): import('./contracts').GraphHealth;
export function createManagedSource(
  scene: ResonanceScene,
  options?: Record<string, unknown>
): import('./contracts').ManagedSourceHandle;
export function removeSourceById(scene: ResonanceScene, id: string): boolean;
export function disposeAllSources(scene: ResonanceScene): number;
export function listSourceIds(scene: ResonanceScene): string[];

export const Omnitone: Record<string, unknown>;
export const ResonanceAudio: new (
  context: BaseAudioContext,
  options?: ResonanceSceneOptions
) => ResonanceScene;

declare const _default: {
  Omnitone: typeof Omnitone;
  ResonanceAudio: typeof ResonanceAudio;
  AmbisonicEncoder: typeof AmbisonicEncoder;
  createOmnitoneRenderer: typeof createOmnitoneRenderer;
  createResonanceScene: typeof createResonanceScene;
  createAmbisonicEncoder: typeof createAmbisonicEncoder;
  safeCreateOmnitoneRenderer: typeof safeCreateOmnitoneRenderer;
  safeCreateResonanceScene: typeof safeCreateResonanceScene;
  validateAmbisonicProfile: typeof validateAmbisonicProfile;
  assertAmbisonicChannelCount: typeof assertAmbisonicChannelCount;
  validateHrirPathList: typeof validateHrirPathList;
  createAmbisonicEncoder: typeof createAmbisonicEncoder;
  getWebAudioCapabilities: typeof getWebAudioCapabilities;
  resolveMaxOrder: typeof resolveMaxOrder;
  resolveProfileWithFallback: typeof resolveProfileWithFallback;
  connectChecked: typeof connectChecked;
  disconnectSafe: typeof disconnectSafe;
  getExpectedChannelCount: typeof getExpectedChannelCount;
  setMasterGain: typeof setMasterGain;
  muteScene: typeof muteScene;
  setListenerPose: typeof setListenerPose;
  setSourcePose: typeof setSourcePose;
  setSourceParams: typeof setSourceParams;
  setRoom: typeof setRoom;
  scheduleSourceGain: typeof scheduleSourceGain;
  scheduleSourcePosition: typeof scheduleSourcePosition;
  scheduleListenerPosition: typeof scheduleListenerPosition;
  scheduleRenderingModeChange: typeof scheduleRenderingModeChange;
  crossfadeRenderingMode: typeof crossfadeRenderingMode;
  getSceneSnapshot: typeof getSceneSnapshot;
  getSourceSnapshot: typeof getSourceSnapshot;
  getGraphHealth: typeof getGraphHealth;
  createManagedSource: typeof createManagedSource;
  removeSourceById: typeof removeSourceById;
  disposeAllSources: typeof disposeAllSources;
  listSourceIds: typeof listSourceIds;
};

export default _default;
