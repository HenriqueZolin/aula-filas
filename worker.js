import { setTimeout } from 'node:timers/promises'
import { buscarCep, atualizarCep } from './db.js'
import { conectar, FILA_CEPS } from './rabbit/rabbit.js'

const DELAY_MS = Number(process.env.DELAY_MS ?? 0);
const VIACEP_URL = process.env.VIACEP_URL ?? 'https://viacep.com.br';

const { canal } = await conectar();

await canal.prefetch(1);
console.log(`[PID ${process.pid}] aguardando mensagens`);

const handler = async (msg) => {
    const { id } = JSON.parse(msg.content.toString());
    console.log(`[PID ${process.pid}] recebeu id ${id}`);

    try {
        const registro = buscarCep(id);

        if (!registro) {
            console.warn(`[PID ${process.pid}] id ${id} não existe no banco, descartando`);
            canal.ack(msg);
            return;
        }

        atualizarCep(id, 'processando');

        await setTimeout(DELAY_MS);
        const resp = await fetch(`${VIACEP_URL}/ws/${registro.cep}/json/`,
            { signal: AbortSignal.timeout(5000) }
        );

        // Erro transitório: a API externa falhou. Tentar de novo pode resolver, então vai para a DLQ.
        if (!resp.ok) {
            console.log(`[PID ${process.pid}] ViaCEP respondeu ${resp.status}`);
            atualizarCep(id, 'erro', null, `ViaCEP respondeu ${resp.status}`);
            canal.nack(msg, false, false);
            return;
        }

        const dados = await resp.json();

        // Erro permanente: o CEP não existe. Tentar de novo não adianta, então confirma.
        if (dados.erro) {
            atualizarCep(id, 'erro', null, 'CEP não encontrado');
        } else {
            atualizarCep(id, 'concluido', dados);
        }
        canal.ack(msg);
    } catch (error) {
        console.error(`[PID ${process.pid}] falhou id ${id}:`, error.message);
        atualizarCep(id, 'erro', null, error.message);
        canal.nack(msg, false, false);
    }
}

canal.consume(FILA_CEPS, handler, { noAck: false });
