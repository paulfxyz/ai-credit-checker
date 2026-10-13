"use strict";
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const exec = promisify(execFile);
const REPO = "paulfxyz/ai-credit-checker";
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const MAX_BYTES = 400 * 1024 * 1024;
function versionParts(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}
function newer(next, current) {
  const a = versionParts(next),
    b = versionParts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function releaseInfo(release, current) {
  if (
    release?.draft ||
    release?.prerelease ||
    !newer(release?.tag_name, current)
  )
    return null;
  const version = versionParts(release.tag_name).join(".");
  const filename = `AI-Credit-Checker-${version}-macOS-arm64.zip`;
  const asset = release.assets?.find(
    (item) => item.name === filename && item.state === "uploaded",
  );
  const expectedURL = `https://github.com/${REPO}/releases/download/v${version}/${filename}`;
  if (
    !asset ||
    asset.browser_download_url !== expectedURL ||
    !Number.isSafeInteger(asset.size) ||
    asset.size <= 0 ||
    asset.size > MAX_BYTES ||
    !/^sha256:[a-f0-9]{64}$/.test(asset.digest || "")
  ) {
    throw new Error(
      "Release has no supported ZIP with a GitHub SHA-256 digest. Open GitHub Releases instead.",
    );
  }
  return {
    version,
    filename,
    url: expectedURL,
    sha256: asset.digest.slice(7),
    size: asset.size,
  };
}
function request(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      ![
        "api.github.com",
        "github.com",
        "release-assets.githubusercontent.com",
        "objects.githubusercontent.com",
      ].includes(u.hostname)
    ) {
      reject(new Error("Refusing an untrusted update URL."));
      return;
    }
    const req = https.get(
      u,
      {
        headers: {
          "User-Agent": "AI-Credit-Checker-Updater",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          if (redirects >= 5 || !res.headers.location)
            return reject(new Error("Too many update redirects."));
          request(new URL(res.headers.location, u).href, redirects + 1).then(
            resolve,
            reject,
          );
        } else if (res.statusCode !== 200) {
          res.resume();
          reject(
            new Error(
              `GitHub update request failed (${res.statusCode}). Try later.`,
            ),
          );
        } else resolve(res);
      },
    );
    req.setTimeout(30000, () =>
      req.destroy(new Error("GitHub update request timed out.")),
    );
    req.on("error", reject);
  });
}
async function latest(current) {
  const res = await request(API);
  let text = "";
  for await (const chunk of res) {
    text += chunk.toString("utf8");
    if (text.length > 2 * 1024 * 1024) {
      res.destroy();
      throw new Error("Release metadata is too large.");
    }
  }
  return releaseInfo(JSON.parse(text), current);
}
async function download(info, dir, progress) {
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  const partial = path.join(dir, info.filename + ".partial");
  const target = path.join(dir, info.filename);
  const hash = crypto.createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > info.size || bytes > MAX_BYTES)
        return callback(new Error("Update exceeds expected size."));
      hash.update(chunk);
      progress(Math.floor((bytes / info.size) * 100));
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      await request(info.url),
      meter,
      fs.createWriteStream(partial, { mode: 0o600 }),
    );
    if (bytes !== info.size || hash.digest("hex") !== info.sha256)
      throw new Error("Update checksum mismatch; installation stopped.");
    await fs.promises.rename(partial, target);
    return target;
  } catch (error) {
    await fs.promises.rm(partial, { force: true });
    throw error;
  }
}
async function prepare(archive, version, appPath) {
  const target = fs.realpathSync(appPath);
  if (
    !target.endsWith(".app") ||
    target.includes("/AppTranslocation/") ||
    path.basename(target) !== "AI Credit Checker.app"
  ) {
    throw new Error(
      "Move AI Credit Checker.app into Applications before updating.",
    );
  }
  const parent = path.dirname(target);
  await fs.promises.access(parent, fs.constants.W_OK);
  const dir = await fs.promises.mkdtemp(
    path.join(parent, ".ai-credit-checker-update-"),
  );
  try {
    await exec("/usr/bin/ditto", ["-x", "-k", archive, dir], {
      timeout: 120000,
    });
    const candidate = path.join(dir, "AI Credit Checker.app");
    if ((await fs.promises.lstat(candidate)).isSymbolicLink())
      throw new Error("Invalid update bundle.");
    await exec(
      "/usr/bin/codesign",
      ["--verify", "--deep", "--strict", candidate],
      { timeout: 60000 },
    );
    const plist = path.join(candidate, "Contents/Info.plist");
    const read = async (key) =>
      (
        await exec("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist])
      ).stdout.trim();
    if (
      (await read("CFBundleIdentifier")) !== "com.paulfleury.aicreditchecker" ||
      (await read("CFBundleShortVersionString")) !== version
    )
      throw new Error("Unexpected update identity or version.");
    await exec("/usr/bin/lipo", [
      "-verify_arch",
      "arm64",
      path.join(candidate, "Contents/MacOS/AI Credit Checker"),
    ]);
    const helper = path.join(dir, "install-update.sh");
    await fs.promises.copyFile(
      path.join(__dirname, "install-update.sh"),
      helper,
    );
    return { target, candidate, dir, helper };
  } catch (error) {
    await fs.promises.rm(dir, { recursive: true, force: true });
    throw error;
  }
}
function launchInstaller(prepared, logPath) {
  const fd = fs.openSync(logPath, "a", 0o600);
  try {
    const child = spawn(
      "/bin/bash",
      [
        prepared.helper,
        String(process.pid),
        prepared.target,
        prepared.candidate,
        prepared.dir,
      ],
      { detached: true, stdio: ["ignore", fd, fd] },
    );
    child.unref();
    return new Promise((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });
  } finally {
    fs.closeSync(fd);
  }
}
module.exports = {
  newer,
  releaseInfo,
  latest,
  download,
  prepare,
  launchInstaller,
};
