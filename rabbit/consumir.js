import { conectar, FILA_CEPS } from './rabbit.js'

const { canal } = await conectar();
console.log('Aguardando mensagens');

canal.consume(FILA_CEPS, (msg) => {
    const conteudo = JSON.parse(msg.content.toString());
    console.log('Mensagem recebida:', conteudo);
    canal.ack(msg);
});
