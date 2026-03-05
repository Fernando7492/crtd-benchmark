import type { SyncStrategy } from "../core/strategy/types.js";
import type{ INetworkServer } from "../network/INetworkServer.js";
import type { NetworkPayload } from "../network/types.js";
import type { DocumentRepository } from "../repository/DocumentRepository.js";
export class ServerManager<T>{
    constructor(
        private networkServer: INetworkServer,
        private documentRepository: DocumentRepository,
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
         await this.documentRepository.saveEvent(
                this.documentId,
                this.syncStrategy.strategyName,
                payload);
        await this.networkServer.broadcast(payload, clientId)
    }

    public async stop(){
        await this.networkServer.stop()
    }
}