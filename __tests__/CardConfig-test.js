/**
 * Tests for src/utils/CardConfig.js
 *
 * Verifies that both upper-case (K0) and lower-case (k0) backend JSON
 * normalizes to the same shared config shape.
 *
 * Refs boltcard/bolt-nfc-android-app#52
 */

import {
  normalizeCardConfig,
  validateCardConfig,
  buildNdefUrl,
} from '../src/utils/CardConfig';

// ── Fixture data ───────────────────────────────────────────────────
const LOWERCASE_JSON = {
  k0: 'aaaa000000000000000000000000aaaa',
  k1: 'bbbb000000000000000000000000bbbb',
  k2: 'cccc000000000000000000000000cccc',
  k3: 'dddd000000000000000000000000dddd',
  k4: 'eeee000000000000000000000000eeee',
  lnurlw_base: 'lnurlw://example.com/callback',
  uid_privacy: 'Y',
  card_name: 'Test Card',
};

const UPPERCASE_JSON = {
  K0: 'aaaa000000000000000000000000aaaa',
  K1: 'bbbb000000000000000000000000bbbb',
  K2: 'cccc000000000000000000000000cccc',
  K3: 'dddd000000000000000000000000dddd',
  K4: 'eeee000000000000000000000000eeee',
  LNURLW: 'lnurlw://example.com/callback',
  uid_privacy: 'Y',
  card_name: 'Test Card',
};

// ── normalizeCardConfig ────────────────────────────────────────────

describe('normalizeCardConfig', () => {
  it('normalizes lower-case keys from backend JSON', () => {
    const config = normalizeCardConfig(LOWERCASE_JSON);
    expect(config.k0).toBe('aaaa000000000000000000000000aaaa');
    expect(config.k1).toBe('bbbb000000000000000000000000bbbb');
    expect(config.k2).toBe('cccc000000000000000000000000cccc');
    expect(config.k3).toBe('dddd000000000000000000000000dddd');
    expect(config.k4).toBe('eeee000000000000000000000000eeee');
    expect(config.lnurlw_base).toBe('lnurlw://example.com/callback');
    expect(config.cardName).toBe('Test Card');
  });

  it('normalizes upper-case keys from backend JSON', () => {
    const config = normalizeCardConfig(UPPERCASE_JSON);
    expect(config.k0).toBe('aaaa000000000000000000000000aaaa');
    expect(config.k1).toBe('bbbb000000000000000000000000bbbb');
    expect(config.k2).toBe('cccc000000000000000000000000cccc');
    expect(config.k3).toBe('dddd000000000000000000000000dddd');
    expect(config.k4).toBe('eeee000000000000000000000000eeee');
    expect(config.lnurlw_base).toBe('lnurlw://example.com/callback');
    expect(config.cardName).toBe('Test Card');
  });

  it('both input sources normalize to the same shared config shape', () => {
    const fromLower = normalizeCardConfig(LOWERCASE_JSON);
    const fromUpper = normalizeCardConfig(UPPERCASE_JSON);
    expect(fromLower).toEqual(fromUpper);
  });

  it('sets privateUID to true when uid_privacy is "Y"', () => {
    const config = normalizeCardConfig({...LOWERCASE_JSON, uid_privacy: 'Y'});
    expect(config.privateUID).toBe(true);
  });

  it('sets privateUID to false when uid_privacy is absent', () => {
    const json = {...LOWERCASE_JSON};
    delete json.uid_privacy;
    const config = normalizeCardConfig(json);
    expect(config.privateUID).toBe(false);
  });

  it('sets privateUID to false when uid_privacy is "N"', () => {
    const config = normalizeCardConfig({...LOWERCASE_JSON, uid_privacy: 'N'});
    expect(config.privateUID).toBe(false);
  });

  it('sets privateUID to false when uid_privacy is undefined', () => {
    const config = normalizeCardConfig({
      ...LOWERCASE_JSON,
      uid_privacy: undefined,
    });
    expect(config.privateUID).toBe(false);
  });

  it('returns null for missing keys', () => {
    const config = normalizeCardConfig({});
    expect(config.k0).toBeNull();
    expect(config.k1).toBeNull();
    expect(config.k2).toBeNull();
    expect(config.k3).toBeNull();
    expect(config.k4).toBeNull();
    expect(config.lnurlw_base).toBeNull();
    expect(config.cardName).toBeNull();
  });
});

// ── validateCardConfig ─────────────────────────────────────────────

describe('validateCardConfig', () => {
  it('returns true for a complete config', () => {
    const config = normalizeCardConfig(LOWERCASE_JSON);
    expect(validateCardConfig(config)).toBe(true);
  });

  it('returns false when a key is missing', () => {
    const json = {...LOWERCASE_JSON};
    delete json.k2;
    const config = normalizeCardConfig(json);
    expect(validateCardConfig(config)).toBe(false);
  });

  it('returns false when lnurlw_base is missing', () => {
    const json = {...LOWERCASE_JSON};
    delete json.lnurlw_base;
    const config = normalizeCardConfig(json);
    expect(validateCardConfig(config)).toBe(false);
  });
});

// ── buildNdefUrl ───────────────────────────────────────────────────

describe('buildNdefUrl', () => {
  it('uses ? separator when base URL has no query string', () => {
    const url = buildNdefUrl('lnurlw://example.com/callback');
    expect(url).toBe(
      'lnurlw://example.com/callback?p=00000000000000000000000000000000&c=0000000000000000',
    );
  });

  it('uses & separator when base URL already has a query string', () => {
    const url = buildNdefUrl('lnurlw://example.com/callback?tag=bolt');
    expect(url).toBe(
      'lnurlw://example.com/callback?tag=bolt&p=00000000000000000000000000000000&c=0000000000000000',
    );
  });
});
