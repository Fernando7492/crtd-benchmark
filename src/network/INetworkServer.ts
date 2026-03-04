import type { NetworkPayload } from "./types.js";

export interface NetworkServer{

    start(port:number): Promise<void>;

    onReceive(callback:(clientId:string,payload:NetworkPayload)=>void):void;

    broadcast(payload:NetworkPayload, excludeClienteId?:string):Promise<void>;

    stop():Promise<void>;
}