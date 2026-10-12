-- Additive: no changes to existing text/photo/video messages.
ALTER TABLE "chat"."messages"
  ADD COLUMN "audio_data" BYTEA,
  ADD COLUMN "audio_hash" TEXT,
  ADD COLUMN "audio_duration_seconds" DOUBLE PRECISION;

ALTER TABLE "chat"."messages"
  ADD CONSTRAINT "message_audio_valid" CHECK (
    (audio_data IS NULL AND audio_hash IS NULL AND audio_duration_seconds IS NULL) OR
    (audio_data IS NOT NULL AND audio_hash IS NOT NULL AND audio_duration_seconds IS NOT NULL
      AND octet_length(audio_data) BETWEEN 1 AND 10485760
      AND audio_hash ~ '^[0-9a-f]{64}$'
      AND audio_duration_seconds > 0 AND audio_duration_seconds <= 180)
  ),
  DROP CONSTRAINT "message_single_attachment",
  ADD CONSTRAINT "message_single_attachment" CHECK (
    num_nonnulls(photo_data, video_data, audio_data) <= 1
  );
