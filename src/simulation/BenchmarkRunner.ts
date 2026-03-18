import { performance } from "node:perf_hooks";
import { RGA } from "../core/rga/index.js";
import type { Identifier } from "../core/types.js";
import { createDocumentRepository } from "../repository/index.js";
import { ClientManager } from "../server/ClientManager.js";
import { ServerManager } from "../server/ServerManager.js";
import { ChaosNetworkClient } from "./ChaosNetworkClient.js";
import { createClient, createServer, createStrategy, getConnectUrl } from "./protocolFactory.js";
import type { BenchmarkMetrics, DatabaseType, LatencyScenario, ProtocolType, StrategyType } from "./types.js";

export async function runBenchmark(
    round: number,
    botCount: number,
    strategyType: StrategyType,
    protocolType: ProtocolType,
    databaseType: DatabaseType,
    chaosConfig: LatencyScenario
): Promise<BenchmarkMetrics> {
    const repo = createDocumentRepository(databaseType);
    const doc = await repo.createDocument("Benchmark Stress Test");
    const docId = doc.id;

    const networkServer = createServer(protocolType);
    const serverRga = new RGA<string>();
    const serverStrategy = createStrategy(strategyType, serverRga);

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
        strategy: ReturnType<typeof createStrategy>,
        id: string
    }[] = [];

    for (let i = 0; i < botCount; i++) {
        const botId = `bot-${i}`;
        const botRga = new RGA<string>();
        const botStrategy = createStrategy(strategyType, botRga);

        const testClient = new ChaosNetworkClient(
            createClient(protocolType),
            `seed-${botId}`,
            chaosConfig.minLatency,
            chaosConfig.maxLatency
        );

        const clientManager = new ClientManager(testClient, botStrategy);
        await clientManager.connect(getConnectUrl(protocolType));

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
                    payload = bot.strategy.generatePayload({ type: 'DELETE' as const, node: { ...randomNode, isDeleted: true } });
                } else {
                    bot.rga.delete(randomNode.id);
                    payload = bot.strategy.generatePayload(undefined);
                }
            } else {
                totalInsertions++;
                const origin = rawNodes.length > 0 ? rawNodes[Math.floor(Math.random() * rawNodes.length)]!.id : null;
                const value = `[${bot.id}-${seq}]`;

                if (strategyType === 'OPERATION') {
                    payload = bot.strategy.generatePayload({ type: 'INSERT' as const, node: { id: opId, origin, value, isDeleted: false } });
                } else {
                    bot.rga.insert(value, opId, origin);
                    payload = bot.strategy.generatePayload(undefined);
                }
            }

            totalNetworkBytes += Buffer.byteLength(JSON.stringify(payload));
            totalMessages += 1;
            bot.manager.dispatchLocalOperation(payload);
        }
    }

    await (async function waitForConvergence() {
        while (true) {
            if (serverRga.getRawState().length === totalInsertions) {
                const serverRawStateStr = JSON.stringify(serverRga.getRawState());
                const allSynced = botEntries.every(b =>
                    b.rga.getRawState().length === totalInsertions &&
                    JSON.stringify(b.rga.getRawState()) === serverRawStateStr
                );
                if (allSynced) break;
            }
            await new Promise(r => setTimeout(r, 50));
        }
    })();

    const endTime = performance.now();

    for (const bot of botEntries) await bot.manager.disconnect();
    botEntries.length = 0;
    await serverManager.stop();
    await repo.disconnect();

    if (typeof (global as any).gc === 'function') (global as any).gc();

    // Aguarda o OS liberar os file descriptors dos sockets (TIME_WAIT)
    // proporcional ao número de conexões abertas no cenário
    if (botCount >= 1000) await new Promise(r => setTimeout(r, 5000));
    else if (botCount >= 500) await new Promise(r => setTimeout(r, 2000));

    const rawDataBytes = Buffer.byteLength(serverRga.toArray().join(''));
    const memorySizeBytes = Buffer.byteLength(JSON.stringify(serverRga.getRawState()));

    return {
        round,
        strategy: strategyType,
        protocol: protocolType,
        database: databaseType,
        bots: botCount,
        latencyScenario: chaosConfig.label,
        minLatency: chaosConfig.minLatency,
        maxLatency: chaosConfig.maxLatency,
        convergenceTimeMs: endTime - startTime,
        totalMessages,
        networkBytes: totalNetworkBytes,
        memorySizeByes: memorySizeBytes,
        metadataOverheadBytes: memorySizeBytes - rawDataBytes,
    };
}
