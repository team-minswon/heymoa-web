import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile, stat, mkdir } from "node:fs/promises";
import path from "node:path";
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
export const ffmpeg = process.env.FFMPEG || "/opt/homebrew/bin/ffmpeg";
const ffprobe = path.join(path.dirname(ffmpeg), "ffprobe");
export const MAX_BYTES = 600_000;

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-8000);
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command}: ${code}\n${stderr}`))
    );
  });
}

export async function probe(file) {
  return JSON.parse(
    await run(ffprobe, [
      "-v",
      "error",
      "-show_streams",
      "-show_format",
      "-of",
      "json",
      file,
    ])
  );
}

export async function encode(
  raw,
  target,
  start,
  duration,
  qa,
  out = { width: 960, height: 540 }
) {
  assert.ok(
    start >= 0 && duration >= 5 && duration <= 18,
    `녹화 길이를 확인해 주세요: ${duration.toFixed(2)}초`
  );
  await mkdir(qa, { recursive: true });
  const sizes = {};
  for (const ext of ["webm", "mp4"]) {
    const file = `${target}.${ext}`;
    let fitted = false;
    for (const crf of [30, 33, 36, 39, 42]) {
      await run(ffmpeg, [
        "-y",
        "-v",
        "error",
        "-ss",
        String(start),
        "-i",
        raw,
        "-t",
        String(duration),
        "-an",
        "-vf",
        `scale=${out.width}:${out.height}:flags=lanczos,fps=30`,
        "-c:v",
        ext === "webm" ? "libvpx-vp9" : "libx264",
        ...(ext === "webm"
          ? ["-b:v", "0", "-deadline", "good", "-cpu-used", "2"]
          : ["-preset", "slow", "-movflags", "+faststart"]),
        "-crf",
        String(crf),
        "-pix_fmt",
        "yuv420p",
        file,
      ]);
      sizes[ext] = (await stat(file)).size;
      if (sizes[ext] <= MAX_BYTES) {
        fitted = true;
        break;
      }
    }
    assert.ok(fitted, `${file}: 600KB를 초과했습니다.`);
    const metadata = await probe(file);
    const stream = metadata.streams.find((s) => s.codec_type === "video");
    assert.equal(stream.codec_name, ext === "webm" ? "vp9" : "h264");
    assert.equal(stream.pix_fmt, "yuv420p");
    assert.equal(stream.width, out.width);
    assert.equal(stream.height, out.height);
    assert.ok(!metadata.streams.some((s) => s.codec_type === "audio"));
    assert.ok(Math.abs(Number(metadata.format.duration) - duration) < 0.6);
    if (ext === "mp4") {
      const bytes = await readFile(file);
      assert.ok(
        bytes.indexOf(Buffer.from("moov")) < bytes.indexOf(Buffer.from("mdat")),
        "faststart가 필요합니다."
      );
    }
  }
  const poster = `${target}.webp`;
  const tiles = [];
  for (const [index, at] of [0, 0.8, duration / 2, duration - 0.3].entries()) {
    const png = path.join(qa, `${index}.png`);
    await run(ffmpeg, [
      "-y",
      "-v",
      "error",
      "-ss",
      String(at),
      "-i",
      `${target}.mp4`,
      "-frames:v",
      "1",
      png,
    ]);
    if (index === 0) await sharp(png).webp({ quality: 88 }).toFile(poster);
    tiles.push({
      input: await sharp(png).resize(640, 360).toBuffer(),
      left: (index % 2) * 640,
      top: Math.floor(index / 2) * 360,
    });
  }
  await sharp({
    create: { width: 1280, height: 720, channels: 3, background: "white" },
  })
    .composite(tiles)
    .png()
    .toFile(path.join(qa, "contact.png"));
  sizes.poster = (await stat(poster)).size;
  return {
    width: out.width,
    height: out.height,
    duration: Number(duration.toFixed(2)),
    ...sizes,
  };
}
