import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { MAX_CHAT_AUDIO_BYTES, MAX_CHAT_AUDIO_SECONDS } from "@private-chat/contracts";

const run = promisify(execFile);
const inputOptions = ["-protocol_whitelist", "file,pipe", "-format_whitelist", "mov,matroska,webm,ogg,mp3,wav"];
type Probe = {
  format?: { duration?: string; format_name?: string };
  streams?: Array<{ codec_type?: string; codec_name?: string; sample_rate?: string; channels?: number }>;
};

/** Normalize browser recordings to AAC/M4A. No filenames or decoder output leave this function. */
export async function processChatAudio(input: Buffer): Promise<{ data: Buffer; durationSeconds: number }> {
  if (!input.length || input.length > MAX_CHAT_AUDIO_BYTES) throw new Error("INVALID_AUDIO");
  const isMp4 = input.length >= 12 && input.subarray(4, 8).toString("ascii") === "ftyp";
  const isWebm = input.length >= 4 && input.readUInt32BE(0) === 0x1a45dfa3;
  const isOgg = input.subarray(0, 4).toString("ascii") === "OggS";
  const isWav = input.subarray(0, 4).toString("ascii") === "RIFF" && input.subarray(8, 12).toString("ascii") === "WAVE";
  const isMp3 = input.subarray(0, 3).toString("ascii") === "ID3" ||
    (input.length >= 2 && input[0] === 0xff && (input[1]! & 0xe0) === 0xe0);
  if (!isMp4 && !isWebm && !isOgg && !isWav && !isMp3) throw new Error("INVALID_AUDIO");
  const directory = await fs.mkdtemp(join(tmpdir(), "private-chat-audio-"));
  const source = join(directory, "input");
  const output = join(directory, "audio.m4a");
  const probe = async (file: string): Promise<Probe> => {
    const { stdout } = await run("ffprobe", ["-v", "error", ...inputOptions,
      "-show_entries", "format=duration,format_name:stream=codec_type,codec_name,sample_rate,channels",
      "-of", "json", file], { timeout: 15000, killSignal: "SIGKILL", maxBuffer: 128 * 1024 });
    return JSON.parse(stdout) as Probe;
  };
  try {
    await fs.writeFile(source, input, { mode: 0o600 });
    const metadata = await probe(source);
    const stream = metadata.streams?.[0];
    const duration = Number(metadata.format?.duration);
    if (metadata.streams?.length !== 1 || stream?.codec_type !== "audio" ||
      !stream.codec_name || !/^(aac|opus|vorbis|mp3|pcm_[a-z0-9]+)$/.test(stream.codec_name) ||
      !stream.channels || stream.channels > 8 || !Number.isFinite(Number(stream.sample_rate)) ||
      Number(stream.sample_rate) < 8000 || Number(stream.sample_rate) > 192000 ||
      !metadata.format?.format_name?.split(",").some(name => ["mov", "mp4", "matroska", "webm", "ogg", "mp3", "wav"].includes(name)) ||
      // Container duration can include Opus preroll. Enforce the exact limit
      // after decoding; reject clearly oversized headers before conversion.
      (Number.isFinite(duration) && (duration <= 0 || duration > MAX_CHAT_AUDIO_SECONDS + 1))) {
      throw new Error("INVALID_AUDIO");
    }
    // Live MediaRecorder WebM/Opus often has no duration header. Decode one
    // extra second then inspect actual normalized duration; never silently
    // truncate a recording longer than the contract's limit.
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-nostdin", "-y",
      "-threads", "2", ...inputOptions, "-i", source,
      "-map", "0:a:0", "-vn", "-sn", "-dn", "-map_metadata", "-1", "-map_chapters", "-1",
      "-c:a", "aac", "-threads", "2", "-b:a", "96k", "-ac", "1", "-ar", "48000",
      "-t", String(MAX_CHAT_AUDIO_SECONDS + 1), "-fs", String(MAX_CHAT_AUDIO_BYTES),
      "-movflags", "+faststart", output],
    { timeout: 60000, killSignal: "SIGKILL", maxBuffer: 256 * 1024 });
    const stat = await fs.stat(output);
    const normalized = await probe(output);
    const durationSeconds = Number(normalized.format?.duration);
    if (!stat.size || stat.size >= MAX_CHAT_AUDIO_BYTES || !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0 || durationSeconds > MAX_CHAT_AUDIO_SECONDS ||
      normalized.streams?.length !== 1 || normalized.streams[0]?.codec_name !== "aac") {
      throw new Error("INVALID_AUDIO");
    }
    return { data: await fs.readFile(output), durationSeconds };
  } catch {
    throw new Error("INVALID_AUDIO");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
