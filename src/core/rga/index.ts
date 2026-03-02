import type { RGANode, Identifier, PendingInsert } from '../types.js';

export class RGA<T> {
    private nodes: RGANode<T>[];
    private nodeMap: Map<string, RGANode<T>>;
    private pendingQueue: Map<string, PendingInsert<T>[]>;

    constructor() {
        this.nodes = [];
        this.nodeMap = new Map();
        this.pendingQueue = new Map();
    }
    private getIdString(id: Identifier): string{
        return `${id.agentId}:${id.seq}`;
    }

    private compareIdentifiers(id1: Identifier, id2: Identifier): number{
        if(id1.seq !== id2.seq){
            return id2.seq - id1.seq;
        }
        if(id1.agentId < id2.agentId){
            return 1;
        }else if(id1.agentId > id2.agentId){
            return -1;
        }
        return 0;
    }

    public insert(value: T, id: Identifier, origin: Identifier | null): void {
        const idString = this.getIdString(id);

        if (this.nodeMap.has(idString)) {
            return;
        }

        let startIndex = 0;

        if (origin !== null) {
            const originString = this.getIdString(origin);
            const originNode = this.nodeMap.get(originString);

            if (!originNode) {
                const pendingNode: PendingInsert<T> = {
                    id,
                    origin,
                    value,
                };
                const originPending = this.pendingQueue.get(originString);
                if(!originPending){
                    this.pendingQueue.set(originString,[pendingNode]);
                }else{
                    originPending.push(pendingNode);
                }
                return;
            }

            startIndex = this.nodes.indexOf(originNode) + 1;
        }

        let insertIndex = startIndex;

        while (insertIndex < this.nodes.length) {
            const currentNode = this.nodes[insertIndex]!;
            
            if (this.compareIdentifiers(id, currentNode.id) > 0) {
                insertIndex++;
            } else {
                break;
            }
        }

        const newNode: RGANode<T> = {
            id,
            origin,
            value,
            isDeleted: false
        };

        this.nodeMap.set(idString, newNode);
        this.nodes.splice(insertIndex, 0, newNode);
        
        const pendingChildren = this.pendingQueue.get(idString);
        if(pendingChildren){
            this.pendingQueue.delete(idString);
            for (const child of pendingChildren) {
                this.insert(child.value, child.id, child.origin);
            }
        }
    }

    public delete(id: Identifier): void {
        const idString = this.getIdString(id);
        const node = this.nodeMap.get(idString);

        if (!node) {
            throw new Error(`Node not found for deletion: ${idString}`);
        }

        node.isDeleted = true;
    }

    public toArray(): T[] {
        const result: T[] = [];
        
        for (const node of this.nodes) {
            if (!node.isDeleted) {
                result.push(node.value);
            }
        }
        
        return result;
    }
}