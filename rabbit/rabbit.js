import amqp from 'amqplib'

export const FILA_CEPS = 'ceps';

export async function conectar() {
    const conexao = await amqp.connect(process.env.RABBIT_URL ?? 'amqp://localhost');
    const canal = await conexao.createConfirmChannel();
    await canal.assertQueue(FILA_CEPS, { durable: true });

    return { conexao, canal };
}

export function publicarConsulta(canal, id) {
    canal.sendToQueue(FILA_CEPS, Buffer.from(JSON.stringify({ id })), { persistent: true });
}
