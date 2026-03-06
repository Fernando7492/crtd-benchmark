import { Http2Server } from "@fails-components/webtransport";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { INetworkServer } from "../INetworkServer.js";
import type { NetworkPayload } from "../types.js";

export class WebTransportServer implements INetworkServer {
  private server: Http2Server | null = null;
  private clients: Map<string, WritableStreamDefaultWriter<Uint8Array>> = new Map();
  private receiveCallback: ((clientId: string, payload: NetworkPayload) => void) | null = null;

  async start(port: number): Promise<void> {
    const certPath = process.env.WT_CERT_PATH ?? "./certs/cert.pem";
    const keyPath = process.env.WT_KEY_PATH ?? "./certs/key.pem";

    const cert = readFileSync(certPath, "utf-8");
    const privKey = readFileSync(keyPath, "utf-8");

    this.server = new Http2Server({
      port,
      host: "0.0.0.0",
      secret: "webtransport-benchmark",
      cert,
      privKey,
    });

    this.server.startServer();

    const sessionStream = this.server.sessionStream("/sync");
    this.acceptSessions(sessionStream.getReader() as ReadableStreamDefaultReader<any>);
  }

  private async acceptSessions(reader: ReadableStreamDefaultReader<any>): Promise<void> {
    while (true) {
      const { done, value: session } = await reader.read();
      if (done) break;
      this.handleSession(session).catch((err) =>
        console.error("WebTransport: erro ao tratar sessão", err)
      );
    }
  }

  private async handleSession(session: any): Promise<void> {
    try {
      await session.ready;

      const clientId = randomUUID();

      const bidiReader = session.incomingBidirectionalStreams.getReader() as ReadableStreamDefaultReader<any>;
      const { value: stream } = await bidiReader.read();
      bidiReader.releaseLock();

      const writer = (stream.writable as WritableStream<Uint8Array>).getWriter();
      this.clients.set(clientId, writer);

      session.closed.then(() => {
        this.clients.delete(clientId);
      });

      await this.readStream(clientId, (stream.readable as ReadableStream<Uint8Array>).getReader());
    } catch (err) {
      console.error("WebTransport: erro na sessão do servidor", err);
    }
  }

  private async readStream(
    clientId: string,
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<void> {
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
              this.receiveCallback(clientId, JSON.parse(msg));
            } catch {
              console.error("WebTransport: erro ao parsear JSON no servidor");
            }
          }
        }
      }
    } finally {
      this.clients.delete(clientId);
    }
  }

  onReceive(callback: (clientId: string, payload: NetworkPayload) => void): void {
    this.receiveCallback = callback;
  }

  async broadcast(payload: NetworkPayload, excludeClientId?: string): Promise<void> {
    const text = JSON.stringify(payload) + "\n";
    const data = new TextEncoder().encode(text);
    const promises: Promise<void>[] = [];

    for (const [id, writer] of this.clients.entries()) {
      if (id !== excludeClientId) {
        promises.push(writer.write(data));
      }
    }
    await Promise.all(promises);
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stopServer();
      this.clients.clear();
      this.server = null;
    }
  }
}
