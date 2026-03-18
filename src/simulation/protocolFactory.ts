import { RGA } from "../core/rga/index.js";
import { DeltaStrategy } from "../core/strategy/DeltaStrategy.js";
import { OperationStrategy } from "../core/strategy/OperationStrategy.js";
import { StateStrategy } from "../core/strategy/StateStrategy.js";
import type { SyncStrategy } from "../core/strategy/types.js";
import { WebSocketClient } from "../network/adapters/webSocketClient.js";
import { WebSocketServer } from "../network/adapters/webSocketServer.js";
import { TcpClient } from "../network/adapters/tcpRawClient.js";
import { TcpServer } from "../network/adapters/tcpRawServer.js";
import { GrpcClient } from "../network/adapters/grpcClient.js";
import { GrpcServer } from "../network/adapters/grpcServer.js";
import { WebTransportClient } from "../network/adapters/webTransportClient.js";
import { WebTransportServer } from "../network/adapters/webTransportServer.js";
import type { INetworkClient } from "../network/INetworkClient.js";
import type { INetworkServer } from "../network/INetworkServer.js";
import type { ProtocolType, StrategyType } from "./types.js";

const CONNECT_URLS: Record<ProtocolType, string> = {
    WS: "ws://localhost:8080",
    TCP_RAW: "tcp://localhost:8080",
    GRPC: "grpc://localhost:8080",
    WT: "webtransport://localhost:8080",
};

export function createServer(protocol: ProtocolType): INetworkServer {
    switch (protocol) {
        case "WS":      return new WebSocketServer();
        case "TCP_RAW": return new TcpServer();
        case "GRPC":    return new GrpcServer();
        case "WT":      return new WebTransportServer();
    }
}

export function createClient(protocol: ProtocolType): INetworkClient {
    switch (protocol) {
        case "WS":      return new WebSocketClient();
        case "TCP_RAW": return new TcpClient();
        case "GRPC":    return new GrpcClient();
        case "WT":      return new WebTransportClient();
    }
}

export function createStrategy(type: StrategyType, rga: RGA<string>): SyncStrategy<any, any> {
    switch (type) {
        case "STATE":     return new StateStrategy(rga);
        case "OPERATION": return new OperationStrategy(rga);
        case "DELTA":     return new DeltaStrategy(rga);
    }
}

export function getConnectUrl(protocol: ProtocolType): string {
    return CONNECT_URLS[protocol];
}
