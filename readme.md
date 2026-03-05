# CRDT Benchmark - Replicated Growable Array (RGA)

Este projeto implementa um ambiente de teste de estresse para um algoritmo CRDT (Replicated Growable Array), focado em avaliar a resiliência e o consumo de recursos sob condições de rede assíncronas e caóticas.

## Estrutura  do Teste

O benchmark avalia três estratégias de sincronização operando sobre dois protocolos de rede diferentes (WebSocket e TCP Raw) e duas bases de dados (PostgreSQL e MongoDB):
- STATE: Transmissão de todo o estado da árvore RGA a cada alteração.
- OPERATION: Transmissão apenas da operação (Inserção/Deleção) e do nó afetado.
- DELTA: Transmissão apenas dos nós que sofreram mutação desde a última sincronização.

O simulador introduz latência e jitter artificiais na camada de rede para provocar quebras de causalidade (nós chegando fora de ordem ou exclusões prematuras) e provar a convergência determinística do RGA.

## Requisitos

- Node.js
- Docker e Docker Compose
- TypeScript / tsx

## Configuração do Ambiente

1. Variáveis de Ambiente
Crie um arquivo chamado .env na raiz do projeto e adicione as URLs de conexão com as bases de dados locais:
DATABASE_URL="postgresql://admin:password123@localhost:5432/crdt_benchmark?schema=public"
MONGO_URI="mongodb://127.0.0.1:27017/crdt_benchmark?replicaSet=rs0"

2. Infraestrutura
Inicie os containers do PostgreSQL e do MongoDB em segundo plano:
docker compose up -d

Nota importante: O ambiente inclui um container efêmero (mongo_setup) que configura o MongoDB como um Replica Set, requisito para suportar transações ACID. Aguarde cerca de 5 segundos após a inicialização para que a rede Docker conclua esta configuração antes de avançar para o próximo passo.

3. Instalação e Base de Dados
Instale as dependências e construa as tabelas do Prisma (exige que o container do PostgreSQL já esteja a funcionando):
npm install
npx prisma generate --schema ./src/prisma/schema.prisma
npx prisma db push --accept-data-loss --schema ./src/prisma/schema.prisma

## Execução

Para rodar a bateria de testes, execute o script principal:
npx tsx src/index.ts

## Resultados

Após a execução, o projeto gerará um arquivo na raiz chamado "resultados_benchmark.csv". 
Ele contém as métricas de tempo de convergência, mensagens trafegadas, consumo de largura de banda e overhead de metadados em memória para todos os cenários, abrangendo as diferentes estratégias, protocolos, bases de dados e cargas de 1 a 1000 bots simultâneos.