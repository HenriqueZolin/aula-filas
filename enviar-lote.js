// Uso: npm run lote -- 30   (envia 30 CEPs misturando válidos, inexistente e inválido)
const quantidade = Number(process.argv[2] ?? 5);
const exemplos = ['01001-000', '87200260', '20040-002', '99999-999', 'abc'];
const ceps = Array.from({ length: quantidade }, (_, i) => exemplos[i % exemplos.length]);

const resp = await fetch(`${process.env.API_URL ?? 'http://localhost:3000'}/cep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ceps }),
});
console.log(resp.status, JSON.stringify(await resp.json(), null, 2));
