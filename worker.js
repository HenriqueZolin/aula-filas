import { buscarCep, atualizarCep } from './db.js'
import { conectar, FILA_CEPS } from './rabbit/rabbit.js'

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

        const resp = await fetch(`https://viacep.com.br/ws/${registro.cep}/json/`,
            { signal: AbortSignal.timeout(5000) }
        );
        const dados = await resp.json();

        if (dados.erro) {
            atualizarCep(id, 'erro', null, 'CEP não encontrado');
        } else {
            atualizarCep(id, 'concluido', dados);
        }
        canal.ack(msg);
    } catch (error) {
        console.error(`[PID ${process.pid}] falhou id ${id}:`, error.message);
        // Devolve a mensagem para a fila. Na etapa 4 vamos ver o problema disso.
        canal.nack(msg);
    }
}

canal.consume(FILA_CEPS, handler, { noAck: false });
