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

## Etapa 2: API (producer)

```bash
npm run api
```

Em outro terminal, com **nenhum worker rodando**:

```bash
npm run lote -- 5
```

O script manda 5 CEPs (válidos, um inexistente e um inválido). A resposta é **202** com o id de cada CEP aceito e o motivo de cada rejeitado. Consulte um deles:

```bash
curl http://localhost:3000/cep/1
```

O status fica `pendente` e o painel mostra as mensagens **acumuladas** na fila. Sem ninguém consumindo, o trabalho não se perde: ele espera.

Para pensar:
- Por que a API grava no banco **antes** de publicar? E se a publicação falhar depois do insert?
- Por que a mensagem leva só o id, e não os dados do CEP?
- Por que 202 e não 200?

## Etapa 3: worker (consumer)

Com a API rodando e as mensagens da etapa 2 ainda na fila:

```bash
npm run worker
```

A fila esvazia e cada CEP passa de `pendente` para `processando` e depois `concluido` (ou `erro`, para o CEP inexistente). Consulte com `GET /cep/:id`.

O que observar no código:
- **Ack manual**: a mensagem só sai da fila depois do `canal.ack`. Se o worker morrer antes, ela volta.
- **`prefetch(1)`**: o worker pega uma mensagem por vez e só recebe a próxima depois de confirmar a atual.
- **Pegadinha do ViaCEP**: CEP inexistente volta com HTTP 200 e `"erro": "true"` no corpo.

Para pensar: o `catch` faz `nack` com requeue. O que acontece se o ViaCEP estiver fora do ar?

## Etapa 4: lentidão, erros e dead letter queue

⚠️ Ao subir esta etapa, a API ou o worker vai cair com `PRECONDITION_FAILED - inequivalent arg 'x-dead-letter-exchange'`. A fila `ceps` já existe sem DLQ e o Rabbit não deixa redeclarar com outra configuração. Apague a fila `ceps` no painel (**Queues → ceps → Delete**) e suba de novo.

Novas variáveis no `.env` (veja o `.env.example`):

| Variável | Para quê |
|---|---|
| `DELAY_MS` | Espera artificial antes de chamar o ViaCEP. Com `3000`, cada CEP leva 3 segundos. |
| `VIACEP_URL` | Base da API de CEP. Com `http://localhost:1`, toda chamada falha. |

**Lentidão:** com `DELAY_MS=3000`, mande um lote e consulte um id durante a espera. O status `processando` fica visível.

**Falha:** com `VIACEP_URL=http://localhost:1`, mande um lote. As mensagens vão para a fila `ceps.dlq` em vez de girar para sempre, e o status fica `erro` com o motivo. No painel, abra a `ceps.dlq` → **Get messages** e veja o header `x-death`.

Dois tipos de erro no worker:
- **Transitório** (rede, timeout, 5xx): `nack` sem requeue, a mensagem vai para a DLQ.
- **Permanente** (CEP inexistente): grava `erro` e confirma com `ack`. Tentar de novo não adianta.

Para pensar: na etapa 3, o `nack` devolvia a mensagem para a fila. Com o ViaCEP fora do ar, o que acontecia? E o que fazer com o que está na DLQ?

## Etapa 5: vários workers e planos B

### Escalar

Com `DELAY_MS=3000` no `.env`:

1. Desligue todos os workers e mande `npm run lote -- 30`. A fila acumula as mensagens (os CEPs `abc` são rejeitados pela API).
2. Suba **um** worker e faça a conta: cada CEP leva 3 segundos.
3. Suba mais dois, em outros terminais (`npm run worker`). Os logs mostram PIDs diferentes se alternando, o painel mostra 3 consumers e a fila esvazia três vezes mais rápido. A API não mudou nada.

### Derrubar um worker no meio

Durante a espera de um worker, aperte **Ctrl+C** nele. A mensagem que estava **Unacked** volta para **Ready** e outro worker processa. Como uma mensagem pode ser entregue mais de uma vez, o processamento precisa ser **idempotente**: atualizar o registro pelo id dá o mesmo resultado se rodar duas vezes.

### Prefetch é concorrência

Troque o `prefetch(1)` por `prefetch(10)` e mande 10 CEPs para um worker só. Os 10 são processados ao mesmo tempo. O prefetch é o limite de quantas mensagens cada worker processa em paralelo, e é ele que controla quantas chamadas simultâneas vão para o ViaCEP.

### Plano B: ViaCEP bloqueado

São 30 alunos saindo pelo mesmo IP. Se o ViaCEP bloquear a sala, use `VIACEP_URL=http://localhost:3000`: a própria API responde no mesmo formato do ViaCEP (o CEP `99999-999` continua "inexistente").

### Plano B: todo mundo consumindo a fila do professor

Cada aluno coloca `RABBIT_URL=amqp://usuario:senha@IP-DO-PROFESSOR` no `.env` e roda **só o worker** apontando para o banco e a API do professor, ou o `npm run consumir`, que só imprime a mensagem. Antes da aula:
- crie um usuário no `docker-compose.yml` com `RABBITMQ_DEFAULT_USER` e `RABBITMQ_DEFAULT_PASS`, em vez de expor `guest/guest` na rede;
- libere a porta 5672 no firewall e teste de outro computador.

## Comandos úteis

| Comando | O que faz |
|---|---|
| `docker compose stop` | Desliga o Rabbit e mantém as filas |
| `docker compose up -d` | Liga de novo |
| `docker compose down` | Apaga o container e as filas |
