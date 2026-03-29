/**
 * Complex spherical harmonics (scipy-compatible) and AmbiX ACN packing.
 * Real ACN follows spaudiopy / N3D-ACN convention (Zotter & Frank), then SN3D
 * scaling per degree for Omnitone / AmbiX decoders.
 */

import {legendrePlm} from './assoc-legendre.js';

function fac(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) {
    r *= i;
  }
  return r;
}

const PI = Math.PI;

/**
 * scipy.special.sph_harm(m, n, theta, phi): theta = azimuth, phi = colatitude.
 * @returns {{re: number, im: number}}
 */
export function sphHarm(m, n, theta, phi) {
  const absm = Math.abs(m);
  const x = Math.cos(phi);
  const p = legendrePlm(n, absm, x);
  const pref = Math.sqrt(((2 * n + 1) / (4 * PI)) * (fac(n - absm) / fac(n + absm)));
  return {
    re: pref * p * Math.cos(m * theta),
    im: pref * p * Math.sin(m * theta),
  };
}

/**
 * N3D real SH coefficients in ACN order (same as spaudiopy `sh_matrix` real).
 * @param {number} order
 * @param {number} azimuthRad 0 = front (+x), increasing toward +y (left)
 * @param {number} colatitudeRad 0 = north pole (+z), π/2 = equator
 * @returns {Float64Array} length (order+1)^2
 */
export function n3dRealAcnFromAngles(order, azimuthRad, colatitudeRad) {
  const nCh = (order + 1) * (order + 1);
  const out = new Float64Array(nCh);
  let idx = 0;
  for (let n = 0; n <= order; n++) {
    for (let m = -n; m <= n; m++) {
      let r;
      if (m === 0) {
        r = sphHarm(0, n, azimuthRad, colatitudeRad).re;
      } else if (m < 0) {
        const h = sphHarm(Math.abs(m), n, azimuthRad, colatitudeRad);
        r = Math.SQRT2 * (-1) ** Math.abs(m) * h.im;
      } else {
        const h = sphHarm(m, n, azimuthRad, colatitudeRad);
        r = Math.SQRT2 * (-1) ** Math.abs(m) * h.re;
      }
      out[idx++] = r;
    }
  }
  return out;
}

/**
 * Schmidt SN3D scaling from N3D real ACN (AmbiX / MPEG-H).
 * @param {Float64Array} n3d
 * @param {number} order
 * @returns {Float64Array}
 */
export function sn3dFromN3d(n3d, order) {
  const out = new Float64Array(n3d.length);
  let i = 0;
  for (let l = 0; l <= order; l++) {
    const s = 1 / Math.sqrt(2 * l + 1);
    for (let m = -l; m <= l; m++) {
      out[i] = n3d[i] * s;
      i++;
    }
  }
  return out;
}

/**
 * Resonance-style degrees: azimuth 0–360 (front = 0), elevation −90–90 (up positive).
 * Converts to scipy/spaudiopy: azimuth rad [0, 2π), colatitude rad.
 */
export function degreesToAzimuthColatitudeRad(azimuthDeg, elevationDeg) {
  let az = (azimuthDeg % 360 + 360) % 360;
  const azRad = (az * PI) / 180;
  const elRad = (Math.min(90, Math.max(-90, elevationDeg)) * PI) / 180;
  const colatRad = PI / 2 - elRad;
  return {azimuthRad: azRad, colatitudeRad: colatRad};
}

/**
 * SN3D real ACN plane-wave encoding coefficients (AmbiX-compatible).
 */
export function sn3dPlaneWaveAcn(order, azimuthDeg, elevationDeg) {
  const {azimuthRad, colatitudeRad} = degreesToAzimuthColatitudeRad(
    azimuthDeg,
    elevationDeg
  );
  const n3d = n3dRealAcnFromAngles(order, azimuthRad, colatitudeRad);
  return sn3dFromN3d(n3d, order);
}
