import * as net from "node:net";
import { randomUUID } from "node:crypto";
import type { INetworkServer } from "../INetworkServer.js";
import type { NetworkPayload } from "../types.js";

export class TcpServer implements INetworkServer {
    private server: net.Server | null = null;
    private clients: Map<string, net.Socket> = new Map();
    private receiveCallback: ((clientId: string, payload: NetworkPayload) => void) | null = null;

    // Cada cliente conectado precisa ter o seu próprio buffer de texto
    private clientBuffers: Map<string, string> = new Map();

    start(port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                const clientId = randomUUID();
                this.clients.set(clientId, socket);
                this.clientBuffers.set(clientId, ""); // Começa o buffer vazio para este cliente

                socket.on("data", (data) => {
                    let buffer = this.clientBuffers.get(clientId) || "";
                    buffer += data.toString();

                    const messages = buffer.split("\n");

                    // Guarda o que sobrou de volta no buffer do cliente específico
                    this.clientBuffers.set(clientId, messages.pop() || "");

                    if (this.receiveCallback) {
                        for (const msg of messages) {
                            if (msg.trim() !== "") {
                                try {
                                    const payload = JSON.parse(msg);
                                    this.receiveCallback(clientId, payload);
                                } catch (error) {
                                    console.error("Falha ao ler o JSON do TCP no servidor: ", msg);
                                }
                            }
                        }
                    }
                });

                socket.on("close", () => {
                    this.clients.delete(clientId);
                    this.clientBuffers.delete(clientId);
                });

                socket.on("error", () => {
                    // Evita crash se a conexão de um bot cair de forma abrupta
                    this.clients.delete(clientId);
                    this.clientBuffers.delete(clientId);
                });
            });

            this.server.on("listening", resolve);
            this.server.on("error", reject);
            this.server.listen(port);
        });
    }

    onReceive(callback: (clientId: string, payload: NetworkPayload) => void): void {
        this.receiveCallback = callback;
    }

    async broadcast(payload: NetworkPayload, excludeClientId?: string): Promise<void> {
        const text = JSON.stringify(payload) + "\n";

        for (const [id, socket] of this.clients.entries()) {
            if (id !== excludeClientId && !socket.destroyed) {
                socket.write(text);
            }
        }
    }

    stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                // Derruba todos os sockets antes de fechar o servidor
                for (const socket of this.clients.values()) {
                    socket.destroy();
                }
                this.clients.clear();
                this.clientBuffers.clear();

                this.server.close((err) => {
                    if (err) {
                        return reject(err);
                    }
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}