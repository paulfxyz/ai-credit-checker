"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");
const https = require("node:https");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { newer, releaseInfo, download } = require("../src/updater.cjs");
const url =
  "https://github.com/paulfxyz/ai-credit-checker/releases/download/v2.1.2/AI-Credit-Checker-2.1.2-macOS-arm64.zip";
const fixture = () => ({
  tag_name: "v2.1.2",
  draft: false,
  prerelease: false,
  assets: [
    {
      name: "AI-Credit-Checker-2.1.2-macOS-arm64.zip",
      state: "uploaded",
      browser_download_url: url,
      size: 120,
      digest: "sha256:" + "a".repeat(64),
    },
  ],
});
test("updater accepts only newer stable releases from the fixed repository with a digest", () => {
  assert.equal(newer("2.1.2", "2.1.1"), true);
  assert.equal(newer("2.1.0", "2.1.1"), false);
  assert.equal(newer("2.1.1", "2.1.1"), false);
  assert.equal(newer("2.1.2-beta", "2.1.1"), false);
  assert.equal(releaseInfo(fixture(), "2.1.1").version, "2.1.2");
  assert.equal(releaseInfo(fixture(), "2.1.2"), null);
  assert.equal(releaseInfo({ ...fixture(), prerelease: true }, "2.1.1"), null);
  for (const change of [
    { digest: null },
    { browser_download_url: "https://evil.example/a.zip" },
    { size: 999999999 },
    { name: "../a.zip" },
  ]) {
    const item = fixture();
    Object.assign(item.assets[0], change);
    assert.throws(() => releaseInfo(item, "2.1.1"), /supported ZIP/);
  }
});
test("updater download verifies size/hash and discards corrupt partial files", async (t) => {
  const bytes = Buffer.from("synthetic update fixture");
  t.mock.method(https, "get", (_url, _options, callback) => {
    const req = new EventEmitter();
    req.setTimeout = () => req;
    queueMicrotask(() => {
      const res = Readable.from([bytes]);
      res.statusCode = 200;
      callback(res);
    });
    return req;
  });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "credit-update-test-"));
  const info = {
    url,
    filename: "fixture.zip",
    size: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
  try {
    const file = await download(info, dir, () => {});
    assert.deepEqual(await fs.readFile(file), bytes);
    await assert.rejects(
      download(
        { ...info, filename: "bad.zip", sha256: "0".repeat(64) },
        dir,
        () => {},
      ),
      /checksum/,
    );
    await assert.rejects(fs.stat(path.join(dir, "bad.zip.partial")), /ENOENT/);
    await assert.rejects(
      download({ ...info, filename: "short.zip", size: 1 }, dir, () => {}),
      /expected size/,
    );
    await assert.rejects(
      download({ ...info, url: "http://github.com/file" }, dir, () => {}),
      /untrusted/,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
