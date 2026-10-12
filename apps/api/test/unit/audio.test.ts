import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { MAX_CHAT_AUDIO_BYTES } from "@private-chat/contracts";
import { processChatAudio } from "../../src/audio.js";
import { parseVideoRange } from "../../src/video.js";
import { makeAudioFixture, makeVideoFixture } from "../audio-fixtures.js";

describe("notas de voz: conversión real FFmpeg/FFprobe", () => {
  for (const format of ["m4a", "webm", "ogg", "mp3", "wav"] as const) {
    it(`normaliza ${format} a M4A AAC sin metadatos privados`, async () => {
      const result = await processChatAudio(makeAudioFixture(format));
      assert.equal(result.data.subarray(4, 8).toString("ascii"), "ftyp");
      assert.ok(result.durationSeconds > 0.3 && result.durationSeconds < 0.6);
      assert.equal(result.data.includes(Buffer.from("PRIVATE_AUDIO_TITLE")), false);
    });
  }
  it("acepta 180 s reales aunque el contenedor Ogg cuente el preroll Opus", async () => {
    const result = await processChatAudio(makeAudioFixture("ogg", 180));
    assert.equal(result.durationSeconds, 180);
  });
  it("rechaza video encubierto, corruptos, vacíos, exceso de bytes y duración", async () => {
    const before = (await readdir(tmpdir())).filter(name => name.startsWith("private-chat-audio-")).sort();
    for (const input of [Buffer.alloc(0), Buffer.from("not audio"), Buffer.from("OggS-corrupt"),
      Buffer.alloc(MAX_CHAT_AUDIO_BYTES + 1), makeVideoFixture(), makeAudioFixture("m4a", 181), makeAudioFixture("webm", 181)]) {
      await assert.rejects(() => processChatAudio(input), { message: "INVALID_AUDIO" });
    }
    const after = (await readdir(tmpdir())).filter(name => name.startsWith("private-chat-audio-")).sort();
    assert.deepEqual(after, before, "todos los temporales se eliminan también tras un error");
  });
  it("rangos del reproductor aceptan inicio/sufijo y rechazan múltiples o inválidos", () => {
    assert.deepEqual(parseVideoRange("bytes=0-9", 100), { start: 0, end: 9 });
    assert.deepEqual(parseVideoRange("bytes=-10", 100), { start: 90, end: 99 });
    assert.deepEqual(parseVideoRange("bytes=50-", 100), { start: 50, end: 99 });
    for (const header of ["bytes=100-", "bytes=8-2", "bytes=-0", "bytes=0-1,3-4", "bytes=-", "bytes=Infinity-"]) {
      assert.equal(parseVideoRange(header, 100), null);
    }
  });
});
