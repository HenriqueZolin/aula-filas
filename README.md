# Não me faça esperar: filas com RabbitMQ e Node.js

Projeto da aula. Uma API recebe uma lista de CEPs, responde na hora e coloca cada CEP numa fila. Um worker consome a fila, consulta o ViaCEP e grava o resultado no banco. A API permite consultar o status depois.

```
cliente ──POST /cep──▶ API ──▶ fila "ceps" ──▶ worker ──▶ ViaCEP
   │                    │                        │
   └──GET /cep/:id──────┴──────── SQLite ◀───────┘
```

## Pré-requisitos

- Node.js 22.13 ou mais novo (`node --version`)
- Docker

## Etapas

Cada etapa é uma tag. Se você travar, pule para a próxima:

```bash
git checkout etapa-3
```

| Tag | O que tem |
|---|---|
| `etapa-1` | RabbitMQ no ar, publicar e consumir uma mensagem |
| `etapa-2` | Banco e API (producer): mensagens acumulando na fila |
| `etapa-3` | Worker (consumer) consultando o ViaCEP |
| `etapa-4` | Lentidão simulada, tipos de erro e dead letter queue |
| `etapa-5` | Vários workers e planos B para a sala |

Configuração por variáveis de ambiente: copie o `.env.example` para `.env` e ajuste. Uma variável definida no terminal vale mais que a do `.env`.

## Etapa 1: RabbitMQ no ar

```bash
docker compose up -d
npm install
cp .env.example .env
```

Painel: http://localhost:15672 (usuário `guest`, senha `guest`). Deixe a aba **Queues** aberta.

1. Rode `npm run publicar` três vezes. A fila `ceps` aparece com **Ready: 3**.
2. Rode `npm run consumir`. As três mensagens chegam e a fila zera. O processo continua aberto esperando mais (Ctrl+C para sair).
3. Com o consumidor aberto, publique de novo em outro terminal. A mensagem chega na hora.

Para pensar: `durable` (a fila sobrevive a um restart do Rabbit) e `persistent` (a mensagem sobrevive) são coisas diferentes. Teste com `docker compose restart`.
