-- Additive: edición de mensajes propios (v8). NULL = nunca editado.
ALTER TABLE "chat"."messages" ADD COLUMN "edited_at" TIMESTAMPTZ(6);
