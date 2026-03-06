import { WebTransport } from "@fails-components/webtransport";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { INetworkClient } from "../INetworkClient.js";
import type { NetworkPayload } from "../types.js";

/** Calcula o SHA-256 (raw Buffer) do DER de um certificado PEM. */
function certPemToSha256(pemPath: string): Buffer {
  const pem = readFileSync(pemPath, "utf-8");
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Buffer.from(b64, "base64");
  return createHash("sha256").update(der).digest();
}

export class WebTransportClient implements INetworkClient {
  private transport: InstanceType<typeof WebTransport> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private receiveCallback: ((payload: NetworkPayload) => void) | null = null;

  async connect(connectUrl: string): Promise<void> {
    // Aceita "webtransport://host:port" ou "https://host:port" e normaliza para o path /sync
    const url = connectUrl.replace(/^webtransport:\/\//, "https://");
    const transportUrl = url.endsWith("/sync") ? url : url.replace(/\/?$/, "/sync");

    // Computa o fingerprint do certificado do servidor para bypassar a validação TLS
    const certPath = process.env.WT_CERT_PATH ?? "./certs/cert.pem";
    const options: Record<string, any> = {
      serverCertificateHashes: [
        {
          algorithm: "sha-256",
          value: certPemToSha256(certPath),
        },
      ],
      forceReliable: true,
    };

    this.transport = new WebTransport(transportUrl, options);
    // transport.closed também rejeita se o handshake falhar; silencia para evitar unhandled rejection
    this.transport.closed.catch(() => { });
    await this.transport.ready;

    // Abre um stream bidirecional para envio e recebimento
    const stream = await this.transport.createBidirectionalStream();
    this.writer = (stream.writable as WritableStream<Uint8Array>).getWriter();
    this.readStream((stream.readable as ReadableStream<Uint8Array>).getReader()).catch(() => { });
  }

  private async readStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split("\n");
        buffer = messages.pop() ?? "";

        for (const msg of messages) {
          if (msg.trim() !== "" && this.receiveCallback) {
            try {
              this.receiveCallback(JSON.parse(msg));
            } catch {
              console.error("WebTransport: erro ao parsear JSON no cliente");
            }
          }
        }
      }
    } catch {
      // Conexão encerrada normalmente
    }
  }

  async send(payload: NetworkPayload): Promise<void> {
    if (!this.writer) throw new Error("WebTransport: cliente não conectado");
    const text = JSON.stringify(payload) + "\n";
    await this.writer.write(new TextEncoder().encode(text));
  }

  onReceive(callback: (payload: NetworkPayload) => void): void {
    this.receiveCallback = callback;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      try {
        await this.writer?.close();
      } catch {
        // ignora erro ao fechar writer
      }
      this.transport.close();
      this.transport = null;
      this.writer = null;
    }
  }
}
