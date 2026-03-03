import { RGA } from "../rga/index.js";
import type { StatePayload, SyncStrategy } from "./types.js";

export class StateStrategy<T> implements SyncStrategy<StatePayload<T>> {

    private rga: RGA<T>;

    constructor(rga: RGA<T>) {
        this.rga = rga;
    }

    public generatePayload(): StatePayload<T> {
        const payload: StatePayload<T> = {
            data: this.rga.getRawState(),
        };
        return payload;
  }

    public applyPayload(payload: StatePayload<T>): void {
        this.rga.applyRawState(payload.data);
  }
}
