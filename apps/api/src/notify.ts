import { randomUUID } from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import type { PrismaClient } from "@prisma/client";
import type { AppConfig } from "./config.js";

// Avisador opcional por correo: un aviso por cada mensaje nuevo (texto o
// foto) al correo de la otra cuenta, incluyendo el texto del mensaje.
//
// Privacidad: el texto sale del servidor por SMTP y queda en el buzón del
// destinatario y en los relays intermedios. No es cifrado de extremo a
// extremo; borrar el mensaje en el chat no borra el correo. Deshabilitado
// por defecto; el operador lo activa con SMTP_HOST + NOTIFY_FROM +
// NOTIFY_EMAIL_SLOT1/SLOT2. Nunca registra cuerpos ni destinatarios.

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  /** Asunto en texto plano (se codifica a RFC 2047 al enviar). */
  subject: string;
  /** Cuerpo en texto plano UTF-8. */
  text: string;
  timeoutMs: number;
}

export type SendMailFn = (opts: SmtpOptions) => Promise<void>;

export interface NotifyMessage {
  id: string;
  body: string;
  createdAt: string;
  photoUrl?: string;
  replyTo?: { body: string };
}

interface SmtpReply {
  code: number;
  lines: string[];
}

const STICKER_RE = /^\[sticker:chiikawa:([A-Za-z0-9_-]{1,32})\]$/;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

