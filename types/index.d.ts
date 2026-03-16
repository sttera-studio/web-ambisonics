import type {
  AmbisonicProfile,
  AmbisonicOrder,
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
  ProfileValidationResult,
  RendererLifecycleState,
  ExpectedChannelCount,
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
}

export interface ResonanceSource {
  input: AudioNode;
  setPosition(x: number, y: number, z: number): void;
}

export interface ResonanceScene {
  output: AudioNode;
  ambisonicInput: AudioNode;
  ambisonicOutput: AudioNode;
  createSource(options?: Record<string, unknown>): ResonanceSource;
  setRoomProperties(dimensions: Record<string, number>, materials: Record<string, string>): void;
  setListenerPosition(x: number, y: number, z: number): void;
  setListenerOrientation(
    forwardX: number,
    forwardY: number,
    forwardZ: number,
    upX: number,
    upY: number,
    upZ: number
  ): void;
}

export interface OmnitoneRendererConfig {
  profile?: AmbisonicProfile;
  ambisonicOrder?: AmbisonicOrder;
  channelMap?: FoaChannelMap | number[];
  hrirPathList?: string[];
  renderingMode?: RenderingMode;
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

export const Omnitone: Record<string, unknown>;
export const ResonanceAudio: new (
  context: BaseAudioContext,
  options?: ResonanceSceneOptions
) => ResonanceScene;

declare const _default: {
  Omnitone: typeof Omnitone;
  ResonanceAudio: typeof ResonanceAudio;
  createOmnitoneRenderer: typeof createOmnitoneRenderer;
  createResonanceScene: typeof createResonanceScene;
  validateAmbisonicProfile: typeof validateAmbisonicProfile;
  assertAmbisonicChannelCount: typeof assertAmbisonicChannelCount;
};

export default _default;
