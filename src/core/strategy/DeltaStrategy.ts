import type { DeltaPayload, SyncStrategy } from "./types.js";
import type { RGA } from "../rga/index.js";
import type { RGANode } from "../types.js";


export class DeltaStrategy<T> implements SyncStrategy<DeltaPayload<T>>{
    
    private rga: RGA<T>;
    private syncedInsertions: Set<string>;
    private syncedDeletions: Set<string>;
    public readonly strategyName: string = "DELTA";

    constructor(rga: RGA<T>){
        this.rga = rga;
        this.syncedInsertions = new Set<string>();
        this.syncedDeletions = new Set<string>();
    }

    private getIdString(node: RGANode<T>): string {
        return `${node.id.agentId}:${node.id.seq}`;
    }
    
    public generatePayload(): DeltaPayload<T> {
        const allNodes = this.rga.getRawState();
        const deltaNodes: RGANode<T>[] = [];

        for(const node of allNodes){
            const idStr = this.getIdString(node);
            const isInsertionSynced = this.syncedInsertions.has(idStr);

            if(!isInsertionSynced){
                deltaNodes.push(node);
                this.syncedInsertions.add(idStr);
                if(node.isDeleted) {
                    this.syncedDeletions.add(idStr);
                }
            } else if(node.isDeleted && !this.syncedDeletions.has(idStr)){
                deltaNodes.push(node);
                this.syncedDeletions.add(idStr);
            }
        }
    
        return {data: deltaNodes};
    }
    public applyPayload(payload: DeltaPayload<T>): void {
        this.rga.applyRawState(payload.data);

        for(const node of payload.data){
            const idStr = this.getIdString(node);
            this.syncedInsertions.add(idStr);
            if(node.isDeleted) {
                this.syncedDeletions.add(idStr);
            }
        }
    }
    
}