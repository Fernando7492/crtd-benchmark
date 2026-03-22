import type { SyncStrategy } from "../core/strategy/types.js";
import type { INetworkClient } from "../network/INetworkClient.js";
import type { NetworkPayload } from "../network/types.js";

export class ClientManager<T>{
    constructor(
        private networkClient: INetworkClient,
        private syncStrategy: SyncStrategy<T>,
    ){

    }

    public connect(url: string): Promise<void>{
        this.networkClient.onReceive((payload)=>this.handleIncomingMessage(payload));
        return this.networkClient.connect(url);
    }

    private handleIncomingMessage(payload:NetworkPayload){
        this.syncStrategy.applyPayload(payload as T);
    }

    public async dispatchLocalOperation(payload: NetworkPayload){
        this.syncStrategy.applyPayload(payload as T);
        await this.networkClient.send(payload)
    }

    public disconnect(): Promise<void>{
        return this.networkClient.disconnect();
    }
}