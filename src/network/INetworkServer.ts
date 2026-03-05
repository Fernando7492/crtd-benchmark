import type { NetworkPayload } from "./types.js";

export interface INetworkServer{

    start(port:number): Promise<void>;

    onReceive(callback:(clientId:string,payload:NetworkPayload)=>void):void;

    broadcast(payload:NetworkPayload, excludeClientId?:string):Promise<void>;

    stop():Promise<void>;
}