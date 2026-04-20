import { list } from '@vercel/blob';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    res.status(400).send('<html><body><h1>ID nao informado</h1></body></html>');
    return;
  }

  try {
    const { blobs } = await list({ prefix: `roteiros/${id}.html` });

    if (!blobs || blobs.length === 0) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Roteiro em preparação</title>
          <style>
            body { font-family: sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
            h1 { color: #00BCD4; }
            p { color: #6B7280; line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>Roteiro em preparação</h1>
          <p>Seu roteiro ainda está sendo gerado. Aguarde alguns minutos e atualize a página.</p>
          <p>Se já se passaram mais de 30 minutos, entre em contato conosco.</p>
        </body>
        </html>
      `);
      return;
    }

    // Registrar acesso no Airtable (sem bloquear a resposta)
    registrarAcesso(id).catch(() => {});

    const response = await fetch(blobs[0].url);
    const html = await response.text();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    res.status(500).send('<html><body><h1>Erro</h1><p>' + err.message + '</p></body></html>');
  }
}

async function registrarAcesso(roteiroId) {
  try {
    // Buscar registro pelo Roteiro_ID
    const searchUrl = 'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/Pedidos?filterByFormula=' + encodeURIComponent("{Roteiro_ID}='" + roteiroId + "'") + '&maxRecords=1';
    const searchRes = await fetch(searchUrl, {
      headers: { 'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN }
    });
    const searchData = await searchRes.json();

    if (!searchData.records || searchData.records.length === 0) return;

    const record = searchData.records[0];
    const recordId = record.id;
    const acessosAtual = record.fields.Acessos || '';

    // Formatar data/hora atual (horário de Brasília)
    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Adicionar novo acesso (acumula, separado por " | ")
    const novosAcessos = acessosAtual ? acessosAtual + ' | ' + agora : agora;

    // Atualizar Airtable
    await fetch(
      'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/Pedidos/' + recordId,
      {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: { Acessos: novosAcessos } })
      }
    );
  } catch (e) {
    // Silencioso - não bloqueia o roteiro se falhar
  }
}
