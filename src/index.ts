import "dotenv/config";
import { performance } from "node:perf_hooks";
import * as fs from "node:fs";
import { RGA } from "./core/rga/index.js";
import { DeltaStrategy } from "./core/strategy/DeltaStrategy.js";
import { OperationStrategy } from "./core/strategy/OperationStrategy.js";
import { StateStrategy } from "./core/strategy/StateStrategy.js";
import type { SyncStrategy } from "./core/strategy/types.js";
import { WebSocketClient } from "./network/adapters/webSocketClient.js";
import { WebSocketServer } from "./network/adapters/webSocketServer.js";
import { TcpClient } from "./network/adapters/tcpRawClient.js";
import { TcpServer } from "./network/adapters/tcpRawServer.js";
import { GrpcClient } from "./network/adapters/grpcClient.js";
import { GrpcServer } from "./network/adapters/grpcServer.js";
import { WebTransportClient } from "./network/adapters/webTransportClient.js";
import { WebTransportServer } from "./network/adapters/webTransportServer.js";
import type { INetworkClient } from "./network/INetworkClient.js";
import type { INetworkServer } from "./network/INetworkServer.js";
import { createDocumentRepository } from "./repository/index.js";
import { ClientManager } from "./server/ClientManager.js";
import { ServerManager } from "./server/ServerManager.js";
import { ChaosNetworkClient } from "./simulation/ChaosNetworkClient.js";
import type { Identifier } from "./core/types.js";

interface BenchmarkMetrics {
    strategy: string;
    protocol: string;
    database: string;
    bots: number;
    latency: number;
    jitter: number;
    convergenceTimeMs: number;
    totalMessages: number;
    networkBytes: number;
    memorySizeByes: number;
    metadataOverheadBytes: number;
}

async function runBenchmark(
    botCount: number,
    strategyType: 'STATE' | 'OPERATION' | 'DELTA',
    protocolType: 'WS' | 'TCP_RAW' | 'GRPC' | 'WT',
    databaseType: 'postgres' | 'mongo',
    chaosConfig: { latency: number; jitter: number }
): Promise<BenchmarkMetrics> {
    const repo = createDocumentRepository(databaseType);
    const doc = await repo.createDocument("Benchmark Stress Test");
    const docId = doc.id;

    let networkServer: INetworkServer;

    if (protocolType === "WS") {
        networkServer = new WebSocketServer();
    } else if (protocolType === "TCP_RAW") {
        networkServer = new TcpServer();
    } else if (protocolType === "GRPC") {
        networkServer = new GrpcServer();
    } else if (protocolType === "WT") {
        networkServer = new WebTransportServer();
    } else {
        throw new Error(`Protocol ${protocolType} not implemented`);
    }

    const serverRga = new RGA<string>();
    let serverStrategy: SyncStrategy<any, any>;

    switch (strategyType) {
        case 'STATE': serverStrategy = new StateStrategy(serverRga); break;
        case 'OPERATION': serverStrategy = new OperationStrategy(serverRga); break;
        case 'DELTA': serverStrategy = new DeltaStrategy(serverRga); break;
    }

    let totalNetworkBytes = 0;
    let totalMessages = 0;

    const originalBroadcast = networkServer.broadcast.bind(networkServer);
    networkServer.broadcast = async (payload: any, excludeClientId?: string) => {
        const bytes = Buffer.byteLength(JSON.stringify(payload));
        const recipients = botCount - 1;
        totalNetworkBytes += bytes * recipients;
        totalMessages += recipients;
        return originalBroadcast(payload, excludeClientId);
    };

    const serverManager = new ServerManager(networkServer, repo, serverStrategy, docId);
    await serverManager.start(8080);

    const botEntries: {
        manager: ClientManager<any>,
        rga: RGA<string>,
        strategy: SyncStrategy<any, any>,
        id: string
    }[] = [];

    for (let i = 0; i < botCount; i++) {
        const botId = `bot-${i}`;
        const botRga = new RGA<string>();

        let botStrategy: SyncStrategy<any, any>;
        switch (strategyType) {
            case 'STATE': botStrategy = new StateStrategy(botRga); break;
            case 'OPERATION': botStrategy = new OperationStrategy(botRga); break;
            case 'DELTA': botStrategy = new DeltaStrategy(botRga); break;
        }

        let baseClient: INetworkClient;
        if (protocolType === "WS") {
            baseClient = new WebSocketClient();
        } else if (protocolType === "TCP_RAW") {
            baseClient = new TcpClient();
        } else if (protocolType === "GRPC") {
            baseClient = new GrpcClient();
        } else if (protocolType === "WT") {
            baseClient = new WebTransportClient();
        } else {
            throw new Error(`Protocol ${protocolType} not implemented`);
        }

        const testClient = new ChaosNetworkClient(
            baseClient,
            `seed-${botId}`,
            chaosConfig.latency,
            chaosConfig.jitter
        );

        const clientManager = new ClientManager(testClient, botStrategy);
        const connectUrl = protocolType === "WS" ? "ws://localhost:8080" : protocolType === "GRPC" ? "grpc://localhost:8080" : protocolType === "WT" ? "webtransport://localhost:8080" : "tcp://localhost:8080";
        await clientManager.connect(connectUrl);

        botEntries.push({ manager: clientManager, rga: botRga, strategy: botStrategy, id: botId });
    }

    const startTime = performance.now();
    const burstSize = 5;
    let totalInsertions = 0;

    for (const bot of botEntries) {
        for (let seq = 1; seq <= burstSize; seq++) {
            const opId: Identifier = { agentId: bot.id, seq };
            const rawNodes = bot.rga.getRawState();
            const isDelete = rawNodes.length > 0 && Math.random() < 0.3;

            let payload;
            if (isDelete) {
                const randomNode = rawNodes[Math.floor(Math.random() * rawNodes.length)]!;
                if (strategyType === 'OPERATION') {
                    const operation = {
                        type: 'DELETE' as const,
                        node: { ...randomNode, isDeleted: true }
                    };
                    payload = bot.strategy.generatePayload(operation);
                } else {
                    bot.rga.delete(randomNode.id);
                    payload = bot.strategy.generatePayload(undefined);
                }
            } else {
                totalInsertions++;
                const origin = rawNodes.length > 0 ? rawNodes[Math.floor(Math.random() * rawNodes.length)]!.id : null;
                const value = `[${bot.id}-${seq}]`;

                if (strategyType === 'OPERATION') {
                    const operation = {
                        type: 'INSERT' as const,
                        node: { id: opId, origin: origin, value, isDeleted: false }
                    };
                    payload = bot.strategy.generatePayload(operation);
                } else {
                    bot.rga.insert(value, opId, origin);
                    payload = bot.strategy.generatePayload(undefined);
                }
            }

            const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
            totalNetworkBytes += payloadBytes;
            totalMessages += 1;

            bot.manager.dispatchLocalOperation(payload);
        }
    }

    await (async function waitForConvergence() {
        while (true) {
            const serverRawStateStr = JSON.stringify(serverRga.getRawState());
            const serverNodesCount = serverRga.getRawState().length;

            if (serverNodesCount === totalInsertions) {
                const allBotsSynced = botEntries.every(b => JSON.stringify(b.rga.getRawState()) === serverRawStateStr);
                if (allBotsSynced) break;
            }
            await new Promise(r => setTimeout(r, 50));
        }
    })();

    const endTime = performance.now();

    for (const bot of botEntries) {
        await bot.manager.disconnect();
    }
    await serverManager.stop();
    await repo.disconnect();

    const rawDataStr = serverRga.toArray().join('');
    const rawDataBytes = Buffer.byteLength(rawDataStr);
    const memorySizeBytes = Buffer.byteLength(JSON.stringify(serverRga.getRawState()));
    const metadataOverheadBytes = memorySizeBytes - rawDataBytes;

    return {
        strategy: strategyType,
        protocol: protocolType,
        database: databaseType,
        bots: botCount,
        latency: chaosConfig.latency,
        jitter: chaosConfig.jitter,
        convergenceTimeMs: endTime - startTime,
        totalMessages: totalMessages,
        networkBytes: totalNetworkBytes,
        memorySizeByes: memorySizeBytes,
        metadataOverheadBytes: metadataOverheadBytes
    };
}

