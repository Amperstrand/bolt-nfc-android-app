/**
 * Tests for src/utils/provisionCard.js
 *
 * Uses dependency injection (mock ntag / ndef) so the provisioning
 * logic can be validated without NFC hardware.
 *
 * Refs boltcard/bolt-nfc-android-app#52
 */

import {provisionCard, DEFAULT_KEY} from '../src/utils/provisionCard';

// ── Helpers ────────────────────────────────────────────────────────

const TEST_CONFIG = {
  k0: 'aaaa000000000000000000000000aaaa',
  k1: 'bbbb000000000000000000000000bbbb',
  k2: 'cccc000000000000000000000000cccc',
  k3: 'dddd000000000000000000000000dddd',
  k4: 'eeee000000000000000000000000eeee',
  lnurlw_base: 'lnurlw://example.com/callback',
  privateUID: false,
};

/**
 * Creates a fresh set of mock NFC operations.
 * Each mock records calls in `callOrder` so we can assert sequencing.
 */
function createMocks() {
  const callOrder = [];

  const ntag = {
    setNdefMessage: jest.fn(async () => {
      callOrder.push('setNdefMessage');
    }),
    AuthEv2First: jest.fn(async (keyNo, key) => {
      callOrder.push(`AuthEv2First(${keyNo})`);
    }),
    setPrivateUid: jest.fn(async () => {
      callOrder.push('setPrivateUid');
    }),
    setBoltCardFileSettings: jest.fn(async () => {
      callOrder.push('setBoltCardFileSettings');
    }),
    getCardUid: jest.fn(async () => {
      callOrder.push('getCardUid');
      return '04AABBCCDDEE';
    }),
    changeKey: jest.fn(async (keyNo) => {
      callOrder.push(`changeKey(${keyNo})`);
    }),
    readData: jest.fn(async () => {
      callOrder.push('readData');
      // Return fake NDEF bytes (content doesn't matter; decodePayload is mocked)
      return [0x04, 0x01, 0x02];
    }),
    testPAndC: jest.fn(async () => {
      callOrder.push('testPAndC');
      return {pTest: true, cTest: true};
    }),
  };

  const ndef = {
    uriRecord: jest.fn(url => ({type: 'uri', payload: url})),
    encodeMessage: jest.fn(() => [0x00]),
    uri: {
      decodePayload: jest.fn(
        () =>
          'lnurlw://example.com/callback?p=AABB000000000000AABB000000000000&c=AABB000000000000',
      ),
    },
  };

  return {ntag, ndef, callOrder};
}

// ── uid_privacy / setPrivateUid ────────────────────────────────────

describe('uid_privacy handling', () => {
  it('calls setPrivateUid() when privateUID is true', async () => {
    const {ntag, ndef} = createMocks();
    const config = {...TEST_CONFIG, privateUID: true};

    await provisionCard({config, ntag, ndef});

    expect(ntag.setPrivateUid).toHaveBeenCalledTimes(1);
  });

  it('does NOT call setPrivateUid() when privateUID is false', async () => {
    const {ntag, ndef} = createMocks();
    const config = {...TEST_CONFIG, privateUID: false};

    await provisionCard({config, ntag, ndef});

    expect(ntag.setPrivateUid).not.toHaveBeenCalled();
  });

  it('does NOT call setPrivateUid() when privateUID is undefined', async () => {
    const {ntag, ndef} = createMocks();
    const config = {...TEST_CONFIG};
    delete config.privateUID;

    await provisionCard({config, ntag, ndef});

    expect(ntag.setPrivateUid).not.toHaveBeenCalled();
  });
});

// ── Provisioning call order ────────────────────────────────────────

