var fetch = require('node-fetch');
var express = require('express');
var { put } = require('@vercel/blob');

var app = express();
app.use(express.json());

// CORS
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/', function(req, res) {
  res.json({ status: 'ok', service: 'Grupo Dicas Roteiro Generator' });
});

// Endpoint para gerar roteiro
app.post('/gerar', function(req, res) {
  var d = req.body;
  console.log('Recebido pedido de:', d.nome, '-', d.destino);

  // Responde imediatamente
  res.json({ success: true, message: 'Roteiro sendo gerado' });

  // Processa em segundo plano
  processarRoteiro(d).catch(function(err) {
    console.error('Erro fatal ao processar roteiro:', err.message);
  });
});

async function processarRoteiro(d) {
  console.log('Iniciando processamento para:', d.nome);

  // 1. Salvar no Airtable
  var recordId = null;
  try {
    var airtableRes = await fetch(
      'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/Pedidos',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [{
            fields: {
              Nome: d.nome || '',
              Email: d.email || '',
              Destino: d.destino || '',
              Data_Ida: d.dataChegada || '',
              Data_Volta: d.dataPartida || '',
              Duracao_Dias: Number(d.duracaoDias) || 0,
              Pessoas: Number(d.quantasPessoas) || 0,
              Viajantes: d.viajantes || '',
              Orcamento: d.orcamento || '',
              Interesses: d.interesses || '',
              Status: 'Gerando'
            }
          }]
        })
      }
    );
    var airtableData = await airtableRes.json();
    console.log('Airtable status:', airtableRes.status);
    if (airtableData.records && airtableData.records[0]) {
      recordId = airtableData.records[0].id;
      console.log('Airtable recordId:', recordId);
    } else {
      console.log('Airtable resposta inesperada:', JSON.stringify(airtableData).substring(0, 300));
    }
  } catch (e) {
    console.error('Airtable erro:', e.message);
  }

  var roteiroId = recordId || ('rot_' + Date.now());

  // 2. Chamar a Claude Opus
  console.log('Chamando Claude Opus para roteiroId:', roteiroId);
  var startTime = Date.now();

  var prompt = buildPrompt(d);

  try {
    console.log('Enviando request para API da Claude...');
    console.log('API Key existe:', !!process.env.ANTHROPIC_API_KEY);
    console.log('API Key inicio:', process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 12) : 'VAZIO');

    var claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 32000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    var elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log('Claude respondeu em ' + elapsed + ' segundos, status:', claudeResponse.status);

    var claudeText = await claudeResponse.text();
    console.log('Claude resposta tamanho:', claudeText.length, 'chars');
    console.log('Claude resposta inicio:', claudeText.substring(0, 200));

    var claudeData;
    try {
      claudeData = JSON.parse(claudeText);
    } catch (parseErr) {
      console.error('Erro ao parsear JSON da Claude:', parseErr.message);
      if (recordId) await atualizarAirtable(recordId, 'Erro');
      return;
    }

    if (!claudeData.content || !claudeData.content[0]) {
      console.error('Claude nao retornou conteudo:', JSON.stringify(claudeData).substring(0, 500));
      if (recordId) await atualizarAirtable(recordId, 'Erro');
      return;
    }

    var html = claudeData.content[0].text;
    html = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    console.log('HTML gerado com', html.length, 'caracteres');

    // 3. Salvar no Blob
    console.log('Salvando no Blob...');
    var blob = await put('roteiros/' + roteiroId + '.html', html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    console.log('Salvo no Blob:', blob.url);

    // 4. Enviar email
    console.log('Enviando email para:', d.email);
    var nomeFirst = d.nome ? d.nome.split(' ')[0] : 'Viajante';
    try {
      var emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Grupo Dicas <onboarding@resend.dev>',
          to: [d.email],
          subject: '\uD83C\uDF89 Seu roteiro personalizado est\u00E1 pronto!',
          html: '<div style="font-family:Poppins,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">'
            + '<div style="text-align:center;margin-bottom:30px;">'
            + '<h1 style="color:#00BCD4;font-size:28px;">GRUPO<span style="color:#E91E8C;">DICAS</span></h1>'
            + '</div>'
            + '<h2 style="color:#1A1A2E;">Ol\u00E1, ' + nomeFirst + '! \uD83C\uDF89</h2>'
            + '<p style="color:#6B7280;font-size:16px;line-height:1.6;">O seu roteiro personalizado est\u00E1 pronto! Clique no bot\u00E3o abaixo para visualiz\u00E1-lo:</p>'
            + '<div style="text-align:center;margin:30px 0;">'
            + '<a href="https://grupo-dicas-roteiro.vercel.app/api/roteiro?id=' + roteiroId + '" style="background:#00BCD4;color:#ffffff;padding:16px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">\uD83D\uDDFA\uFE0F Ver meu Roteiro</a>'
            + '</div>'
            + '<p style="color:#6B7280;font-size:14px;">Esse ser\u00E1 o link para voc\u00EA sempre acess\u00E1-lo, ent\u00E3o j\u00E1 salve ele e compartilhe com quem for viajar com voc\u00EAs. :)</p>'
            + '<p style="color:#6B7280;font-size:14px;">Boa viagem! \u2708\uFE0F</p>'
            + '<p style="color:#6B7280;font-size:14px;">Equipe Grupo Dicas</p>'
            + '<hr style="border:none;border-top:1px solid #E5E7EB;margin:30px 0;"/>'
            + '<p style="color:#9CA3AF;font-size:12px;text-align:center;">www.grupodicas.com</p>'
            + '</div>'
        })
      });
      var emailData = await emailRes.json();
      console.log('Email status:', emailRes.status, JSON.stringify(emailData).substring(0, 200));
    } catch (e) {
      console.error('Erro ao enviar email:', e.message);
    }

    // 5. Atualizar Airtable
    if (recordId) {
      await atualizarAirtable(recordId, 'Enviado');
    }

    console.log('=== ROTEIRO COMPLETO! ID:', roteiroId, '- Tempo total:', elapsed, 'segundos ===');

  } catch (err) {
    console.error('Erro na geracao:', err.message);
    console.error('Stack:', err.stack);
    if (recordId) {
      await atualizarAirtable(recordId, 'Erro');
    }
  }
}

