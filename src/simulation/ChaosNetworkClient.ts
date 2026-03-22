import seedrandom from "seedrandom";
import type { INetworkClient } from "../network/INetworkClient.js";
import type { NetworkPayload } from "../network/types.js";

export class ChaosNetworkClient implements INetworkClient{
    private prng: seedrandom.PRNG;
    private timeList = new Set<NodeJS.Timeout>();

    constructor(
        private realNetworkClient: INetworkClient,
        private seed: string,
        private minLatency: number = 0,
        private maxLatency: number = 0
    ) {
        this.prng = seedrandom(this.seed);
    }

    connect(connectUrl: string): Promise<void> {
        return this.realNetworkClient.connect(connectUrl);
    }
    send(payload: NetworkPayload): Promise<void> {
        const range = this.maxLatency - this.minLatency;
        const delay = this.minLatency + (range > 0 ? Math.floor(this.prng() * (range + 1)) : 0);
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