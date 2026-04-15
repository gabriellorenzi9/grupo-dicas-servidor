const express = require('express');
const { put } = require('@vercel/blob');

const app = express();
app.use(express.json());

// Health check
app.get('/', function(req, res) {
  res.json({ status: 'ok', service: 'Grupo Dicas Roteiro Generator' });
});

// Endpoint para gerar roteiro
app.post('/gerar', function(req, res) {
  var d = req.body;

  console.log('Recebido pedido de:', d.nome, '-', d.destino);

  // Responde imediatamente ao formulario
  res.json({ success: true, message: 'Roteiro sendo gerado' });

  // Processa em segundo plano (sem limite de tempo)
  processarRoteiro(d).catch(function(err) {
    console.error('Erro ao processar roteiro:', err.message);
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
    }
  } catch (e) {
    console.error('Airtable erro:', e.message);
  }

  var roteiroId = recordId || ('rot_' + Date.now());

  // 2. Chamar a Claude Opus (sem limite de tempo!)
  console.log('Chamando Claude Opus para roteiroId:', roteiroId);
  var startTime = Date.now();

  var prompt = [
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
    '- Grid 2x2 com cards de fundo var(--gray) border-radius 16px padding 20px:',
    '  Data de Chegada, Data de Partida, Duracao Total (dias/noites), Viajantes',
    '  Labels em uppercase letter-spacing 1px font-size 12px cor text-light',
    '  Valores em font-size 18px font-weight 600',
    '- Box de destinos com fundo primary-light, border 2px solid primary, border-radius 16px:',
    '  Timeline vertical com dots numerados (40x40 gradiente primary, border-radius 50%)',
    '  Nome da cidade com bandeira do pais + dias em cada uma',
    '- OBRIGATORIO: Box de clima com temperatura esperada para CADA cidade no periodo da viagem',
    '',
    '3. ONDE FICAR (HOSPEDAGEM)',
    '- Texto introdutorio: "Esses sao hoteis que ja ficamos hospedados e indicamos de olhos fechados! Selecionamos opcoes com nota acima de 8.0 no Booking, centenas de avaliacoes reais, e o mais importante: os melhores precos da regiao."',
    '- Box verde de economia: "Dica de grande economia: Quanto antes voce fizer a reserva, mais barato ira pagar. Quase todos os hoteis oferecem cancelamento gratuito - reserve agora para garantir o preco!"',
    '- Para CADA cidade do roteiro:',
    '  Titulo com bandeira do pais: "Onde Ficar em [Cidade]?"',
    '  Texto sobre a melhor regiao para turistas e por que',
    '  2 hoteis, cada um em card com background var(--gray) border-radius 16px padding 20px:',
    '    Badge verde com nota do Booking (minimo 8.0) + numero de avaliacoes (minimo 700)',
    '    Nome do hotel em font-size 16px font-weight 600',
    '    Descricao curta com localizacao e diferenciais',
    '    Tags de distancia a pe: badges com fundo primary-light, cor primary-dark, border-radius 20px',
    '    Botao "Ver precos e fotos" com link de afiliado Booking, gradiente primary, cor branca, border-radius 8px',
    '- Box final azul escuro (#003580) sobre "Por que reservar pelo Booking?" com badges de beneficios',
    '',
    '4. ANTES DE VIAJAR (CHECKLIST)',
    '- Secoes com titulos: Documentacao, Reservas e Ingressos, Financeiro e Comunicacao, Itens para Levar',
    '- Grid 2 colunas com items contendo checkbox (borda primary, border-radius 6px) + texto + badge informativo',
    '- Se destino europeu: DESTACAR que seguro viagem e OBRIGATORIO com cobertura minima de 30.000 euros',
    '- Timeline de reservas: o que fazer 3 meses antes, 1 mes antes, 1 semana antes, 1-2 dias antes',
    '',
    '5. ROTEIRO DIA A DIA - ESTA E A SECAO MAIS IMPORTANTE',
    'Para CADA dia da viagem, sem excecao:',
    '- Day header: div com gradiente primary, border-radius 20px, padding 25px, cor branca',
    '  Numero do dia em uppercase letter-spacing 2px, titulo criativo font-size 28px font-weight 700',
    '  Data por extenso, badge de localizacao no canto direito com fundo rgba(255,255,255,0.2) border-radius 50px',
    '- Timeline de atividades: linha vertical de 2px gradiente primary, dots de 18px com borda branca e sombra',
    '- 4 a 6 atividades por dia, cada uma com:',
    '  Horario em cor primary font-weight 600',
    '  Titulo com emoji relevante, font-size 18px font-weight 600',
    '  Descricao envolvente de 2-3 frases como um amigo dando dicas (tom entusiasmado e pratico)',
    '  Tags de detalhes em badges: preco em R$, duracao, tipo (background gray, border-radius 20px, font-size 12px)',
    '  Dica especial em box com fundo primary-light, border-left 3px solid primary',
    '  Box "Proxima parada" com icone, titulo uppercase e distancia/tempo de deslocamento',
    '  OBRIGATORIO: Botao CTA com link Civitatis para TODAS as atracoes, ingressos e transfers',
    '    Botao com gradiente primary, cor branca, border-radius 12px, padding 12px 20px',
    '    Texto: "Reservar [Atracao]" ou "Comprar Ingresso" seguido de seta',
    '    Sub-badge: "Pague em R$ sem IOF" com fundo rgba(255,255,255,0.2)',
    '- Resumo do dia em box var(--gray): grid 3 colunas com passos estimados, gasto estimado em R$, numero de atracoes',
    '',
    '6. TRANSPORTE ENTRE CIDADES',
    'Quando houver mudanca de cidade, OBRIGATORIO incluir:',
    '- Box com fundo gradiente amarelo (#FEF3C7 para #FDE68A), border 2px solid warning',
    '- Titulo: "Como ir de [Cidade A] a [Cidade B]" com icone',
    '- Grid 3 colunas com opcoes de transporte:',
    '  Cada opcao em card branco com icone grande, nome, tempo e preco',
    '  Opcao recomendada com border 2px solid success e badge "Recomendado" em verde posicionado acima',
    '- Texto explicando por que aquela opcao e recomendada',
    '',
    '7. DICAS PARA ECONOMIZAR',
    '- Grid 2x3 com 6 cards praticos',
    '- Cada card com fundo gray border-radius 16px padding 20px:',
    '  Icone em box 50x50 gradiente primary border-radius 12px',
    '  Titulo font-size 16px font-weight 600',
    '  Descricao pratica com dicas reais de economia para brasileiros',
    '',
    '8. BOXES DOS PARCEIROS - TODOS OS 4 SAO OBRIGATORIOS',
    '',
    'a) SEGURO VIAGEM',
    '- Box com gradiente verde (#059669 para #047857), border-radius 16px, padding 25px, cor branca',
    '- Icone escudo em box 60x60 rgba(255,255,255,0.2)',
    '- Titulo: "Seguro Viagem" + se Europa adicionar "OBRIGATORIO"',
    '- Texto sobre importancia, cobertura minima 30.000 euros, comparar seguradoras, economizar ate 50%',
    '- Badges informativos com fundo rgba(255,255,255,0.2)',
    '- Botao CTA com fundo branco e cor do gradiente',
    '- Link: https://www.seguroviagem.srv.br/?ag=215&lead_tag=App_[Pais]&promo=18exclusivogrupodicas',
    '- REGRA: NUNCA citar o nome "Seguros Promo" - usar "comparador de seguros"',
    '',
    'b) CHIP DE VIAGEM',
    '- Box com gradiente roxo (#7C3AED para #5B21B6)',
    '- Titulo: "Internet na Europa" ou "Chip Internacional"',
    '- Texto: internet ilimitada, entrega no Brasil, funciona em 140+ paises, suporte em portugues',
    '- Link fixo: https://americachip.com/?oid=12&affid=103&sub1=App',
    '- REGRA: NUNCA citar o nome "America Chip" - usar "chip de viagem" ou "chip internacional"',
    '',
    'c) CONTA GLOBAL',
    '- Box com gradiente roxo (#7C3AED para #5B21B6) ou vermelho',
    '- Titulo: "Conta Global em Dolar"',
    '- Texto detalhado: conta em dolar, cartao sem IOF, melhor cambio que casa de cambio, saque em qualquer pais, sala VIP Guarulhos, investir em fundos americanos',
    '- Box especial com cupom: "GABRIELLORENZI20 - Ganhe ate US$20 de volta na primeira remessa"',
    '- Badges: melhor cambio, conta em dolar, sala VIP Guarulhos, saque em qualquer pais',
    '- Aviso: pedir cartao fisico logo pois demora 2 semanas',
    '- Link fixo: https://nomad.onelink.me/wIQT/gabriellorenzi15',
    '- REGRA: NUNCA citar o nome "Nomad" - usar "conta global" ou "cartao internacional"',
    '',
    'd) ALUGUEL DE CARROS',
    '- Box com gradiente azul (#3B82F6 para #1D4ED8)',
    '- Titulo: "Comparador de Aluguel de Carros"',
    '- Texto: compara todas locadoras, precos mais baratos, pagamento em reais',
    '- Recomendar locadoras grandes: Alamo, Avis, Europcar, Sixt, Thrifty, Dollar, Budget',
    '- Link: https://www.rentcars.com/pt-br/?campaign=App&content=[Pais]&requestorid=42&source=Carro',
    '- REGRA: NUNCA citar o nome "RentCars" - usar "comparador de aluguel de carros"',
    '- So destacar se fizer sentido pro destino (nao destacar para Paris, NY, Punta Cana)',
    '',
    '9. CONTRACAPA',
    '- Fundo com gradiente escuro (--text para #2D3748)',
    '- Logo: GRUPO em cor magenta, DICAS em cor primary, font-size 36px font-weight 700',
    '- Tagline: "Transformando sonhos de viagem em realidade desde 2018" opacity 0.8',
    '- Site: www.grupodicas.com em cor primary font-size 24px',
    '- Icones sociais em boxes 50x50 rgba(255,255,255,0.1)',
    '- Rodape: "Este roteiro foi gerado exclusivamente para [Nome]" + copyright',
    '',
    'REGRAS DE LINKS DE AFILIADOS',
    '',
    'CIVITATIS (passeios, ingressos, transfers):',
    'Estrutura: https://www.civitatis.com/pt/[cidade]/[passeio]/?aid=3472&cmp=App_[Pais]',
    'Usar em TODAS as atracoes, ingressos e transfers. URLs em portugues.',
    'Parametro cmp=App_[Pais] sem caracteres especiais (Italia, Franca, Portugal, Espanha, Inglaterra)',
    'Quando houver tour em portugues, destacar com bandeira BR.',
    'SEMPRE incluir badge "Pague em R$ sem IOF" nos botoes.',
    '',
    'BOOKING.COM (hoteis):',
    'Estrutura: https://www.booking.com/hotel/[codigo-pais]/[nome-hotel].pt-br.html?aid=390200&label=App_[Pais]',
    'UNICO parceiro que pode ter o nome citado.',
    'Sempre buscar opcoes mais baratas dentro da qualidade. Nota minimo 8.0, minimo 700 avaliacoes.',
    'Destacar cancelamento gratuito como estrategia de economia.',
    '',
    'RAIL EUROPE (trens na Europa):',
    'Link fixo NUNCA alterar: https://click.linksynergy.com/deeplink?id=czqBaUUVmPg&mid=42638&murl=https%3A%2F%2Fwww.raileurope.com%2F%3Fcountry%3DBR%26locale%3Dpt%26currency%3DEUR&u1=App',
    'NUNCA citar nome - usar "site de trens".',
    '',
    'DIRECT FERRIES:',
    'Link fixo: https://www.directferries.pt/?dfpid=3908&affid=19&rurl=',
    '',
    'REGRA CRITICA: NUNCA CITAR NOMES DOS PARCEIROS',
    'America Chip -> usar "chip de viagem"',
    'Nomad -> usar "conta global"',
    'RentCars -> usar "comparador de carros"',
    'Seguros Promo -> usar "comparador de seguros"',
    'Rail Europe -> usar "site de trens"',
    'Booking -> PODE citar',
    '',
    'FOCO EM ECONOMIA',
    '1. Hoteis: sempre opcoes mais baratas dentro da qualidade',
    '2. Precos: SEMPRE em REAIS (R$) para o brasileiro entender',
    '3. Dicas de economia reais e praticas',
    '4. Tom: viagem inteligente, economizar sem ser pao-duro',
    '5. Cancelamento gratis: sempre destacar como estrategia',
    '',
    'TOM DE VOZ',
    '- Amigavel, como um amigo que ja foi e esta dando dicas',
    '- Entusiasmo genuino pelos lugares',
    '- Detalhes unicos que so quem foi saberia (ex: "o banco do lado esquerdo na Sistina tem menos gente")',
    '- Narrativa envolvente, nao apenas listar informacoes',
    '- Pratico: sempre incluir horarios, precos, como chegar',
    '- Vendedor sutil: destacar beneficios dos parceiros sem parecer propaganda forcada',
    '',
    'CHECKLIST FINAL - VERIFIQUE ANTES DE ENTREGAR:',
    '- Todas as 9 secoes estao presentes?',
    '- Clima e temperatura de CADA cidade incluido?',
    '- TODOS os dias da viagem tem roteiro detalhado com 4-6 atividades?',
    '- Links de afiliados Civitatis em TODAS as atracoes?',
    '- Boxes de TODOS os 4 parceiros incluidos (Seguro, Chip, Conta, Carro)?',
    '- Precos em R$ em todas as atividades?',
    '- Secao de transporte entre cidades quando aplicavel?',
    '- Texto introdutorio sobre hoteis e box do Booking presentes?',
    '- HTML comeca com <!DOCTYPE html> e NAO tem markdown ou backticks?',
    '',
    'Retorne APENAS o HTML completo, comecando com <!DOCTYPE html>.'
  ].join('\n');

  try {
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

    var claudeData = await claudeResponse.json();
    var elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log('Claude respondeu em ' + elapsed + ' segundos, status:', claudeResponse.status);

    if (!claudeData.content || !claudeData.content[0]) {
      console.error('Claude nao retornou conteudo:', JSON.stringify(claudeData).substring(0, 500));
      if (recordId) {
        await atualizarAirtable(recordId, 'Erro');
      }
      return;
    }

    var html = claudeData.content[0].text;
    html = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    console.log('HTML gerado com', html.length, 'caracteres');

    // 3. Salvar no Blob
    var blob = await put('roteiros/' + roteiroId + '.html', html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    console.log('Salvo no Blob:', blob.url);

    // 4. Enviar email
    var nomeFirst = d.nome ? d.nome.split(' ')[0] : 'Viajante';
    try {
      await fetch('https://api.resend.com/emails', {
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
      console.log('Email enviado para:', d.email);
    } catch (e) {
      console.error('Erro ao enviar email:', e.message);
    }

    // 5. Atualizar Airtable (Status: Enviado)
    if (recordId) {
      await atualizarAirtable(recordId, 'Enviado');
    }

    console.log('Roteiro completo! ID:', roteiroId, '- Tempo total:', elapsed, 'segundos');

  } catch (err) {
    console.error('Erro na geracao:', err.message);
    if (recordId) {
      await atualizarAirtable(recordId, 'Erro');
    }
  }
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