async function runAllTests() {
    const csvFile = "resultados_benchmark.csv";

    if (!fs.existsSync(csvFile)) {
        fs.writeFileSync(csvFile, "Strategy,Protocol,Database,Bots,Latency,Jitter,ConvergenceTimeMs,TotalMessages,NetworkBytes,MemorySizeBytes,MetadataOverheadBytes\n");
    }

    const protocols: Array<'WS' | 'TCP_RAW' | 'GRPC' | 'WT'> = ['WS', 'TCP_RAW', 'GRPC', 'WT'];
    const databases: Array<'postgres' | 'mongo'> = ['postgres', 'mongo'];
    const botCounts = [1, 5, 10, 50, 100];
    const strategies: Array<'STATE' | 'OPERATION' | 'DELTA'> = ['STATE', 'OPERATION', 'DELTA'];

    const scenarios: Array<{ bots: number, strategy: 'STATE' | 'OPERATION' | 'DELTA', protocol: 'WS' | 'TCP_RAW' | 'GRPC' | 'WT', database: 'postgres' | 'mongo', latency: number, jitter: number }> = [];

    for (const protocol of protocols) {
        for (const database of databases) {
            for (const bots of botCounts) {
                for (const strategy of strategies) {
                    scenarios.push({ bots, strategy, protocol, database, latency: 50, jitter: 100 });
                }
            }
        }
    }

    for (const scenario of scenarios) {
        process.stdout.write(`Rodando [${scenario.protocol}] [${scenario.database}] ${scenario.strategy} com ${scenario.bots} bots (Jitter: ${scenario.jitter}ms)... `);

        try {
            const metrics = await runBenchmark(scenario.bots, scenario.strategy, scenario.protocol, scenario.database, { latency: scenario.latency, jitter: scenario.jitter });

            const csvLine = `${metrics.strategy},${metrics.protocol},${metrics.database},${metrics.bots},${metrics.latency},${metrics.jitter},${metrics.convergenceTimeMs.toFixed(2)},${metrics.totalMessages},${metrics.networkBytes},${metrics.memorySizeByes},${metrics.metadataOverheadBytes}\n`;

            fs.appendFileSync(csvFile, csvLine);
            console.log(`OK (${metrics.convergenceTimeMs.toFixed(2)}ms)`);
        } catch (error) {
            console.log(`FALHA`);
            console.error(error);
        }
    }

    console.log("\nTodos os testes finalizados. Verifique o arquivo resultados_benchmark.csv");
    process.exit(0);
}

runAllTests();