describe('provisioning call order', () => {
  it('executes NFC operations in the correct sequence (without privateUID)', async () => {
    const {ntag, ndef, callOrder} = createMocks();

    await provisionCard({config: TEST_CONFIG, ntag, ndef});

    expect(callOrder).toEqual([
      'setNdefMessage',
      'AuthEv2First(00)',       // default key
      'setBoltCardFileSettings',
      'getCardUid',
      'changeKey(01)',
      'changeKey(02)',
      'changeKey(03)',
      'changeKey(04)',
      'changeKey(00)',
      'readData',
      'AuthEv2First(00)',       // new K0
      'testPAndC',
    ]);
  });

  it('executes NFC operations in the correct sequence (with privateUID)', async () => {
    const {ntag, ndef, callOrder} = createMocks();
    const config = {...TEST_CONFIG, privateUID: true};

    await provisionCard({config, ntag, ndef});

    expect(callOrder).toEqual([
      'setNdefMessage',
      'AuthEv2First(00)',       // default key
      'setPrivateUid',          // <-- only present when privateUID
      'setBoltCardFileSettings',
      'getCardUid',
      'changeKey(01)',
      'changeKey(02)',
      'changeKey(03)',
      'changeKey(04)',
      'changeKey(00)',
      'readData',
      'AuthEv2First(00)',       // new K0
      'testPAndC',
    ]);
  });

  it('authenticates with the DEFAULT_KEY first, then with new K0', async () => {
    const {ntag, ndef} = createMocks();

    await provisionCard({config: TEST_CONFIG, ntag, ndef});

    expect(ntag.AuthEv2First).toHaveBeenCalledTimes(2);
    expect(ntag.AuthEv2First.mock.calls[0]).toEqual(['00', DEFAULT_KEY]);
    expect(ntag.AuthEv2First.mock.calls[1]).toEqual([
      '00',
      TEST_CONFIG.k0,
    ]);
  });

  it('changes keys in the correct order (1, 2, 3, 4, 0)', async () => {
    const {ntag, ndef} = createMocks();

    await provisionCard({config: TEST_CONFIG, ntag, ndef});

    expect(ntag.changeKey).toHaveBeenCalledTimes(5);
    const keyOrder = ntag.changeKey.mock.calls.map(c => c[0]);
    expect(keyOrder).toEqual(['01', '02', '03', '04', '00']);
  });
});

// ── Progress callbacks ─────────────────────────────────────────────

describe('onProgress callbacks', () => {
  it('emits progress events in order', async () => {
    const {ntag, ndef} = createMocks();
    const events = [];
    const onProgress = (event, data) => events.push({event, data});

    await provisionCard({config: TEST_CONFIG, ntag, ndef, onProgress});

    const eventNames = events.map(e => e.event);
    expect(eventNames).toEqual([
      'ndefWritten',
      'uidRead',
      'keyChanged',
      'keyChanged',
      'keyChanged',
      'keyChanged',
      'keyChanged',
      'allKeysChanged',
      'ndefRead',
      'testComplete',
    ]);
  });

  it('reports key changes with correct key numbers', async () => {
    const {ntag, ndef} = createMocks();
    const keyChanges = [];
    const onProgress = (event, data) => {
      if (event === 'keyChanged') keyChanges.push(data);
    };

    await provisionCard({config: TEST_CONFIG, ntag, ndef, onProgress});

    expect(keyChanges).toEqual([1, 2, 3, 4, 0]);
  });
});

// ── Return value ───────────────────────────────────────────────────

describe('return value', () => {
  it('returns uid, ndefMessage, httpsLNURL, pTest, cTest', async () => {
    const {ntag, ndef} = createMocks();

    const result = await provisionCard({config: TEST_CONFIG, ntag, ndef});

    expect(result.uid).toBe('04AABBCCDDEE');
    expect(result.ndefMessage).toContain('lnurlw://');
    expect(result.httpsLNURL).toContain('https://');
    expect(result.pTest).toBe('ok');
    expect(result.cTest).toBe('ok');
  });

  it('reports failed p/c tests', async () => {
    const {ntag, ndef} = createMocks();
    ntag.testPAndC.mockResolvedValue({pTest: false, cTest: false});

    const result = await provisionCard({config: TEST_CONFIG, ntag, ndef});

    expect(result.pTest).toBe('decrypt with key failed');
    expect(result.cTest).toBe('decrypt with key failed');
  });
});
