import type { INetworkServer } from "../INetworkServer.js";
import type { NetworkPayload } from "../types.js";
import { WebSocket, WebSocketServer as WsServer} from "ws"
import { randomUUID } from "node:crypto";

export class WebSocketServer implements INetworkServer{

    private server: WsServer | null = null;
    private clients: Map<string,WebSocket> =new Map();
    private receiveCallback: ((clientId:string, payload:NetworkPayload)=>void) | null = null;


    start(port: number): Promise<void> {
        return new Promise((resolve,reject)=>{
            this.server = new WsServer({
                port: port
            })

            this.server.on("listening",resolve);
            this.server.on("error", reject);
            this.server.on("connection",(socket)=>{
                const clientId = randomUUID();
                this.clients.set(clientId,socket);
                socket.on("message",(data)=>{
                    let networkPayload: NetworkPayload;
                    try {
                        networkPayload= JSON.parse(data.toString())
                        if(this.receiveCallback){
                            this.receiveCallback(clientId,networkPayload);
                        }
                        
                    } catch (error) {
                        console.error("JSON parse failed");
                        return
                    }
                    
                })
                socket.on("close",()=>{
                    this.clients.delete(clientId);
                })
            })
        })
    }
    onReceive(callback: (clientId: string, payload: NetworkPayload) => void): void {
        this.receiveCallback = callback;
    }
    async broadcast(payload: NetworkPayload, excludeClientId?: string): Promise<void> {
        const text = JSON.stringify(payload);
        for (const [id,socket] of this.clients.entries()){
            if(id!==excludeClientId && socket.readyState === WebSocket.OPEN){
                socket.send(text);
            }
        }
    }
    stop(): Promise<void> {
        return new Promise((resolve,reject)=>{
            if(this.server){
                for(const socket of this.clients.values()){
                    socket.close();
                }
                this.clients.clear();
                this.server.close((err)=>{
                    if(err){
                        return reject(err);
                    };
                    this.server = null;
                    resolve()
                });
            }else{
                resolve();
                this.server = null;
            }
        })
    }

}