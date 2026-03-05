# CRDT Benchmark - Replicated Growable Array (RGA)

Este projeto implementa um am biente de teste de estresse para um algoritmo CRDT (Replicated Growable Array), focado em avaliar a resiliência e o consumo de recursos sob condições de rede assíncronas e caóticas.

## Estrutura  do Teste

O benchmark avalia três estratégias de sincronização:
- STATE: Transmissão de todo o estado da árvore RGA a cada alteração.
- OPERATION: Transmissão apenas da operação (Inserção/Deleção) e do nó afetado.
- DELTA: Transmissão apenas dos nós que sofreram mutação desde a última sincronização.

O simulador introduz latência e jitter artificiais na camada de WebSockets para provocar quebras de causalidade (nós chegando fora de ordem ou exclusões prematuras) e provar a convergência determinística do RGA.

## Requisitos

- Node.js
- Docker e Docker Compose
- TypeScript / tsx

## Configuração do Ambiente

1. Variáveis de Ambiente
Crie um arquivo chamado .env na raiz do projeto e adicione a URL de conexão com o banco de dados local:
DATABASE_URL="postgresql://admin:password123@localhost:5432/crdt_benchmark?schema=public"

2. Infraestrutura
Inicie o container do PostgreSQL em segundo plano:
docker compose up -d

3. Instalação e Banco de Dados
Instale as dependências e construa as tabelas do Prisma:
npm install
npx prisma generate
npx prisma db push --accept-data-loss

## Execução

Para rodar a bateria de testes, execute o script principal:
npx tsx src/index.ts

## Resultados

Após a execução, o projeto gerará um arquivo na raiz chamado "resultados_benchmark.csv". 
Ele contém as métricas de tempo de convergência, mensagens trafegadas, consumo de largura de banda e overhead de metadados em memória para todos os cenários (1 a 500 bots simultâneos).