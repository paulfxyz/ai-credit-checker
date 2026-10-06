"use strict";
const sharp = require("sharp");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
(async () => {
  const appSVG = path.join(root, "assets/app.svg");
  await sharp(appSVG).png().toFile(path.join(root, "assets/app.png"));
  for (const size of [18, 36]) {
    await sharp(path.join(root, "assets/menu.svg"))
      .resize(size, size)
      .png()
      .toFile(
        path.join(root, `assets/menuTemplate${size === 36 ? "@2x" : ""}.png`),
      );
  }
  // ICNS container with standard PNG-backed Retina icon elements.
  const entries = [];
  for (const [type, size] of [
    ["icp4", 16],
    ["icp5", 32],
    ["icp6", 64],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
  ]) {
    const png = await sharp(appSVG).resize(size, size).png().toBuffer();
    const header = Buffer.alloc(8);
    header.write(type);
    header.writeUInt32BE(png.length + 8, 4);
    entries.push(header, png);
  }
  const header = Buffer.alloc(8);
  header.write("icns");
  header.writeUInt32BE(8 + entries.reduce((n, b) => n + b.length, 0), 4);
  fs.writeFileSync(
    path.join(root, "assets/app.icns"),
    Buffer.concat([header, ...entries]),
  );
})();
