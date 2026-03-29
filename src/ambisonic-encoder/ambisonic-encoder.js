/**
 * Plane-wave Ambisonic encoder with per-degree NFC-HOA high-pass shaping
 * (Daniel / Zotter–Frank style: radial filters before angular weighting).
 */

import {sn3dPlaneWaveAcn} from './spherical-harmonics.js';

const TWO_PI = Math.PI * 2;

/**
 * @param {number} acn
 * @returns {{l: number, m: number}}
 */
function lmFromAcn(acn) {
  const l = Math.floor(Math.sqrt(acn));
  const m = acn - l * l - l;
  return {l, m};
}

export class AmbisonicEncoder {
  /**
   * @param {BaseAudioContext} context
   * @param {object} [options]
   * @param {number} [options.order=1]
   * @param {number} [options.azimuthDeg=0]
   * @param {number} [options.elevationDeg=0]
   * @param {number} [options.distance=10] meters (large value ≈ far-field for NFC)
   * @param {number} [options.speedOfSound=343]
   * @param {number} [options.minDistance=0.05]
   */
  constructor(context, options = {}) {
    if (!context || typeof context.createGain !== 'function') {
      throw new TypeError('AmbisonicEncoder: valid BaseAudioContext required.');
    }

    const order = Number.isFinite(options.order) ? Math.floor(options.order) : 1;
    this._context = context;
    this._order = order;
    this._azimuthDeg = Number.isFinite(options.azimuthDeg) ? options.azimuthDeg : 0;
    this._elevationDeg = Number.isFinite(options.elevationDeg) ? options.elevationDeg : 0;
    this._distance = Number.isFinite(options.distance) ? options.distance : 10;
    this._speedOfSound = Number.isFinite(options.speedOfSound) ? options.speedOfSound : 343;
    this._minDistance = Number.isFinite(options.minDistance) ? options.minDistance : 0.05;

    const numCh = (order + 1) * (order + 1);
    this._numChannels = numCh;

    this.input = context.createGain();
    this._merger = context.createChannelMerger(numCh);
    this._gains = [];
    this._hpfByDegree = [];

    const branchHead = [];
    for (let l = 0; l <= order; l++) {
      if (l === 0) {
        branchHead[l] = this.input;
      } else {
        const hpf = context.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.Q.value = Math.SQRT1_2;
        this.input.connect(hpf);
        this._hpfByDegree[l] = hpf;
        branchHead[l] = hpf;
      }
    }

    for (let acn = 0; acn < numCh; acn++) {
      const {l} = lmFromAcn(acn);
      const g = context.createGain();
      this._gains[acn] = g;
      branchHead[l].connect(g);
      g.connect(this._merger, 0, acn);
    }

    this.output = context.createGain();
    this._merger.connect(this.output);

    this._updateNfcFrequencies();
    this._applyDirectionCoeffs();
  }

  get order() {
    return this._order;
  }

  /**
   * @param {number} azimuthDeg 0 = front (+x), 90 = left (+y), degrees
   * @param {number} elevationDeg −90…90, positive = above horizontal
   */
  setDirection(azimuthDeg, elevationDeg) {
    this._azimuthDeg = azimuthDeg;
    this._elevationDeg = elevationDeg;
    this._applyDirectionCoeffs();
  }

  /**
   * Source distance in meters; drives per-degree NFC corner frequencies
   * f_l = l · c / (2π r) (Daniel-style compact NFC-HOA approximation).
   * @param {number} rMeters
   */
  setDistance(rMeters) {
    this._distance = rMeters;
    this._updateNfcFrequencies();
  }

  /**
   * @param {number} c m/s
   */
  setSpeedOfSound(c) {
    this._speedOfSound = c;
    this._updateNfcFrequencies();
  }

  _applyDirectionCoeffs() {
    const coeffs = sn3dPlaneWaveAcn(
      this._order,
      this._azimuthDeg,
      this._elevationDeg
    );
    for (let i = 0; i < coeffs.length; i++) {
      this._gains[i].gain.value = coeffs[i];
    }
  }

  _updateNfcFrequencies() {
    const sr = this._context.sampleRate;
    const nyquist = sr * 0.45;
    const r = Math.max(this._minDistance, this._distance);
    const c = this._speedOfSound;

    for (let l = 1; l <= this._order; l++) {
      const hpf = this._hpfByDegree[l];
      if (!hpf) {
        continue;
      }
      let fc = (l * c) / (TWO_PI * r);
      fc = Math.min(Math.max(fc, 1), nyquist);
      hpf.frequency.value = fc;
    }
  }

  dispose() {
    try {
      this.input.disconnect();
    } catch (_e) {}
    for (const g of this._gains) {
      try {
        g.disconnect();
      } catch (_e) {}
    }
    for (let l = 1; l <= this._order; l++) {
      const h = this._hpfByDegree[l];
      if (h) {
        try {
          h.disconnect();
        } catch (_e) {}
      }
    }
    try {
      this._merger.disconnect();
    } catch (_e) {}
    try {
      this.output.disconnect();
    } catch (_e) {}
  }
}
