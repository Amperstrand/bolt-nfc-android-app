/**
 * Shared NTAG-424 bolt-card provisioning logic.
 *
 * This module owns the exact sequence of NFC commands that turn a blank
 * (default-key) NTAG-424 card into a working bolt card.  Both the
 * single-card flow (CreateBoltcardScreen) and the URL-based / repeat
 * flow (SetupBoltcard) call this function instead of maintaining their
 * own copies.
 *
 * All NFC operations are injected via the `ntag` and `ndef` parameters
 * so the logic can be unit-tested without NFC hardware.
 */

import {buildNdefUrl} from './CardConfig';

export const DEFAULT_KEY = '00000000000000000000000000000000';

/**
 * Provisions an NTAG-424 card with bolt-card credentials.
 *
 * @param {object}   params
 * @param {object}   params.config      – normalised config (k0–k4, lnurlw_base, privateUID)
 * @param {object}   params.ntag        – Ntag424-compatible operations (dependency injection)
 * @param {object}   params.ndef        – Ndef encoder / decoder ({ uriRecord, encodeMessage, uri: { decodePayload } })
 * @param {function} [params.onProgress] – optional progress callback: (event, data) => void
 *
 * Progress events emitted via onProgress:
 *   'ndefWritten'                   – NDEF message written
 *   'keyChanged',   keyNum (0–4)    – individual key changed
 *   'allKeysChanged'                – all five keys changed
 *   'uidRead',      uid (string)    – authenticated UID read from card
 *   'ndefRead',     message (string)– NDEF read back for verification
 *   'testComplete', { pTest, cTest }– P/C validation results
 *
 * @returns {Promise<{uid: string, ndefMessage: string, httpsLNURL: string, pTest: string|null, cTest: string|null}>}
 */
export async function provisionCard({
  config,
  ntag,
  ndef,
  onProgress = () => {},
}) {
  const {k0, k1, k2, k3, k4, lnurlw_base, privateUID} = config;

  // ── 1. Write NDEF ────────────────────────────────────────────────
  const ndefUrl = buildNdefUrl(lnurlw_base);
  const message = [ndef.uriRecord(ndefUrl)];
  const bytes = ndef.encodeMessage(message);

  await ntag.setNdefMessage(bytes);
  onProgress('ndefWritten');

  // ── 2. Authenticate with default key ─────────────────────────────
  await ntag.AuthEv2First('00', DEFAULT_KEY);

  // ── 3. Optionally enable private / random UID ────────────────────
  if (privateUID) {
    await ntag.setPrivateUid();
  }

  // ── 4. Set SDM file settings ─────────────────────────────────────
  const piccOffset = ndefUrl.indexOf('p=') + 9;
  const macOffset = ndefUrl.indexOf('c=') + 9;
  await ntag.setBoltCardFileSettings(piccOffset, macOffset);

  // ── 5. Read authenticated UID ────────────────────────────────────
  const uid = await ntag.getCardUid();
  onProgress('uidRead', uid);

  // ── 6. Change keys (1-4 then 0) ──────────────────────────────────
  await ntag.changeKey('01', DEFAULT_KEY, k1, '01');
  onProgress('keyChanged', 1);
  await ntag.changeKey('02', DEFAULT_KEY, k2, '01');
  onProgress('keyChanged', 2);
  await ntag.changeKey('03', DEFAULT_KEY, k3, '01');
  onProgress('keyChanged', 3);
  await ntag.changeKey('04', DEFAULT_KEY, k4, '01');
  onProgress('keyChanged', 4);
  await ntag.changeKey('00', DEFAULT_KEY, k0, '01');
  onProgress('keyChanged', 0);
  onProgress('allKeysChanged');

  // ── 7. Read NDEF back for verification ───────────────────────────
  const ndefData = await ntag.readData('060000');
  // Remove trailing zeros (known NDEF-read artefact)
  while (ndefData.length > 0 && ndefData[ndefData.length - 1] === 0) {
    ndefData.pop();
  }
  const readNdefMessage = ndef.uri.decodePayload(ndefData);
  onProgress('ndefRead', readNdefMessage);

  // ── 8. Build HTTPS URL for bolt-service test ─────────────────────
  const httpsLNURL = String(
    readNdefMessage.replace('lnurlw://', 'https://'),
  ).trim();

  // ── 9. Authenticate with new K0 and validate P / C ───────────────
  await ntag.AuthEv2First('00', k0);

  const params = {};
  readNdefMessage.replace(
    /[?&]+([^=&]+)=([^&]*)/gi,
    function (m, key, value) {
      params[key] = value;
      return value;
    },
  );

  let pTest = null;
  let cTest = null;

  if ('p' in params && 'c' in params) {
    const pVal = params['p'];
    const cVal = params['c'].slice(0, 16);
    const testResult = await ntag.testPAndC(pVal, cVal, uid, k1, k2);
    pTest = testResult.pTest ? 'ok' : 'decrypt with key failed';
    cTest = testResult.cTest ? 'ok' : 'decrypt with key failed';
  } else {
    if (!('p' in params)) {
      pTest = 'no p value to test';
    }
    if (!('c' in params)) {
      cTest = 'no c value to test';
    }
  }

  onProgress('testComplete', {pTest, cTest});

  return {uid, ndefMessage: readNdefMessage, httpsLNURL, pTest, cTest};
}
