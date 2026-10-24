import amqp from 'amqplib'

export const FILA_CEPS = 'ceps';
export const FILA_CEPS_DLQ = 'ceps.dlq';
export const EXCHANGE_DLX = 'ceps.dlx';

export async function conectar() {
    const conexao = await amqp.connect(process.env.RABBIT_URL ?? 'amqp://localhost');
    const canal = await conexao.createConfirmChannel();

    await canal.assertExchange(EXCHANGE_DLX, 'fanout', { durable: true });
    await canal.assertQueue(FILA_CEPS_DLQ, { durable: true });
    await canal.bindQueue(FILA_CEPS_DLQ, EXCHANGE_DLX, '');

    await canal.assertQueue(FILA_CEPS, { durable: true, deadLetterExchange: EXCHANGE_DLX });

    return { conexao, canal };
}

export function publicarConsulta(canal, id) {
    canal.sendToQueue(FILA_CEPS, Buffer.from(JSON.stringify({ id })), { persistent: true });
}
