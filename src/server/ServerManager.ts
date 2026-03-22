import type { SyncStrategy } from "../core/strategy/types.js";
import type{ INetworkServer } from "../network/INetworkServer.js";
import type { NetworkPayload } from "../network/types.js";
import type { IDocumentRepository } from "../repository/IDocumentRepository.js";
export class ServerManager<T>{
    private pendingSaves: Promise<any>[]=[];
    constructor(
        private networkServer: INetworkServer,
        private documentRepository: IDocumentRepository,
        private syncStrategy: SyncStrategy<T>,
        private documentId: string 
    ){

    }

    public async start(port:number){
        this.networkServer.onReceive((clientId,payload)=>this.handleIncomingMessage(clientId,payload))
        await this.networkServer.start(port);
    }

    private async handleIncomingMessage(clientId: string, payload: NetworkPayload){
        this.syncStrategy.applyPayload(payload as T);
        const savePromise = this.documentRepository.saveEvent(
                this.documentId,
                this.syncStrategy.strategyName,
                payload).catch(console.error);
        
        const trackedPromise = savePromise.finally(() => {
            const index = this.pendingSaves.indexOf(trackedPromise);
            if (index > -1) this.pendingSaves.splice(index, 1);
        });
        
        this.pendingSaves.push(trackedPromise);
        await this.networkServer.broadcast(payload, clientId)
    }

    public async stop(){
        await Promise.all(this.pendingSaves);
        await this.networkServer.stop()
    }
}