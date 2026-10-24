import express from 'express'
import { adicionarCep, buscarCep } from './db.js'
import { conectar, publicarConsulta } from './rabbit/rabbit.js'

const app = express();
const port = process.env.PORT ?? 3000;
const LIMITE_LOTE = 100;
app.use(express.json())

const { canal } = await conectar();

app.post('/cep', (req, res) => {
    const ceps = req.body?.ceps;

    if (!Array.isArray(ceps) || ceps.length === 0) {
        return res.status(400).json({ erro: 'Envie { "ceps": [...] } com pelo menos um CEP.' });
    }

    if (ceps.length > LIMITE_LOTE) {
        return res.status(400).json({ erro: `Envie no máximo ${LIMITE_LOTE} CEPs por vez.` });
    }

    const cepsValidos = [];
    const cepsInvalidos = [];
    for (const cep of ceps) {
        if (typeof cep !== 'string' || !/^\d{5}-?\d{3}$/.test(cep)) {
            cepsInvalidos.push({ cep, motivo: 'formato inválido' });
            continue;
        }
        const cepLimpo = cep.replace('-', '');

        const id = adicionarCep(cepLimpo);
        publicarConsulta(canal, id);
        cepsValidos.push({ id, cep: cepLimpo });
    }

    if (cepsValidos.length === 0) {
        return res.status(400).json({ erros: cepsInvalidos });
    }

    return res.status(202).json({
        cepsProcessados: cepsValidos,
        erros: cepsInvalidos
    });
})

app.get('/cep/:id', (req, res) => {
    const cep = buscarCep(req.params.id);
    if (!cep) {
        return res.status(404).json({ erro: 'CEP não encontrado' })
    }

    return res.status(200).json({
        cep: cep.cep,
        status: cep.status,
        dados: cep.dados,
        erro: cep.erro
    })
})

// Plano B: imita o ViaCEP se a API real bloquear a rede da sala (VIACEP_URL=http://localhost:3000)
app.get('/ws/:cep/json', (req, res) => {
    if (req.params.cep === '99999999') {
        return res.json({ erro: 'true' });
    }
    res.json({ cep: req.params.cep, logradouro: 'Rua da Fila', bairro: 'Centro', localidade: 'Cidade da Aula', uf: 'PR' });
})

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`)
})
