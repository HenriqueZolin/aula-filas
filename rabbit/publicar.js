import { conectar, publicarConsulta } from './rabbit.js'

const { conexao, canal } = await conectar();

publicarConsulta(canal, 1);
await canal.waitForConfirms();
console.log('Publicado');
await conexao.close();
