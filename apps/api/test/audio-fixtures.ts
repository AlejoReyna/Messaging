import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Real encoder fixtures, including WebM without a duration header (MediaRecorder). */
export function makeAudioFixture(format: "m4a" | "webm" | "ogg" | "mp3" | "wav", seconds = 0.4, frequency = 440): Buffer {
  const directory = mkdtempSync(join(tmpdir(), "pc-audio-fixture-"));
  try {
    const file = join(directory, `sample.${format}`);
    const codec = { m4a: "aac", webm: "libopus", ogg: "libopus", mp3: "libmp3lame", wav: "pcm_s16le" }[format];
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=48000`, "-t", String(seconds),
      "-c:a", codec, "-metadata", "title=PRIVATE_AUDIO_TITLE", ...(format === "webm" ? ["-live", "1"] : []), file],
    { timeout: 15000, stdio: "pipe" });
    return readFileSync(file);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export function makeVideoFixture(): Buffer {
  const directory = mkdtempSync(join(tmpdir(), "pc-audio-video-fixture-"));
  try {
    const file = join(directory, "video.mp4");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-f", "lavfi", "-i", "color=size=16x16:rate=10", "-f", "lavfi", "-i", "sine=frequency=440",
      "-t", "0.4", "-c:v", "libx264", "-c:a", "aac", file], { timeout: 15000, stdio: "pipe" });
    return readFileSync(file);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
