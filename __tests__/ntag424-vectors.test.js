import fs from 'fs';
import path from 'path';
import CmacModule from '../src/utils/Cmac';
import sunVerify from '../src/utils/sunVerify';

const VECTORS_PATH = path.join(
  __dirname,
  'conformance/ntag424-vectors/vectors.json',
);
const VECTORS_SHA256 =
  '522cab963c3f7db1ab9249c0d4e207b43abc0b4061323fd5c55755959a4ff65f';

const CryptoJS = CmacModule;
const vectorsDoc = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));
const vectors = vectorsDoc.vectors;
const str = (src, key) => src[key];
const byOp = op => vectors.filter(v => v.input.op === op);

// derive_keys is the one inexpressible category: K0–K4 arrive from the
// issuing service (SetupBoltcard), the app never derives keys. Skipped
// aloud per the line canon — a silent partial pass is a failure.
const SKIP_OPS = new Set(['derive_keys']);
const consumed = vectors.filter(v => !SKIP_OPS.has(v.input.op));

describe('ntag424-vectors cross-language conformance suite', () => {
  it('vendored vectors.json is reference-locked (sha256)', () => {
    const raw = fs.readFileSync(VECTORS_PATH, 'utf8');
    expect(CryptoJS.SHA256(raw).toString()).toBe(VECTORS_SHA256);
  });

  it('suite size matches the vendored generation', () => {
    expect(vectors.length).toBe(46);
  });

  it('coverage accounting: 20 expressible vectors consumed, 26 derive_keys skipped aloud', () => {
    expect(consumed.length).toBe(20);
    expect(byOp('aes_cmac').length).toBe(5);
    expect(byOp('sv2_build').length).toBe(2);
    expect(byOp('picc_decrypt').length).toBe(1);
    expect(byOp('sun_mac').length).toBe(1);
    expect(byOp('sdm_full').length).toBe(11);
    expect(byOp('derive_keys').length).toBe(26);
  });

  for (const v of byOp('aes_cmac')) {
    it(`${v.id} (aes_cmac)`, () => {
      const mac = CryptoJS.CMAC(
        CryptoJS.enc.Hex.parse(str(v.input, 'key')),
        CryptoJS.enc.Hex.parse(str(v.input, 'message')),
      );
      expect(mac.toString()).toBe(str(v.expected, 'cmac'));
    });
  }

  for (const v of byOp('sv2_build')) {
    it(`${v.id} (sv2_build)`, () => {
      expect(
        sunVerify.buildSv2(str(v.input, 'uid'), str(v.input, 'counter_bytes')),
      ).toBe(str(v.expected, 'sv2'));
    });
  }

  for (const v of byOp('picc_decrypt')) {
    it(`${v.id} (picc_decrypt)`, () => {
      const decrypted = sunVerify.decryptPicc(
        str(v.input, 'picc_enc_data'),
        str(v.input, 'key'),
      );
      expect(decrypted).toBe(str(v.expected, 'decrypted'));
      expect(decrypted.slice(2, 16)).toBe(str(v.expected, 'uid'));
      expect(decrypted.slice(16, 22)).toBe(str(v.expected, 'counter_bytes'));
    });
  }

  for (const v of byOp('sun_mac')) {
    it(`${v.id} (sun_mac)`, () => {
      const sv2 = sunVerify.buildSv2(
        str(v.input, 'uid'),
        str(v.input, 'counter_bytes'),
      );
      const {derivedMacKey, truncatedMac} = sunVerify.sunMacChain(
        str(v.input, 'key'),
        sv2,
      );
      expect(truncatedMac).toBe(str(v.expected, 'cmac_truncated'));
      expect(derivedMacKey.length).toBe(32);
    });
  }

  for (const v of byOp('sdm_full')) {
    const uid = v.expected.uid
      ? str(v.expected, 'uid')
      : str(v.expected, 'decrypted_p').slice(2, 16);
    it(`${v.id} (sdm_full${v.negative ? ', negative' : ''})`, () => {
      const res = sunVerify.verifySun(
        str(v.input, 'p'),
        str(v.input, 'c'),
        uid,
        str(v.input, 'k1'),
        str(v.input, 'k2'),
      );
      if (v.negative) {
        expect(res.pTest && res.cTest).toBe(false);
        return;
      }
      expect(res.pTest).toBe(true);
      expect(res.cTest).toBe(true);
      expect(res.decryptedPiccData).toBe(str(v.expected, 'decrypted_p'));
      expect(res.sv2).toBe(str(v.expected, 'sv2'));
      expect(res.derivedMacKey).toBe(str(v.expected, 'derived_mac_key'));
      expect(res.fullCmac).toBe(str(v.expected, 'full_cmac'));
    });
  }
});
