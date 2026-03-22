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

// Pool de channels compartilhados com contagem de referência.
// Todos os bots conectando no mesmo endereço reutilizam a mesma conexão HTTP/2,
// aproveitando a multiplexação de streams nativa do protocolo.
const channelPool = new Map<string, { stub: grpc.Client; refCount: number }>();

function acquireChannel(address: string): grpc.Client {
  const entry = channelPool.get(address);
  if (entry) {
    entry.refCount++;
    return entry.stub;
  }
  const stub = new CrdtSyncClient(address, grpc.credentials.createInsecure());
  channelPool.set(address, { stub, refCount: 1 });
  return stub;
}

function releaseChannel(address: string): void {
  const entry = channelPool.get(address);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.stub.close();
    channelPool.delete(address);
  }
}

export class GrpcClient implements INetworkClient {
  private address: string = "";
  private stream: grpc.ClientDuplexStream<string, string> | null = null;
  private receiveCallback: ((payload: NetworkPayload) => void) | null = null;

  connect(connectUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.address = connectUrl.replace(/^grpc:\/\//, "");
      const stub = acquireChannel(this.address);

      stub.waitForReady(Date.now() + 5000, (err?: Error) => {
        if (err) return reject(err);

        this.stream = (stub as any).Sync() as grpc.ClientDuplexStream<string, string>;

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
      if (this.address) {
        releaseChannel(this.address);
        this.address = "";
      }
      resolve();
    });
  }
}
