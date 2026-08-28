// Compatible implementation of the NHN KCP V2 Crypto.js sample supplied to moTF.
const crypto = require("crypto");

const ITERATIONS = 10000;
const KEY_BYTES = 32;
const BLOCK_BYTES = 16;

function deriveKey(value, salt) {
  return crypto.pbkdf2Sync(Buffer.from(String(value), "utf8"), salt, ITERATIONS, KEY_BYTES, "sha256");
}

function addPkcs7Padding(value) {
  const paddingLength = BLOCK_BYTES - (value.length % BLOCK_BYTES);
  return Buffer.concat([value, Buffer.alloc(paddingLength, paddingLength)]);
}

function removePkcs7Padding(value) {
  const paddingLength = value[value.length - 1];
  if (paddingLength < 1 || paddingLength > BLOCK_BYTES || paddingLength > value.length) {
    throw new Error("KCP 인증 결과의 암호화 패딩이 올바르지 않습니다.");
  }
  for (let index = value.length - paddingLength; index < value.length; index += 1) {
    if (value[index] !== paddingLength) throw new Error("KCP 인증 결과의 암호화 패딩이 올바르지 않습니다.");
  }
  return value.subarray(0, value.length - paddingLength);
}

function encryptJson(input, encryptionKey, siteCode) {
  const json = typeof input === "string" ? input : JSON.stringify(input);
  const salt = crypto.randomBytes(16);
  const key = deriveKey(encryptionKey, salt);
  const iv = deriveKey(siteCode, salt).subarray(0, BLOCK_BYTES);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([
    cipher.update(addPkcs7Padding(Buffer.from(json, "utf8"))),
    cipher.final(),
  ]);
  return { enc_data: encrypted.toString("base64"), rv: salt.toString("base64") };
}

function decryptJson(encData, rv, encryptionKey, siteCode) {
  const salt = Buffer.from(String(rv), "base64");
  const key = deriveKey(encryptionKey, salt);
  const iv = deriveKey(siteCode, salt).subarray(0, BLOCK_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(String(encData), "base64")),
    decipher.final(),
  ]);
  return JSON.parse(removePkcs7Padding(decrypted).toString("utf8"));
}

module.exports = { encryptJson, decryptJson };
