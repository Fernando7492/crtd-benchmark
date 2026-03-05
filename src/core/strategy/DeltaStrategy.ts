import type { DeltaPayload, SyncStrategy } from "./types.js";
import type { RGA } from "../rga/index.js";
import type { RGANode } from "../types.js";


export class DeltaStrategy<T> implements SyncStrategy<DeltaPayload<T>>{
    
    private rga: RGA<T>;
    private syncedIds: Set<string>;
    public readonly strategyName: string = "DELTA";

    constructor(rga: RGA<T>){
        this.rga = rga;
        this.syncedIds = new Set<string>();
    }

    private getTrackingString(node: RGANode<T>): string {
        return `${node.id.agentId}:${node.id.seq}:${node.isDeleted}`;
    }
    
    public generatePayload(): DeltaPayload<T> {
        const allNodes = this.rga.getRawState();
        const deltaNodes: RGANode<T>[] = [];

        for(const node of allNodes){
            const trackStr = this.getTrackingString(node);

            if(!this.syncedIds.has(trackStr)){
                deltaNodes.push(node);
                this.syncedIds.add(trackStr);
            }
        }
    
        return {data: deltaNodes};
    }
    public applyPayload(payload: DeltaPayload<T>): void {
        this.rga.applyRawState(payload.data);

        for(const node of payload.data){
            const trackStr = this.getTrackingString(node);
            this.syncedIds.add(trackStr);
        }
    }

}