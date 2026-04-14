/**
 * Shared card configuration normalization and validation.
 *
 * Both the single-card flow (CreateBoltcardScreen / DisplayAuthInfo) and
 * the URL-based flow (SetupBoltcard) must parse backend JSON that uses
 * inconsistent casing (K0 vs k0, LNURLW vs lnurlw_base, etc.).
 *
 * This module provides a single normalization point so the two flows
 * cannot drift again.
 */

/**
 * Normalizes backend / import JSON into a standard card-config shape.
 *
 * Handles both upper-case (K0) and lower-case (k0) key names, as well
 * as LNURLW / lnurlw_base and uid_privacy.
 *
 * @param {object} json – raw JSON from the backend or imported file
 * @returns {{
 *   k0: string|null,
 *   k1: string|null,
 *   k2: string|null,
 *   k3: string|null,
 *   k4: string|null,
 *   lnurlw_base: string|null,
 *   privateUID: boolean,
 *   cardName: string|null,
 * }}
 */
export function normalizeCardConfig(json) {
  return {
    k0: json.K0 || json.k0 || null,
    k1: json.K1 || json.k1 || null,
    k2: json.K2 || json.k2 || null,
    k3: json.K3 || json.k3 || null,
    k4: json.K4 || json.k4 || null,
    lnurlw_base: json.LNURLW || json.lnurlw_base || null,
    privateUID: json.uid_privacy == 'Y',
    cardName: json.card_name || null,
  };
}

/**
 * Returns true when all required fields (k0–k4, lnurlw_base) are present.
 *
 * @param {object} config – output of normalizeCardConfig
 * @returns {boolean}
 */
export function validateCardConfig(config) {
  const {k0, k1, k2, k3, k4, lnurlw_base} = config;
  return !!(k0 && k1 && k2 && k3 && k4 && lnurlw_base);
}

/**
 * Builds the NDEF URL with placeholder p and c query parameters.
 *
 * @param {string} lnurlw_base – base LNURL-withdraw URL
 * @returns {string}
 */
export function buildNdefUrl(lnurlw_base) {
  const separator = lnurlw_base.includes('?') ? '&' : '?';
  return (
    lnurlw_base +
    separator +
    'p=00000000000000000000000000000000&c=0000000000000000'
  );
}
