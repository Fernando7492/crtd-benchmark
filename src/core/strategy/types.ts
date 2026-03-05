import type { RGANode, RGAOperation } from "../types.js";

export interface StatePayload<T>{
    data: RGANode<T>[];
}

export interface OperationPayload<T>{
    data: RGAOperation<T>;
}

export interface DeltaPayload<T>{
    data: RGANode<T>[];
}

export interface SyncStrategy<P, I = void>{
    generatePayload(data: I):P;
    applyPayload(payload:P):void;
    readonly strategyName: string;
}
