"use strict";
// Native release-runner integration: harmless signed fixture app, never real accounts.
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const assert = require("node:assert/strict");
const { prepare } = require("../src/updater.cjs");
(async () => {
  assert.equal(process.platform, "darwin");
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "credit-native-update-"),
  );
  const target = path.join(root, "AI Credit Checker.app");
  try {
    await fs.mkdir(path.join(target, "Contents/MacOS"), { recursive: true });
    const c = path.join(root, "fixture.c");
    const marker = path.join(root, "launched");
    await fs.writeFile(
      c,
      `#include <stdio.h>\nint main(void) { FILE *f = fopen(${JSON.stringify(marker)}, "w"); if (!f) return 1; fputs("ok", f); fclose(f); return 0; }\n`,
    );
    execFileSync("/usr/bin/clang", [
      "-arch",
      "arm64",
      c,
      "-o",
      path.join(target, "Contents/MacOS/AI Credit Checker"),
    ]);
    await fs.writeFile(
      path.join(target, "Contents/Info.plist"),
      `<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.paulfleury.aicreditchecker</string><key>CFBundleName</key><string>AI Credit Checker</string><key>CFBundleExecutable</key><string>AI Credit Checker</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>2.1.2</string><key>CFBundleVersion</key><string>2.1.2</string></dict></plist>`,
    );
    execFileSync("/usr/bin/codesign", [
      "--force",
      "--deep",
      "--sign",
      "-",
      target,
    ]);
    const zip = path.join(root, "fixture.zip");
    execFileSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", target, zip]);
    await assert.rejects(prepare(zip, "9.9.9", target), /identity or version/);
    const prepared = await prepare(zip, "2.1.2", target);
    execFileSync(
      "/bin/bash",
      [
        prepared.helper,
        "999999",
        prepared.target,
        prepared.candidate,
        prepared.dir,
      ],
      { timeout: 90000 },
    );
    await fs.stat(path.join(prepared.dir, "Previous AI Credit Checker.app"));
    for (let i = 0; i < 40; i++) {
      try {
        await fs.stat(marker);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    assert.equal(await fs.readFile(marker, "utf8"), "ok");
    execFileSync("/usr/bin/codesign", [
      "--verify",
      "--deep",
      "--strict",
      target,
    ]);
    console.log(
      "PASS macOS updater: version mismatch rejected, signed arm64 bundle staged, replaced, opened; previous app retained.",
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
