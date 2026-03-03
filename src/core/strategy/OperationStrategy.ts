import { RGA } from "../rga/index.js";
import type { SyncStrategy, OperationPayload } from "./types.js";
import type { RGAOperation } from "../types.js";

export class OperationStrategy<T> implements SyncStrategy<OperationPayload<T>,RGAOperation<T>>{
    
    private rga: RGA<T>;

    constructor(rga: RGA<T>){
        this.rga = rga;    
    }
    
    public generatePayload(data: RGAOperation<T>): OperationPayload<T> {
        const payload: OperationPayload<T> = {
            data: data
        }
        return payload;
    }
    public applyPayload(payload: OperationPayload<T>): void {
        if(payload.data.type === "INSERT"){
            this.rga.insert(
                payload.data.node.value,
                payload.data.node.id,
                payload.data.node.origin
            );
        }else if(payload.data.type === "DELETE"){
            this.rga.delete(
                payload.data.node.id
            );
        }else {
            throw new Error(`Unrecognized operation type received: ${payload.data.type}`);
        }
    }
    
}