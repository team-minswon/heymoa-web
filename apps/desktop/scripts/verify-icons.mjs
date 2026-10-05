import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (name) => readFileSync(new URL(`../build/icons/${name}`, import.meta.url));
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = read("icon.png");
assert.ok(png.subarray(0, 8).equals(pngSignature));
assert.equal(png.readUInt32BE(16), 1024);
assert.equal(png.readUInt32BE(20), 1024);
assert.equal(png[25], 6, "RGBA PNG preserves alpha");
const macPng = read("icon-mac.png");
assert.ok(macPng.subarray(0, 8).equals(pngSignature));
assert.equal(macPng.readUInt32BE(16), 1024);
assert.equal(macPng.readUInt32BE(20), 1024);
assert.equal(macPng[25], 6, "Mac rounded corners preserve alpha");
const icns = read("icon.icns");
assert.equal(icns.toString("ascii", 0, 4), "icns");
assert.equal(icns.readUInt32BE(4), icns.length);
const types = new Set();
let position = 8;
while (position < icns.length) {
  const length = icns.readUInt32BE(position + 4);
  assert.ok(length >= 8 && position + length <= icns.length);
  types.add(icns.toString("ascii", position, position + 4));
  position += length;
}
assert.equal(position, icns.length);
for (const type of ["ic07", "ic08", "ic09", "ic10"]) assert.ok(types.has(type), `Missing ICNS ${type}`);
const ico = read("icon.ico");
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1);
const count = ico.readUInt16LE(4);
assert.equal(count, 7);
const sizes = new Set();
for (let i = 0; i < count; i++) {
  const entry = 6 + i * 16;
  const size = ico[entry] || 256;
  const length = ico.readUInt32LE(entry + 8);
  const offset = ico.readUInt32LE(entry + 12);
  assert.ok(offset >= 6 + count * 16 && offset + length <= ico.length);
  assert.ok(ico.subarray(offset, offset + 8).equals(pngSignature));
  assert.equal(ico.readUInt32BE(offset + 16), size);
  assert.equal(ico.readUInt32BE(offset + 20), size);
  assert.equal(ico[offset + 25], 6);
  sizes.add(size);
}
assert.deepEqual([...sizes], [16, 24, 32, 48, 64, 128, 256]);
console.log("Brand PNG alpha, ICNS container and seven PNG-backed ICO sizes verified");
