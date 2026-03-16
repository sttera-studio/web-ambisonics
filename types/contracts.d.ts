export type AmbisonicOrder = 1 | 2 | 3;
export type AmbisonicLayout = 'ambix' | 'fuma';
export type AmbisonicNormalization = 'sn3d' | 'fuma';
export type HrirSetMode = 'default' | 'custom-url';

export type AmbixProfile = {
  layout?: 'ambix';
  normalization?: 'sn3d';
  order: AmbisonicOrder;
  hrirSet?: HrirSetMode;
};

export type FumaProfile = {
  layout: 'fuma';
  normalization: 'fuma';
  order: 1;
  hrirSet?: HrirSetMode;
};

export type AmbisonicProfile = AmbixProfile | FumaProfile;

export type NormalizedAmbisonicProfile = {
  layout: AmbisonicLayout;
  normalization: AmbisonicNormalization;
  order: AmbisonicOrder;
  hrirSet: HrirSetMode;
};

export type DomainErrorCode =
  | 'ERR_UNSUPPORTED_LAYOUT'
  | 'ERR_UNSUPPORTED_NORMALIZATION'
  | 'ERR_INVALID_ORDER'
  | 'ERR_INVALID_PROFILE_COMBINATION'
  | 'ERR_INVALID_HRIR_SET'
  | 'ERR_CHANNEL_COUNT_MISMATCH'
  | 'ERR_INVALID_CUSTOM_HRIR_LIST'
  | 'ERR_PROFILE_VALIDATION_FAILED'
  | 'ERR_INVALID_NODE_CONNECTION'
  | 'ERR_INVALID_SCENE'
  | 'ERR_INVALID_SOURCE'
  | 'ERR_INVALID_RENDERER'
  | 'ERR_INVALID_POSE';

export type DomainInvariantViolation = {
  code: DomainErrorCode;
  message: string;
  fix?: string;
  cause?: unknown;
};

export type RendererLifecycleState =
  | 'created'
  | 'initializing'
  | 'ready'
  | 'errored'
  | 'disposed';

export type ObservabilityEvent =
  | {type: 'profile_validated'; kind: 'renderer' | 'scene'; profile: NormalizedAmbisonicProfile}
  | {type: 'init_start'; kind: 'renderer' | 'scene'; state: RendererLifecycleState}
  | {type: 'init_ready'; kind: 'renderer' | 'scene'; state: RendererLifecycleState}
  | {type: 'warning'; kind: 'renderer' | 'scene'; warnings: string[]}
  | {type: 'source_added'; kind: 'scene'; sourceId: string}
  | {type: 'source_removed'; kind: 'scene'; sourceId: string}
  | {type: 'param_updated'; kind: 'scene' | 'renderer' | 'source'; param: string}
  | {type: 'disposed'; kind: 'renderer' | 'scene'; state: RendererLifecycleState}
  | {type: 'error'; kind: 'renderer' | 'scene'; state: RendererLifecycleState; error: unknown};

export type SafeResult<T> = {ok: true; value: T} | {ok: false; error: DomainInvariantViolation};

export type Vector3Tuple = readonly [number, number, number];
export type Vector3Object = {x: number; y: number; z: number};
export type Vector3Like = Vector3Tuple | Vector3Object;

export type Pose3D = {
  position?: Vector3Like;
  forward?: Vector3Like;
  up?: Vector3Like;
};

export type SourceParams = {
  gain?: number;
  minDistance?: number;
  maxDistance?: number;
  rolloff?: string;
  sourceWidth?: number;
  alpha?: number;
  sharpness?: number;
};

export type RoomConfig = {
  dimensions?: Record<string, number>;
  materials?: Record<string, string>;
  speedOfSound?: number;
};

export type RampOptions = {
  rampMs?: number;
  timeConstant?: number;
};

export type SceneSnapshot = {
  ambisonicOrder: number | null;
  sourceCount: number;
  listenerPosition: number[] | null;
  hasOutput: boolean;
  hasAmbisonicInput: boolean;
  hasAmbisonicOutput: boolean;
  lifecycleState: RendererLifecycleState | 'unknown';
};

export type SourceSnapshot = {
  position: number[] | null;
  forward: number[] | null;
  up: number[] | null;
  gain: number | null;
  minDistance: number | null;
  maxDistance: number | null;
  disposed: boolean;
};

export type GraphHealth = {
  sceneReady: boolean;
  sourceCount: number;
  disposed: boolean;
  hasOutputNode: boolean;
  hasAmbisonicInputNode: boolean;
  hasAmbisonicOutputNode: boolean;
};

export type ManagedSourceHandle = {
  id: string;
  source: {dispose(): void};
};
