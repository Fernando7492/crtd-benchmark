import * as grpc from "@grpc/grpc-js";
import { randomUUID } from "node:crypto";
import type { INetworkServer } from "../INetworkServer.js";
import type { NetworkPayload } from "../types.js";

const serialize = (value: string): Buffer => Buffer.from(value, "utf-8");
const deserialize = (buffer: Buffer): string => buffer.toString("utf-8");

const CRDT_SYNC_SERVICE: grpc.ServiceDefinition = {
  Sync: {
    path: "/crdt.CrdtSync/Sync",
    requestStream: true,
    responseStream: true,
    requestSerialize: serialize,
    requestDeserialize: deserialize,
    responseSerialize: serialize,
    responseDeserialize: deserialize,
  } as grpc.MethodDefinition<string, string>,
};

export class GrpcServer implements INetworkServer {
  private server: grpc.Server | null = null;
  private streams: Map<string, grpc.ServerDuplexStream<string, string>> = new Map();
  private receiveCallback: ((clientId: string, payload: NetworkPayload) => void) | null = null;

  start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = new grpc.Server();

      this.server.addService(CRDT_SYNC_SERVICE, {
        Sync: (stream: grpc.ServerDuplexStream<string, string>) => {
          const clientId = randomUUID();
          this.streams.set(clientId, stream);

          stream.on("data", (message: string) => {
            if (this.receiveCallback) {
              try {
                const networkPayload: NetworkPayload = JSON.parse(message);
                this.receiveCallback(clientId, networkPayload);
              } catch {
                console.error("gRPC: falha ao parsear payload JSON no servidor");
              }
            }
          });

          stream.on("end", () => {
            this.streams.delete(clientId);
            stream.end();
          });

          stream.on("error", () => {
            this.streams.delete(clientId);
          });
        },
      });

      this.server.bindAsync(
        `0.0.0.0:${port}`,
        grpc.ServerCredentials.createInsecure(),
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }

  onReceive(callback: (clientId: string, payload: NetworkPayload) => void): void {
    this.receiveCallback = callback;
  }

  async broadcast(payload: NetworkPayload, excludeClientId?: string): Promise<void> {
    const text = JSON.stringify(payload);
    for (const [id, stream] of this.streams.entries()) {
      if (id !== excludeClientId) {
        try {
          stream.write(text);
        } catch {
          this.streams.delete(id);
        }
      }
    }
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        for (const stream of this.streams.values()) {
          stream.end();
        }
        this.streams.clear();

        this.server.tryShutdown((err) => {
          if (err) return reject(err);
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
