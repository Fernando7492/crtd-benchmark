export type ProtocolType = 'WS' | 'TCP_RAW' | 'GRPC' | 'WT';
export type StrategyType = 'STATE' | 'OPERATION' | 'DELTA';
export type DatabaseType = 'postgres';

export interface LatencyScenario {
    label: string;
    minLatency: number;
    maxLatency: number;
}

export interface BenchmarkMetrics {
    round: number;
    strategy: string;
    protocol: string;
    database: string;
    bots: number;
    latencyScenario: string;
    minLatency: number;
    maxLatency: number;
    convergenceTimeMs: number;
    totalMessages: number;
    networkBytes: number;
    memorySizeByes: number;
    metadataOverheadBytes: number;
}
