import "dotenv/config";
import * as fs from "node:fs";
import { runBenchmark } from "./simulation/BenchmarkRunner.js";
import type { DatabaseType, LatencyScenario, ProtocolType, StrategyType } from "./simulation/types.js";

function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

async function runAllTests() {
    const outputDir = "resultados";
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    const csvFile = `${outputDir}/resultados_benchmark.csv`;

    if (!fs.existsSync(csvFile)) {
        fs.writeFileSync(csvFile, "Round,Strategy,Protocol,Database,Bots,LatencyScenario,MinLatency,MaxLatency,ConvergenceTimeMs,TotalMessages,NetworkBytes,MemorySizeBytes,MetadataOverheadBytes\n");
    }

    const protocols: ProtocolType[] = ['WS', 'TCP_RAW', 'GRPC', 'WT'];
    const botCounts = [1, 100, 500, 1000];
    const databases: DatabaseType[] = ['postgres'];
    const strategies: StrategyType[] = ['STATE', 'OPERATION', 'DELTA'];
    const latencyScenarios: LatencyScenario[] = [
        { label: 'LOCAL',            minLatency: 0,    maxLatency: 0    },
        { label: 'REGIONAL',         minLatency: 900,  maxLatency: 1000 },
        { label: 'INTERCONTINENTAL', minLatency: 1000, maxLatency: 2000 },
    ];

    const totalRounds = 20;
    const globalStart = Date.now();

    for (let round = 1; round <= totalRounds; round++) {
        console.log(`\n=== RODADA ${round}/${totalRounds} ===`);

        for (const protocol of protocols) {
            for (const database of databases) {
                for (const bots of botCounts) {
                    for (const strategy of strategies) {
                        for (const latency of latencyScenarios) {
                            process.stdout.write(`[R${round}] [${protocol}] [${database}] ${strategy} com ${bots} bots (Latencia ${latency.label}: ${latency.minLatency}-${latency.maxLatency}ms)... `);

                            try {
                                const metrics = await runBenchmark(round, bots, strategy, protocol, database, latency);

                                const csvLine = `${metrics.round},${metrics.strategy},${metrics.protocol},${metrics.database},${metrics.bots},${metrics.latencyScenario},${metrics.minLatency},${metrics.maxLatency},${metrics.convergenceTimeMs.toFixed(2)},${metrics.totalMessages},${metrics.networkBytes},${metrics.memorySizeByes},${metrics.metadataOverheadBytes}\n`;

                                fs.appendFileSync(csvFile, csvLine);
                                console.log(`OK (${metrics.convergenceTimeMs.toFixed(2)}ms)`);
                            } catch (error) {
                                console.log(`FALHA`);
                                console.error(error);
                            }
                        }
                    }
                }
            }

            // Intervalo entre grupos de protocolo para estabilização de CPU/memória
            console.log(`\n[Aguardando 10s para estabilização após grupo ${protocol}...]`);
            await new Promise(r => setTimeout(r, 10_000));
        }
    }

    const totalElapsed = Date.now() - globalStart;
    console.log(`\nTodos os testes finalizados em ${formatDuration(totalElapsed)}. Verifique o arquivo resultados_benchmark.csv`);
    process.exit(0);
}

runAllTests();
