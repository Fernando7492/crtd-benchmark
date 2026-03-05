import type { SyncStrategy } from "../core/strategy/types.js";
import type { NetworkPayload } from "./types.js";

export interface INetworkClient{
    connect(connectUrl: string):Promise<void>;

    send(payload:NetworkPayload):Promise<void>;

    onReceive(callback: (payload:NetworkPayload)=>void):void;

    disconnect():Promise<void>;

}