function buildPrompt(d) {
  return [
    'Voce e um especialista em viagens do Grupo Dicas (grupodicas.com), o maior site de dicas de viagem do Brasil. Sua missao e criar roteiros de viagem personalizados, detalhados e com foco em ajudar brasileiros a economizar.',
    '',
    'DADOS DO USUARIO PARA ESTE ROTEIRO',
    '- Nome: ' + d.nome,
    '- Destino: ' + d.destino,
    '- Data de ida: ' + d.dataChegada,
    '- Data de volta: ' + d.dataPartida,
    '- Duracao: ' + d.duracaoDias + ' dias',
    '- Numero de pessoas: ' + d.quantasPessoas,
    '- Tipo de viajante: ' + d.viajantes,
    '- Criancas: ' + d.criancas,
    '- Estilo de viagem: ' + d.orcamento,
    '- Interesses: ' + d.interesses,
    '- Primeira vez no destino: ' + d.primeiraVez,
    '',
    'FORMATO DE SAIDA',
    'Gere APENAS codigo HTML completo. NAO inclua explicacoes, markdown ou backticks. O HTML deve comecar com <!DOCTYPE html>.',
    'Use fonte Poppins do Google Fonts.',
    'Use estas variaveis CSS: --primary: #00BCD4; --primary-dark: #0097A7; --primary-light: #E0F7FA; --magenta: #E91E8C; --text: #1A1A2E; --text-light: #6B7280; --white: #FFFFFF; --gray: #F3F4F6; --success: #10B981; --warning: #F59E0B; --danger: #EF4444;',
    'Design responsivo, moderno e profissional. Pronto para visualizar no navegador.',
    '',
    'ESTRUTURA OBRIGATORIA DO ROTEIRO - TODAS AS 9 SECOES DEVEM ESTAR PRESENTES',
    '',
    '1. CAPA',
    '- Fundo com linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
    '- Logo com icone de aviao em box com background rgba(255,255,255,0.2) border-radius 12px',
    '- Texto do logo: GRUPO em branco, DICAS em rgba(255,255,255,0.8), font-size 24px font-weight 700',
    '- Badge "Roteiro Personalizado" com background rgba(255,255,255,0.2), border-radius 50px, uppercase, letter-spacing 2px',
    '- Titulo com paises em font-size 48px font-weight 800',
    '- Subtitulo com cidades separadas por bullet, font-size 20px opacity 0.9',
    '- 3 info cards com icones: datas da viagem, numero de pessoas e tipo, estilo de viagem',
    '- Cada info card: icone em box 40x40 rgba(255,255,255,0.2) border-radius 10px + texto',
    '- Rodape com fundo rgba(0,0,0,0.1): "Preparado especialmente para [Nome]" em font-size 18px bold',
    '',
    '2. RESUMO DA VIAGEM',
    '- Titulo da secao com icone em box 50x50 gradiente primary, border-radius 12px + texto font-size 28px font-weight 700',
    '- Grid 2x2 com cards de fundo var(--gray) border-radius 16px padding 20px',
    '- Box de destinos com fundo primary-light, border 2px solid primary, border-radius 16px',
    '- OBRIGATORIO: Box de clima com temperatura esperada para CADA cidade no periodo da viagem',
    '',
    '3. ONDE FICAR (HOSPEDAGEM)',
    '- Texto introdutorio sobre hoteis que a equipe ja ficou e indica',
    '- Box verde de economia sobre cancelamento gratuito',
    '- Para CADA cidade: 2 hoteis com nota Booking 8.0+, avaliacoes 700+, distancias, link afiliado',
    '- Box azul sobre por que reservar pelo Booking',
    '',
    '4. ANTES DE VIAJAR (CHECKLIST)',
    '- Documentacao, Reservas, Financeiro, Itens para Levar',
    '- Se Europa: SEGURO VIAGEM OBRIGATORIO',
    '',
    '5. ROTEIRO DIA A DIA',
    'Para CADA dia: header com gradiente, 4-6 atividades com horario, emoji, descricao, preco em R$, dicas, links Civitatis, resumo do dia',
    '',
    '6. TRANSPORTE ENTRE CIDADES',
    'Box amarelo com 3 opcoes, precos e recomendacao',
    '',
    '7. DICAS PARA ECONOMIZAR - 6 cards praticos',
    '',
    '8. BOXES DOS PARCEIROS - TODOS OBRIGATORIOS:',
    'a) Seguro Viagem (verde) - Link: https://www.seguroviagem.srv.br/?ag=215&lead_tag=App_[Pais]&promo=18exclusivogrupodicas - NUNCA citar "Seguros Promo"',
    'b) Chip (roxo) - Link: https://americachip.com/?oid=12&affid=103&sub1=App - NUNCA citar "America Chip"',
    'c) Conta Global (vermelho) - Cupom GABRIELLORENZI20 - Link: https://nomad.onelink.me/wIQT/gabriellorenzi15 - NUNCA citar "Nomad"',
    'd) Carros (azul) - Link: https://www.rentcars.com/pt-br/?campaign=App&content=[Pais]&requestorid=42&source=Carro - NUNCA citar "RentCars"',
    '',
    '9. CONTRACAPA - Fundo escuro, logo, tagline, site, nome viajante',
    '',
    'LINKS: CIVITATIS https://www.civitatis.com/pt/[cidade]/[passeio]/?aid=3472&cmp=App_[Pais] | BOOKING https://www.booking.com/hotel/[codigo-pais]/[nome-hotel].pt-br.html?aid=390200&label=App_[Pais] | RAIL EUROPE (fixo) https://click.linksynergy.com/deeplink?id=czqBaUUVmPg&mid=42638&murl=https%3A%2F%2Fwww.raileurope.com%2F%3Fcountry%3DBR%26locale%3Dpt%26currency%3DEUR&u1=App',
    '',
    'TOM: Amigavel, como amigo que ja foi. Precos em R$. Vendedor sutil.',
    '',
    'Retorne APENAS o HTML completo, comecando com <!DOCTYPE html>.'
  ].join('\n');
}

async function atualizarAirtable(recordId, status) {
  try {
    await fetch(
      'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/Pedidos/' + recordId,
      {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: { Status: status } })
      }
    );
    console.log('Airtable atualizado:', status);
  } catch (e) {
    console.error('Erro ao atualizar Airtable:', e.message);
  }
}

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Servidor rodando na porta ' + PORT);
});
