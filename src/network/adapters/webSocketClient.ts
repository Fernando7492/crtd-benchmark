import type { INetworkClient } from "../INetworkClient.js";
import type { NetworkPayload } from "../types.js";
import { WebSocket } from "ws";

export class WebSocketClient implements INetworkClient{

    private socket: WebSocket|null = null;
    private receiveCallback: ((payload: NetworkPayload) => void) | null = null;

    connect(connectUrl: string): Promise<void> {
        return new Promise((resolve, reject)=>{
            this.socket = new WebSocket(connectUrl);

            this.socket.on("open",resolve);
            this.socket.on("error",reject);
            this.socket.on("message",(data)=>{
                if(this.receiveCallback){
                    const networkPayload:NetworkPayload = JSON.parse(data.toString());
                    this.receiveCallback(networkPayload);
                }
            });
        })
    }
    send(payload: NetworkPayload): Promise<void> {
        return new Promise((resolve,reject)=>{
            if(this.socket?.readyState == WebSocket.OPEN){
                const text = JSON.stringify(payload);
                this.socket.send(text);
                resolve();
            }else{
                reject(new Error("error: socket is not open"));
            }
        })
    }
    onReceive(callback: (payload: NetworkPayload) => void): void {
        this.receiveCallback = callback;
    }
    disconnect(): Promise<void> {
        return new Promise((resolve)=>{
            if(this.socket){
                this.socket.on("close",()=>{
                    resolve();
                    this.socket = null;
                });
                this.socket.close();
            }else{
                resolve();
            }
        })
    }
    
}