var CryptoJS = require('./Cmac');
var AES = require('crypto-js/aes');

var hexToBytes = (hex) => {
  let bytes = [];
  for (let c = 0; c < hex.length; c += 2) bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
};

var bytesToHex = (bytes) => {
  let hex = [];
  for (let i = 0; i < bytes.length; i++) {
    let current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex.push((current >>> 4).toString(16));
    hex.push((current & 0xf).toString(16));
  }
  return hex.join('');
};

function decryptPicc(pVal, piccKey) {
  var decPiccData = AES.decrypt(
    {ciphertext: CryptoJS.enc.Hex.parse(pVal)},
    CryptoJS.enc.Hex.parse(piccKey),
    {
      padding: CryptoJS.pad.NoPadding,
      mode: CryptoJS.mode.CBC,
      iv: CryptoJS.enc.Hex.parse('00000000000000000000000000000000'),
      keySize: 128 / 8,
    },
  );
  return CryptoJS.enc.Hex.stringify(decPiccData).toLowerCase();
}

function buildSv2(uid, sdmReadCtr) {
  return '3cc300010080' + uid + sdmReadCtr;
}

function sunMacChain(macKey, sv2) {
  var sesSdmFileReadMAC = CryptoJS.CMAC(
    CryptoJS.enc.Hex.parse(macKey),
    CryptoJS.enc.Hex.parse(sv2),
  );
  var sesSdmFileReadMACHex = sesSdmFileReadMAC.toString();
  var sdmMac = CryptoJS.CMAC(CryptoJS.enc.Hex.parse(sesSdmFileReadMACHex));
  var sdmMacHex = sdmMac.toString();

  var truncatedMacBytes = hexToBytes(sdmMacHex).filter(function (
    element,
    index,
  ) {
    return (index + 1) % 2 === 0;
  });
  return {
    derivedMacKey: sesSdmFileReadMACHex,
    fullCmac: sdmMacHex,
    truncatedMac: bytesToHex(truncatedMacBytes),
  };
}

function verifySun(pVal, cVal, uid, piccKey, macKey) {
  var decryptedPiccData = decryptPicc(pVal, piccKey);
  var pTest = decryptedPiccData.startsWith('c7' + uid.toLowerCase());

  var sdmReadCtr = decryptedPiccData.slice(16, 22);
  var sv2 = buildSv2(uid, sdmReadCtr);
  var chain = sunMacChain(macKey, sv2);
  var cTest = chain.truncatedMac === cVal.toLowerCase();

  return {
    pTest: pTest,
    cTest: cTest,
    decryptedPiccData: decryptedPiccData,
    sv2: sv2,
    derivedMacKey: chain.derivedMacKey,
    fullCmac: chain.fullCmac,
    truncatedMac: chain.truncatedMac,
  };
}

module.exports = {decryptPicc, buildSv2, sunMacChain, verifySun};
