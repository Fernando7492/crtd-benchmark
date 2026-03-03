import type { RGA } from "../rga/index.js";
import type { RGANode, PendingInsert } from "../types.js";

export class StateBasedSync<T> {
  private rga: RGA<T>;

  constructor(rga: RGA<T>) {
    this.rga = rga;
  }

  public exportState(): RGANode<T>[] {
    return [...this.rga.getNodes()];
  }

  public merge(remoteNodes: RGANode<T>[]): void {
    const localNodeMap = this.rga.getNodeMap();

    for (const remoteNode of remoteNodes) {
      const idString = this.rga.getIdString(remoteNode.id);
      const localNode = localNodeMap.get(idString);

      if (localNode) {
        if (remoteNode.isDeleted) {
          localNode.isDeleted = true;
        }
      } else {
        this.applyRemoteNode(remoteNode);
      }
    }
  }

  private applyRemoteNode(node: RGANode<T>): void {
    const idString = this.rga.getIdString(node.id);
    const localNodes = this.rga.getNodes();
    const localNodeMap = this.rga.getNodeMap();
    const pendingQueue = this.rga.getPendingQueue();

    let startIndex = 0;

    if (node.origin !== null) {
      const originString = this.rga.getIdString(node.origin);
      const originNode = localNodeMap.get(originString);

      if (!originNode) {
        const pendingNode: PendingInsert<T> = {
          id: node.id,
          origin: node.origin,
          value: node.value,
        };
        const originPending = pendingQueue.get(originString);
        if (!originPending) {
          pendingQueue.set(originString, [pendingNode]);
        } else {
          originPending.push(pendingNode);
        }
        return;
      }

      startIndex = localNodes.indexOf(originNode) + 1;
    }
    let insertIndex = startIndex;
    while (insertIndex < localNodes.length) {
      const currentNode = localNodes[insertIndex]!;
      if (this.rga.compareIdentifiers(node.id, currentNode.id) > 0) {
        insertIndex++;
      } else {
        break;
      }
    }
    const newNode: RGANode<T> = {
      id: node.id,
      origin: node.origin,
      value: node.value,
      isDeleted: node.isDeleted,
    };

    this.rga.setNodeInMap(idString, newNode);
    this.rga.addNodeAtIndex(insertIndex, newNode);
    const pendingChildren = pendingQueue.get(idString);
    if (pendingChildren) {
      pendingQueue.delete(idString);
      for (const child of pendingChildren) {
        this.rga.insert(child.value, child.id, child.origin);
      }
    }
  }
}
