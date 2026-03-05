import seedrandom from "seedrandom";
import type { INetworkClient } from "../network/INetworkClient.js";
import type { NetworkPayload } from "../network/types.js";

export class ChaosNetworkClient implements INetworkClient{
    private prng: seedrandom.PRNG;
    private timeList = new Set<NodeJS.Timeout>();

    constructor(
        private realNetworkClient: INetworkClient, 
        private seed: string,
        private baseLatency: number = 0, 
        private jitter:number = 100
    )
        {
        this.prng = seedrandom(seed);
    }

    connect(connectUrl: string): Promise<void> {
        return this.realNetworkClient.connect(connectUrl);
    }
    send(payload: NetworkPayload): Promise<void> {
        const delay = this.baseLatency + (Math.floor(this.prng() * this.jitter));
        const timeout = setTimeout(()=>{
            this.realNetworkClient.send(payload)
            .catch(console.error)
            .finally(() => this.timeList.delete(timeout));
        },delay);

        this.timeList.add(timeout);
        return Promise.resolve();
    }
    onReceive(callback: (payload: NetworkPayload) => void): void {
        this.realNetworkClient.onReceive(callback);
    }
    disconnect(): Promise<void> {
        for(const timeoutId of this.timeList){
            clearTimeout(timeoutId);
        }
        this.timeList.clear();
        return this.realNetworkClient.disconnect();
    }
    
}