import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { loadConfig } from "../../src/config.js";
import {
  buildNewMessageEmail,
  isValidEmail,
  resolveRecipientEmail,
  sanitizeHeader,
  sendSmtpMail,
} from "../../src/notify.js";

const BASE_ENV = {
  APP_ENV: "test",
  APP_ORIGIN: "http://app.test:5173",
  DATABASE_URL: "postgresql://test@127.0.0.1/private_chat_test",
};

test("avisos deshabilitados por defecto, sin variables SMTP", () => {
  const config = loadConfig({ ...BASE_ENV });
  assert.equal(config.notify.enabled, false);
});

test("avisos se habilitan con host, remitente y un destinatario", () => {
  const config = loadConfig({
    ...BASE_ENV,
    SMTP_HOST: "relay.ejemplo.com",
    NOTIFY_FROM: "chat@ejemplo.com",
    NOTIFY_EMAIL_SLOT1: "alexis@ejemplo.com",
  });
  assert.equal(config.notify.enabled, true);
  assert.equal(config.notify.port, 587);
  assert.equal(config.notify.secure, false);
});

test("configuración de avisos incompleta o inválida falla en voz alta", () => {
  assert.throws(
    () => loadConfig({ ...BASE_ENV, SMTP_HOST: "relay.ejemplo.com" }),
    /incompletos/,
  );
  assert.throws(
    () => loadConfig({ ...BASE_ENV, SMTP_HOST: "x", NOTIFY_FROM: "no-es-correo", NOTIFY_EMAIL_SLOT1: "a@b.com" }),
    /NOTIFY_FROM/,
  );
  assert.throws(
    () => loadConfig({
      ...BASE_ENV,
      SMTP_HOST: "x",
      SMTP_PORT: "99999",
      NOTIFY_FROM: "a@b.com",
      NOTIFY_EMAIL_SLOT1: "c@d.com",
    }),
    /SMTP_PORT/,
  );
});

test("el destinatario es la otra cuenta según su slot", () => {
  const config = loadConfig({
    ...BASE_ENV,
    SMTP_HOST: "relay.ejemplo.com",
    NOTIFY_FROM: "chat@ejemplo.com",
    NOTIFY_EMAIL_SLOT1: "alexis@ejemplo.com",
    NOTIFY_EMAIL_SLOT2: "marthiel@ejemplo.com",
  });
  const users = [
    { id: "id-admin", slot: 1 },
    { id: "id-member", slot: 2 },
  ];
  assert.equal(resolveRecipientEmail(config.notify, users, "id-admin"), "marthiel@ejemplo.com");
  assert.equal(resolveRecipientEmail(config.notify, users, "id-member"), "alexis@ejemplo.com");
  assert.equal(resolveRecipientEmail(config.notify, users, "desconocido"), "");
});

test("el aviso incluye el texto del mensaje y la foto sólo como nota", () => {
  const { subject, text } = buildNewMessageEmail({
    senderName: "Alexis",
    message: { id: "m1", body: "Hola, ¿cómo estás?", createdAt: new Date().toISOString(), photoUrl: "/api/messages/x/photo" },
    appOrigin: "https://chat.ejemplo.com",
  });
  assert.match(subject, /Alexis/);
  assert.match(text, /Hola, ¿cómo estás\?/);
  assert.match(text, /foto/i);
  assert.doesNotMatch(text, /bytes|base64/i);
});

test("el asunto nunca rompe cabeceras con saltos de línea", () => {
  assert.equal(sanitizeHeader("a\r\nBcc: x@evil.com"), "a Bcc: x@evil.com");
  const { subject } = buildNewMessageEmail({
    senderName: "A\r\nB",
    message: { id: "m1", body: "hola", createdAt: new Date().toISOString() },
    appOrigin: "https://chat.ejemplo.com",
  });
  assert.doesNotMatch(subject, /[\r\n]/);
});

test("isValidEmail rechaza lo obvio", () => {
  assert.equal(isValidEmail("a@b.com"), true);
  assert.equal(isValidEmail("sin-arroba"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("a@b c.com"), false);
});

// --- Cliente SMTP contra un relay falso -------------------------------------

interface CapturedMail {
  from: string;
  to: string;
  data: string;
}

function startFakeRelay(options: { auth?: "reject-rcpt" } = {}): Promise<{
  port: number;
  mails: CapturedMail[];
  close: () => Promise<void>;
}> {
  const mails: CapturedMail[] = [];
  const server = net.createServer((socket) => {
    let stage: "greet" | "mail" | "rcpt" | "data" | "body" | "done" = "greet";
    let buffer = "";
    let current: CapturedMail = { from: "", to: "", data: "" };
    socket.write("220 falso ESMTP listo\r\n");
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (stage === "body") {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end < 0) return;
          current.data = buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          mails.push(current);
          current = { from: "", to: "", data: "" };
          stage = "done";
          socket.write("250 mensaje aceptado\r\n");
          continue;
        }
        const idx = buffer.indexOf("\r\n");
        if (idx < 0) return;
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO")) {
          stage = "mail";
          socket.write("250-falso\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (upper.startsWith("AUTH PLAIN")) {
          stage = "mail";
          socket.write("235 autenticado\r\n");
        } else if (upper.startsWith("MAIL FROM:")) {
          current.from = line;
          stage = "rcpt";
          socket.write("250 ok\r\n");
        } else if (upper.startsWith("RCPT TO:")) {
          if (options.auth === "reject-rcpt") {
            socket.write("550 buzón desconocido\r\n");
          } else {
            current.to = line;
            stage = "data";
            socket.write("250 ok\r\n");
          }
        } else if (upper === "DATA") {
          stage = "body";
          socket.write("354 fin con punto\r\n");
        } else if (upper === "QUIT") {
          socket.write("221 adiós\r\n");
          socket.end();
        } else if (upper.startsWith("RSET")) {
          socket.write("250 ok\r\n");
        }
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Sin puerto del relay falso");
      resolve({
        port: address.port,
        mails,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

test("sendSmtpMail entrega asunto y contenido al relay", async () => {
  const relay = await startFakeRelay();
  try {
    await sendSmtpMail({
      host: "127.0.0.1",
      port: relay.port,
      secure: false,
      user: "",
      pass: "",
      from: "chat@ejemplo.com",
      to: "marthiel@ejemplo.com",
      subject: "Nuevo mensaje de Alexis en Private Chat",
      text: "Hola con contenido: áéí",
      timeoutMs: 5000,
    });
    assert.equal(relay.mails.length, 1);
    assert.match(relay.mails[0]!.data, /Hola con contenido/);
    assert.match(relay.mails[0]!.data, /Subject: Nuevo mensaje/);
    assert.match(relay.mails[0]!.data, /Content-Type: text\/plain; charset="utf-8"/);
  } finally {
    await relay.close();
  }
});

test("sendSmtpMail falla si el destinatario es rechazado", async () => {
  const relay = await startFakeRelay({ auth: "reject-rcpt" });
  try {
    await assert.rejects(
      sendSmtpMail({
        host: "127.0.0.1",
        port: relay.port,
        secure: false,
        user: "",
        pass: "",
        from: "chat@ejemplo.com",
        to: "nadie@ejemplo.com",
        subject: "x",
        text: "y",
        timeoutMs: 5000,
      }),
      /RCPT TO rechazado \(550\)/,
    );
    assert.equal(relay.mails.length, 0);
  } finally {
    await relay.close();
  }
});
