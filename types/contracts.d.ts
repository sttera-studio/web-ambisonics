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
  | 'ERR_INVALID_LAYOUT_NORMALIZATION_PAIR'
  | 'ERR_INVALID_LAYOUT_ORDER_PAIR'
  | 'ERR_INVALID_HRIR_SET'
  | 'ERR_CHANNEL_COUNT_MISMATCH'
  | 'ERR_INVALID_CUSTOM_HRIR_LIST';

export type DomainInvariantViolation = {
  code: DomainErrorCode;
  message: string;
};

export type ProfileValidationResult =
  | {ok: true; profile: NormalizedAmbisonicProfile}
  | {ok: false; error: DomainInvariantViolation};

export type RendererLifecycleState =
  | 'created'
  | 'initializing'
  | 'ready'
  | 'errored';

export type ExpectedChannelCount = {
  order: AmbisonicOrder;
  channels: number;
};