/** Sin CR/LF: el nombre va en el asunto y no debe romper cabeceras. */
export function sanitizeHeader(value: string, max = 200): string {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

function describeBody(body: string): string {
  const sticker = STICKER_RE.exec(body.trim());
  if (sticker) return `Sticker Chiikawa (${sticker[1]})`;
  return body;
}

export function resolveRecipientEmail(
  notify: AppConfig["notify"],
  users: Array<{ id: string; slot: number }>,
  senderId: string,
): string {
  const sender = users.find((u) => u.id === senderId);
  if (!sender) return "";
  const recipient = users.find((u) => u.id !== senderId);
  if (!recipient) return "";
  const address = recipient.slot === 1 ? notify.toSlot1 : notify.toSlot2;
  return address && isValidEmail(address) ? address : "";
}

export function buildNewMessageEmail(input: {
  senderName: string;
  message: NotifyMessage;
  appOrigin: string;
}): { subject: string; text: string } {
  const sender = sanitizeHeader(input.senderName, 60) || "Tu contacto";
  const subject = `Nuevo mensaje de ${sender} en Private Chat`;
  const lines: string[] = [
    `${sender} te escribió en Private Chat:`,
    "",
    describeBody(input.message.body),
  ];
  if (input.message.photoUrl) {
    lines.push("", "[Incluye una foto: ábrela en el chat.]");
  }
  if (input.message.replyTo) {
    const quote = input.message.replyTo.body.trim().slice(0, 280);
    lines.push("", `En respuesta a: "${quote}"`);
  }
  lines.push(
    "",
    "—",
    `Abre el chat: ${input.appOrigin}`,
    "Este aviso incluye el texto del mensaje. Borrarlo en el chat no borra este correo.",
  );
  return { subject, text: lines.join("\n") };
}

function encodeSubject(subject: string): string {
  if (/^[\x20-\x7e]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function dotStuff(text: string): string {
  return text.split("\n").map((line) => {
    const cr = line.endsWith("\r") ? line : `${line.replace(/\r$/, "")}`;
    const clean = cr.endsWith("\r") ? cr.slice(0, -1) : cr;
    return clean.startsWith(".") ? `.${clean}` : clean;
  }).join("\r\n");
}

function buildData(from: string, to: string, subject: string, text: string): string {
  const safeFrom = sanitizeHeader(from, 320);
  const safeTo = sanitizeHeader(to, 320);
  const headers = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${encodeSubject(sanitizeHeader(subject))}`,
    `Message-ID: <${randomUUID()}@private-chat>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${dotStuff(text)}\r\n.\r\n`;
}

class SmtpError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

async function readReply(socket: net.Socket | tls.TLSSocket, buffer: { data: string }): Promise<SmtpReply> {
  const lines: string[] = [];
  for (;;) {
    const idx = buffer.data.indexOf("\n");
    if (idx < 0) {
      await new Promise<void>((resolve, reject) => {
        const onData = (chunk: Buffer): void => {
          buffer.data += chunk.toString("utf8");
          cleanup();
          resolve();
        };
        const onError = (err: Error): void => {
          cleanup();
          reject(err);
        };
        const onClose = (): void => {
          cleanup();
          reject(new Error("Conexión SMTP cerrada"));
        };
        const cleanup = (): void => {
          socket.off("data", onData);
          socket.off("error", onError);
          socket.off("close", onClose);
        };
        socket.on("data", onData);
        socket.once("error", onError);
        socket.once("close", onClose);
      });
      continue;
    }
    const raw = buffer.data.slice(0, idx);
    buffer.data = buffer.data.slice(idx + 1);
    const line = raw.replace(/\r$/, "");
    lines.push(line);
    const match = /^(\d{3})([ -])/.exec(line);
    if (match && match[2] === " ") {
      return { code: Number(match[1]), lines };
    }
    if (lines.length > 64) throw new SmtpError("Respuesta SMTP demasiado larga", 0);
  }
}

async function sendCommand(
  socket: net.Socket | tls.TLSSocket,
  buffer: { data: string },
  command: string,
  expect: number[],
  label: string,
): Promise<SmtpReply> {
  await new Promise<void>((resolve, reject) => {
    socket.write(command, (err) => (err ? reject(err) : resolve()));
  });
  const reply = await readReply(socket, buffer);
  if (!expect.includes(reply.code)) {
    throw new SmtpError(`${label} rechazado (${reply.code})`, reply.code);
  }
  return reply;
}

function ehloExtensions(reply: SmtpReply): Set<string> {
  const extensions = new Set<string>();
  for (const line of reply.lines.slice(1)) {
    const token = line.slice(4).trim().split(/\s+/)[0]?.toUpperCase();
    if (token) extensions.add(token);
  }
  return extensions;
}

/** Cliente SMTP mínimo sin dependencias: STARTTLS si se ofrece, AUTH PLAIN/LOGIN. */
export async function sendSmtpMail(opts: SmtpOptions): Promise<void> {
  const timeoutMs = Number.isInteger(opts.timeoutMs) && opts.timeoutMs >= 1000 && opts.timeoutMs <= 60000
    ? opts.timeoutMs
    : 10000;
  let socket: net.Socket | tls.TLSSocket = opts.secure
    ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host, timeout: timeoutMs })
    : net.createConnection({ host: opts.host, port: opts.port, timeout: timeoutMs });
  const buffer = { data: "" };
  const fail = (err: unknown): never => {
    socket.destroy();
    throw err;
  };

  socket.setTimeout(timeoutMs);
  socket.once("timeout", () => {
    socket.destroy(new Error("Tiempo de espera SMTP agotado"));
  });

  try {
    const greeting = await readReply(socket, buffer);
    if (greeting.code !== 220) throw new SmtpError(`Saludo SMTP inválido (${greeting.code})`, greeting.code);

    let ehlo = await sendCommand(socket, buffer, "EHLO private-chat\r\n", [250], "EHLO");
    let extensions = ehloExtensions(ehlo);
    if (!opts.secure && extensions.has("STARTTLS")) {
      await sendCommand(socket, buffer, "STARTTLS\r\n", [220], "STARTTLS");
      const upgraded = tls.connect({
        socket,
        servername: opts.host,
        timeout: timeoutMs,
      });
      socket = upgraded;
      buffer.data = "";
      socket.setTimeout(timeoutMs);
      socket.once("timeout", () => {
        socket.destroy(new Error("Tiempo de espera SMTP agotado"));
      });
      ehlo = await sendCommand(socket, buffer, "EHLO private-chat\r\n", [250], "EHLO");
      extensions = ehloExtensions(ehlo);
    }

    if (opts.user) {
      const authTokens = [...extensions].filter((t) => t === "AUTH" || t.startsWith("AUTH"));
      const authLine = ehlo.lines.find((l) => /^250[ -]AUTH/i.test(l))?.toUpperCase() ?? "";
      const offersPlain = /PLAIN/.test(authLine) || authTokens.length === 0;
      if (offersPlain) {
        const initial = Buffer.from(`\0${opts.user}\0${opts.pass}`, "utf8").toString("base64");
        try {
          await sendCommand(socket, buffer, `AUTH PLAIN ${initial}\r\n`, [235], "AUTH");
        } catch (err) {
          if (err instanceof SmtpError && [504, 538].includes(err.code)) {
            await authLogin(socket, buffer, opts);
          } else {
            throw err;
          }
        }
      } else {
        await authLogin(socket, buffer, opts);
      }
    }

    await sendCommand(socket, buffer, `MAIL FROM:<${sanitizeHeader(opts.from, 320)}>\r\n`, [250], "MAIL FROM");
    await sendCommand(socket, buffer, `RCPT TO:<${sanitizeHeader(opts.to, 320)}>\r\n`, [250, 251], "RCPT TO");
    await sendCommand(socket, buffer, "DATA\r\n", [354], "DATA");
    await sendCommand(socket, buffer, buildData(opts.from, opts.to, opts.subject, opts.text), [250], "contenido");
    try {
      await sendCommand(socket, buffer, "QUIT\r\n", [221], "QUIT");
    } catch {
      // Cierre oportunista: el correo ya fue aceptado (250 al contenido).
    }
    socket.end();
  } catch (err) {
    fail(err);
  }
}

async function authLogin(
  socket: net.Socket | tls.TLSSocket,
  buffer: { data: string },
  opts: SmtpOptions,
): Promise<void> {
  await sendCommand(socket, buffer, "AUTH LOGIN\r\n", [334], "AUTH");
  await sendCommand(
    socket, buffer, `${Buffer.from(opts.user, "utf8").toString("base64")}\r\n`, [334], "usuario SMTP",
  );
  await sendCommand(
    socket, buffer, `${Buffer.from(opts.pass, "utf8").toString("base64")}\r\n`, [235], "clave SMTP",
  );
}

export async function notifyNewMessage(input: {
  config: AppConfig;
  db: Pick<PrismaClient, "user">;
  sendMail?: SendMailFn;
  message: NotifyMessage;
  senderId: string;
}): Promise<{ sent: boolean; reason: string }> {
  const { config } = input;
  if (!config.notify.enabled) return { sent: false, reason: "disabled" };
  const users = await input.db.user.findMany({ select: { id: true, slot: true, displayName: true } });
  const sender = users.find((u) => u.id === input.senderId);
  const to = resolveRecipientEmail(config.notify, users, input.senderId);
  if (!to) return { sent: false, reason: "no-recipient-email" };
  const { subject, text } = buildNewMessageEmail({
    senderName: sender?.displayName ?? "Tu contacto",
    message: input.message,
    appOrigin: config.appOrigin,
  });
  const send = input.sendMail ?? sendSmtpMail;
  await send({
    host: config.notify.host,
    port: config.notify.port,
    secure: config.notify.secure,
    user: config.notify.user,
    pass: config.notify.password,
    from: config.notify.from,
    to,
    subject,
    text,
    timeoutMs: config.notify.timeoutMs,
  });
  return { sent: true, reason: "sent" };
}
