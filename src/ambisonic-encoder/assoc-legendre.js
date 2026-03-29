/**
 * Associated Legendre polynomial P_l^m(x), m >= 0, |x| <= 1.
 * Matches scipy.special.lpmv (Ferrers functions) for the tested range; uses
 * Numerical Recipes recurrence (Press et al.) for stability.
 * @param {number} l degree >= 0
 * @param {number} m order 0 <= m <= l
 * @param {number} x
 * @returns {number}
 */
export function legendrePlm(l, m, x) {
  if (m < 0 || m > l) {
    return Number.NaN;
  }
  if (Math.abs(x) > 1) {
    return Number.NaN;
  }

  let pmm = 1.0;
  if (m > 0) {
    const somx2 = Math.sqrt((1.0 - x) * (1.0 + x));
    let fact = 1.0;
    for (let i = 1; i <= m; i++) {
      pmm *= -fact * somx2;
      fact += 2.0;
    }
  }

  if (l === m) {
    return pmm;
  }

  let pmmp1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) {
    return pmmp1;
  }

  let pll = pmmp1;
  let pmmPrev = pmm;
  for (let ll = m + 2; ll <= l; ll++) {
    pll = (x * (2 * ll - 1) * pmmp1 - (ll + m - 1) * pmmPrev) / (ll - m);
    pmmPrev = pmmp1;
    pmmp1 = pll;
  }
  return pll;
}
