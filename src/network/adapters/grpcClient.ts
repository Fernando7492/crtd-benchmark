import * as grpc from "@grpc/grpc-js";
import type { INetworkClient } from "../INetworkClient.js";
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

const CrdtSyncClient = grpc.makeClientConstructor(CRDT_SYNC_SERVICE, "CrdtSync");

export class GrpcClient implements INetworkClient {
  private stub: grpc.Client | null = null;
  private stream: grpc.ClientDuplexStream<string, string> | null = null;
  private receiveCallback: ((payload: NetworkPayload) => void) | null = null;

  connect(connectUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Aceita "grpc://localhost:8080" ou "localhost:8080"
      const address = connectUrl.replace(/^grpc:\/\//, "");

      this.stub = new CrdtSyncClient(address, grpc.credentials.createInsecure());

      this.stub.waitForReady(Date.now() + 5000, (err?: Error) => {
        if (err) return reject(err);

        this.stream = (this.stub as any).Sync() as grpc.ClientDuplexStream<string, string>;

        this.stream!.on("data", (message: string) => {
          if (this.receiveCallback) {
            try {
              const networkPayload: NetworkPayload = JSON.parse(message);
              this.receiveCallback(networkPayload);
            } catch {
              console.error("gRPC: falha ao parsear payload JSON no cliente");
            }
          }
        });

        this.stream!.on("error", () => {
          // Evita crash se o servidor derrubar a stream abruptamente
        });

        resolve();
      });
    });
  }

  send(payload: NetworkPayload): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.stream) {
        const text = JSON.stringify(payload);
        const ok = this.stream.write(text);
        if (ok === false) {
          this.stream.once("drain", resolve);
        } else {
          resolve();
        }
      } else {
        reject(new Error("gRPC: stream não está aberto"));
      }
    });
  }

  onReceive(callback: (payload: NetworkPayload) => void): void {
    this.receiveCallback = callback;
  }

  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (this.stream) {
        this.stream.end();
        this.stream = null;
      }
      if (this.stub) {
        this.stub.close();
        this.stub = null;
      }
      resolve();
    });
  }
}
