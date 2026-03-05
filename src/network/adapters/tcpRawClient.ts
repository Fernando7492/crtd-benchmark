import * as net from "node:net";
import type { INetworkClient } from "../INetworkClient.js";
import type { NetworkPayload } from "../types.js";

export class TcpClient implements INetworkClient {
    private socket: net.Socket | null = null;
    private receiveCallback: ((payload: NetworkPayload) => void) | null = null;

    // Usado para juntar pedaços de mensagens TCP que chegam fragmentadas
    private buffer: string = "";

    connect(connectUrl: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Pega a string "tcp://localhost:8080" e separa o host e a porta
            const url = new URL(connectUrl);
            const port = Number(url.port);
            const host = url.hostname;

            this.socket = net.createConnection({ port: port, host: host }, () => {
                resolve();
            });

            this.socket.on("error", reject);

            this.socket.on("data", (data) => {
                // Junta o dado novo com o que já estava guardado
                this.buffer += data.toString();

                // Corta a string toda vez que achar uma quebra de linha
                const messages = this.buffer.split("\n");

                // O último item do array sempre sobra (pode estar incompleto ou ser vazio)
                this.buffer = messages.pop() || "";

                // Processa todas as mensagens completas
                if (this.receiveCallback) {
                    for (const msg of messages) {
                        if (msg.trim() !== "") {
                            try {
                                const payload = JSON.parse(msg);
                                this.receiveCallback(payload);
                            } catch (error) {
                                console.error("Falha ao ler o JSON do TCP no cliente:", msg);
                            }
                        }
                    }
                }
            });
        });
    }

    send(payload: NetworkPayload): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket && !this.socket.destroyed) {
                // Transforma em JSON e coloca o \n no final para o servidor saber onde acaba
                const text = JSON.stringify(payload) + "\n";
                this.socket.write(text, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            } else {
                reject(new Error("Erro: Socket TCP não está aberto"));
            }
        });
    }

    onReceive(callback: (payload: NetworkPayload) => void): void {
        this.receiveCallback = callback;
    }

    disconnect(): Promise<void> {
        return new Promise((resolve) => {
            if (this.socket) {
                this.socket.on("close", () => {
                    this.socket = null;
                    resolve();
                });
                this.socket.destroy();
            } else {
                resolve();
            }
        });
    }
}