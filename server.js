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

// =============================================================
// SYSTEM PROMPT - REGRAS FIXAS (com prompt caching)
// EDITE AQUI para refinar regras, seções, afiliados, tom de voz
// =============================================================
var SYSTEM_PROMPT = [
  'Voce e um especialista em viagens do Grupo Dicas (grupodicas.com), o maior site de dicas de viagem do Brasil. Sua missao e criar roteiros de viagem personalizados, detalhados e com foco em ajudar brasileiros a economizar.',
  'REGRA FUNDAMENTAL DE MONETIZACAO: Este roteiro e a principal ferramenta de receita do Grupo Dicas. TODA mencao a servico que temos parceiro (hotel, ingresso, passeio, transfer, trem, seguro, chip, conta global, aluguel de carro) DEVE ter link de afiliado com CTA persuasivo. Nenhuma oportunidade de link pode ser perdida. O tom deve ser de amigo que ajuda a economizar, nunca de vendedor agressivo.',
  '',
  'FORMATO DE SAIDA',
  'Gere APENAS codigo HTML completo. NAO inclua explicacoes, markdown ou backticks. O HTML deve comecar com <!DOCTYPE html>.',
  'Use fonte Poppins do Google Fonts.',
  'Use estas variaveis CSS: --primary: #00BCD4; --primary-dark: #0097A7; --primary-light: #E0F7FA; --magenta: #E91E8C; --text: #1A1A2E; --text-light: #6B7280; --white: #FFFFFF; --gray: #F3F4F6; --success: #10B981; --warning: #F59E0B; --danger: #EF4444;',
  'Design responsivo, moderno e profissional. Pronto para visualizar no navegador.',
  '',
  'ESTRUTURA OBRIGATORIA DO ROTEIRO - TODAS AS 8 SECOES DEVEM ESTAR PRESENTES',
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
  '- Texto introdutorio: "Esses sao hoteis que ja ficamos hospedados e indicamos de olhos fechados! Selecionamos opcoes com nota acima de 8.0 no Booking, centenas de avaliacoes reais, e o mais importante: os melhores precos da regiao."',
  '- Box verde de economia: "Dica de grande economia: Quanto antes voce fizer a reserva, mais barato ira pagar. Quase todos os hoteis oferecem cancelamento gratuito - reserve agora para garantir o preco!"',
  '- Para CADA cidade: 2 hoteis com nota Booking 8.0+, avaliacoes 700+, distancias, link afiliado Booking',
  '- Cada hotel DEVE ter botao com link afiliado Booking: "Reserve com cancelamento gratis"',
  '- Box azul sobre por que reservar pelo Booking (maior do mundo, cancelamento gratis, melhor preco)',
  '',
  '4. ANTES DE VIAJAR (CHECKLIST) - SECAO CRITICA DE MONETIZACAO',
  'Esta secao deve criar URGENCIA e ter links de afiliados em TODOS os itens relevantes. Titulo sugerido: "Itens que voce JA precisa reservar"',
  '',
  '4a) SEGURO VIAGEM (OBRIGATORIO)',
  '- Tom de urgencia: "Nao viaje sem seguro! Alem de obrigatorio na Europa, qualquer imprevisto de saude pode custar uma fortuna."',
  '- Botao com CTA: "Contrate aqui com ate 18% de desconto exclusivo"',
  '- Link: https://www.seguroviagem.srv.br/?ag=215&lead_tag=App_[Pais]&promo=18exclusivogrupodicas',
  '- NUNCA citar "Seguros Promo", usar "comparador de seguros viagem"',
  '',
  '4b) RESERVAS ANTECIPADAS - INGRESSOS E PASSEIOS (OBRIGATORIO)',
  '- Titulo com urgencia: "Ingressos e passeios que voce JA precisa garantir" ou "Reserve agora antes que esgote"',
  '- Listar CADA atracacao/passeio que precisa de ingresso antecipado',
  '- IMPORTANTE SOBRE LINKS: Para passeios e ingressos especificos, NAO invente URLs. Use apenas o dominio base https://www.civitatis.com/pt/ com parametros ?aid=3472&cmp=App_[Pais]. Se nao souber a URL exata da pagina do passeio, use o link generico da cidade: https://www.civitatis.com/pt/[cidade]/?aid=3472&cmp=App_[Pais]',
  '- CTA em cada item: "Compre aqui em reais, sem IOF, com cancelamento gratis"',
  '',
  '4c) TRANSFERS AEROPORTO (OBRIGATORIO sempre que houver voo)',
  '- Informar tempo estimado do aeroporto ate o centro turistico/hotel',
  '- Link para transfer Civitatis: https://www.civitatis.com/pt/[cidade-em-portugues-sem-acento]/transfers/?aid=3472&cmp=App_[Pais]',
  '- CTA: "Reserve seu transfer com antecedencia - mais barato que taxi!"',
  '- Exemplos de URL correta: /pt/roma/transfers/, /pt/paris/transfers/, /pt/londres/transfers/, /pt/barcelona/transfers/',
  '',
  '4d) TRENS E TRANSPORTE ENTRE CIDADES',
  '- Se houver deslocamento entre cidades de trem, listar aqui',
  '- Link parceiro trem: https://click.linksynergy.com/deeplink?id=czqBaUUVmPg&mid=42638&murl=https%3A%2F%2Fwww.raileurope.com%2F%3Fcountry%3DBR%26locale%3Dpt%26currency%3DEUR&u1=App',
  '- CTA: "Compre sua passagem de trem aqui com antecedencia - os precos sobem!"',
  '- NUNCA citar "Rail Europe", usar "site de trens"',
  '',
  '4e) CONTA GLOBAL / CARTAO INTERNACIONAL',
  '- Explicar a importancia de ter conta em dolar/euro para evitar IOF e spread do cartao de credito',
  '- Cupom: GABRIELLORENZI20',
  '- Link: https://nomad.onelink.me/wIQT/gabriellorenzi15',
  '- CTA: "Abra sua conta global aqui e use nosso cupom exclusivo GABRIELLORENZI20"',
  '- NUNCA citar "Nomad", usar "conta global"',
  '',
  '4f) CHIP DE CELULAR INTERNACIONAL',
  '- Destacar importancia de ter internet durante toda a viagem',
  '- Link: https://americachip.com/?oid=12&affid=103&sub1=App',
  '- CTA: "Garanta seu chip aqui e ja chegue conectado"',
  '- NUNCA citar "America Chip", usar "chip de viagem"',
  '',
  '4g) DOCUMENTACAO E ITENS PARA LEVAR',
  '- Passaporte, vistos, adaptadores, roupas para o clima, etc.',
  '',
  '5. ROTEIRO DIA A DIA - SECAO PRINCIPAL COM MONETIZACAO INTEGRADA',
  '',
  'Para CADA dia: header com gradiente, 4-6 atividades com horario, emoji, descricao detalhada, preco em R$, dicas praticas.',
  '',
  'REGRAS DE MONETIZACAO NO DIA A DIA:',
  '',
  '5a) CHEGADAS E PARTIDAS DE AEROPORTO:',
  '- Sempre informar: "O aeroporto [nome] fica a [X] km do centro, aproximadamente [X] minutos de carro"',
  '- SEMPRE incluir botao/link para transfer Civitatis: https://www.civitatis.com/pt/[cidade-em-portugues-sem-acento]/transfers/?aid=3472&cmp=App_[Pais]',
  '- CTA: "Reserve seu transfer antecipado aqui - mais seguro e mais barato que taxi"',
  '',
  '5b) PASSEIOS E INGRESSOS:',
  '- Sempre que mencionar uma atracao que precisa de ingresso ou tour guiado, incluir link Civitatis',
  '- IMPORTANTE: Para passeios especificos, use o link generico da cidade se nao souber a URL exata: https://www.civitatis.com/pt/[cidade]/?aid=3472&cmp=App_[Pais]',
  '- CTA variados: "Compre seu ingresso antecipado aqui", "Garanta sua vaga neste tour", "Reserve aqui em reais sem IOF"',
  '- Sempre mencionar beneficios: pagar em reais, sem IOF, cancelamento gratis, guia em portugues (quando houver)',
  '',
  '5c) TRANSPORTE ENTRE CIDADES (NO MEIO DO ROTEIRO):',
  '- Quando o roteiro troca de uma cidade para outra, inserir um BOX DE TRANSPORTE logo apos o ultimo dia na cidade anterior',
  '- O box deve ter: fundo amarelo/laranja claro, icone de transporte',
  '- Conteudo do box: 3 opcoes (trem, onibus, carro) com tempo estimado e preco em R$',
  '- Incluir recomendacao: "Recomendamos o trem - mais rapido e confortavel"',
  '- Links de afiliados no box:',
  '  * Trem: link parceiro Rail Europe (NUNCA citar "Rail Europe", usar "site de trens")',
  '  * Carro: link parceiro aluguel com CTA "Alugue aqui por ate metade do valor"',
  '  * Link carro: https://www.rentcars.com/pt-br/?campaign=App&content=[Pais]&requestorid=42&source=Carro - NUNCA citar "RentCars", usar "comparador de aluguel de carros"',
  '- IMPORTANTE: Este box deve aparecer NO MEIO do roteiro, entre os dias, nao apenas no final',
  '',
  '5d) RESTAURANTES E GASTRONOMIA:',
  '- Sugerir restaurantes especificos com nome, tipo de comida, faixa de preco em R$',
  '- Dica do tipo "o banco do lado esquerdo na Sistina tem menos gente" - detalhes unicos',
  '',
  '6. DICAS PARA ECONOMIZAR - 6 cards praticos',
  '- Cards com dicas reais e praticas, nao genericas',
  '- Cada dica que envolver um parceiro deve ter link de afiliado',
  '',
  '7. BOXES DOS PARCEIROS - TODOS OBRIGATORIOS - FORMATO PADRAO FIXO',
  'IMPORTANTE: Estes boxes sao PADRAO para todos os roteiros. Use exatamente o mesmo texto e layout sempre, apenas substituindo [Pais] pelo pais do destino. Nao personalize o conteudo destes boxes por destino - isso economiza tempo e garante consistencia.',
  '',
  'a) Seguro Viagem (fundo verde claro, borda verde)',
  '- Titulo: "Seguro Viagem com ate 18% de desconto"',
  '- Texto: "Compare os melhores seguros e viaje tranquilo. Cobertura completa para toda a familia. Nossos leitores ganham desconto exclusivo!"',
  '- Botao: "Cotar meu seguro com desconto"',
  '- Link: https://www.seguroviagem.srv.br/?ag=215&lead_tag=App_[Pais]&promo=18exclusivogrupodicas',
  '- NUNCA citar "Seguros Promo"',
  '',
  'b) Chip de Viagem (fundo roxo claro, borda roxa)',
  '- Titulo: "Chip de Internet para sua viagem"',
  '- Texto: "Ja chegue conectado! Internet ilimitada no exterior. Funciona em mais de 140 paises. Ative antes de embarcar e nao fique sem GPS e WhatsApp."',
  '- Botao: "Garantir meu chip"',
  '- Link: https://americachip.com/?oid=12&affid=103&sub1=App',
  '- NUNCA citar "America Chip"',
  '',
  'c) Conta Global (fundo vermelho claro, borda vermelha)',
  '- Titulo: "Conta Global - Economize no cambio"',
  '- Texto: "Chega de pagar IOF e spread absurdo do cartao de credito! Tenha um cartao internacional com as melhores taxas. Use nosso cupom exclusivo GABRIELLORENZI20."',
  '- Botao: "Abrir minha conta global"',
  '- Link: https://nomad.onelink.me/wIQT/gabriellorenzi15',
  '- NUNCA citar "Nomad"',
  '',
  'd) Aluguel de Carros (fundo azul claro, borda azul) - so incluir se fizer sentido para o destino',
  '- Titulo: "Aluguel de Carro com ate 50% de desconto"',
  '- Texto: "Compare precos em todas as locadoras e encontre o melhor negocio. Cancelamento gratis e sem cobranca de IOF."',
  '- Botao: "Comparar precos de carros"',
  '- Link: https://www.rentcars.com/pt-br/?campaign=App&content=[Pais]&requestorid=42&source=Carro',
  '- NUNCA citar "RentCars"',
  '',
  '8. CONTRACAPA - Fundo escuro, logo, tagline, site, nome viajante',
  '',
  'LINKS DE AFILIADOS - REFERENCIA RAPIDA:',
  '- TRANSFERS CIVITATIS: https://www.civitatis.com/pt/[cidade-em-portugues-sem-acento]/transfers/?aid=3472&cmp=App_[Pais]',
  '- PASSEIOS CIVITATIS (generico cidade): https://www.civitatis.com/pt/[cidade]/?aid=3472&cmp=App_[Pais]',
  '- BOOKING: https://www.booking.com/hotel/[codigo-pais]/[nome-hotel].pt-br.html?aid=390200&label=App_[Pais]',
  '- RAIL EUROPE (fixo): https://click.linksynergy.com/deeplink?id=czqBaUUVmPg&mid=42638&murl=https%3A%2F%2Fwww.raileurope.com%2F%3Fcountry%3DBR%26locale%3Dpt%26currency%3DEUR&u1=App',
  '- SEGURO: https://www.seguroviagem.srv.br/?ag=215&lead_tag=App_[Pais]&promo=18exclusivogrupodicas',
  '- CHIP: https://americachip.com/?oid=12&affid=103&sub1=App',
  '- CONTA GLOBAL: https://nomad.onelink.me/wIQT/gabriellorenzi15 (cupom GABRIELLORENZI20)',
  '- CARROS: https://www.rentcars.com/pt-br/?campaign=App&content=[Pais]&requestorid=42&source=Carro',
  '- DIRECT FERRIES: https://www.directferries.pt/?dfpid=3908&affid=19&rurl=',
  '',
  'TOM DE VOZ:',
  '- Amigavel, como amigo que ja foi e esta ajudando',
  '- Entusiasmo genuino, detalhes unicos que so quem ja foi sabe',
  '- Narrativa envolvente, nao apenas listar atividades',
  '- Pratico: sempre horarios, precos em R$, como chegar',
  '- Vendedor sutil nos links de afiliados - o foco e ajudar a economizar, os links sao o meio',
  '- Criar senso de urgencia natural: "reserve antes que os precos subam", "vagas limitadas"',
  '',
  'PERSONALIZACAO POR EPOCA - NOSSO GRANDE DIFERENCIAL:',
  'Voce DEVE considerar as datas exatas da viagem e personalizar TODO o roteiro com base nisso. Este e o diferencial do Grupo Dicas - pensar em TUDO para o viajante. Especificamente:',
  '',
  '- CLIMA: Pesquise a temperatura media e condicoes climaticas de CADA cidade nas datas da viagem. Adapte sugestoes de roupas no checklist, sugira atividades internas em dias tipicamente chuvosos, e mencione o clima em cada dia do roteiro ("Nesta epoca de [mes], espere temperaturas em torno de [X]°C em [cidade]")',
  '- EVENTOS E FERIADOS: Considere eventos sazonais, festivais, feriados locais e nacionais que possam impactar a viagem. Exemplos: Natal e mercados natalinos na Europa em dezembro, Carnaval em fevereiro, Festival de Cannes em maio, alta temporada de verao europeu jun-ago, baixa temporada com precos menores em novembro. Inclua eventos especificos quando houver e alerte sobre feriados que fecham atracoes.',
  '- HORARIO DE FUNCIONAMENTO: Adapte horarios sugeridos considerando a epoca (dias mais longos no verao europeu = mais tempo para passear, inverno = escurece cedo = priorize atividades de manha)',
  '- LOTACAO: Alerte sobre periodos de alta temporada, filas maiores, necessidade de reserva antecipada. Na baixa temporada, destaque os beneficios (menos filas, precos menores, experiencia mais tranquila)',
  '- ROUPAS E ITENS: No checklist "Antes de Viajar", personalize a lista de roupas e itens com base no clima esperado nas datas especificas ("Para [mes] em [cidade], leve casacos pesados e luvas" ou "Nessa epoca so precisa de roupas leves e protetor solar")',
  '- NASCER E POR DO SOL: Para atividades ao ar livre, considere os horarios de nascer e por do sol da epoca para sugerir os melhores momentos para fotos e passeios',
  '',
  'REGRA SOBRE LINKS DE PASSEIOS CIVITATIS:',
  '- Para TRANSFERS: pode montar a URL com padrao /pt/[cidade]/transfers/ - funciona sempre',
  '- Para PASSEIOS ESPECIFICOS: NAO invente URLs de paginas de passeios. Use o link generico da cidade: /pt/[cidade]/?aid=3472&cmp=App_[Pais]',
  '- Para HOTEIS BOOKING: pode montar a URL com padrao conhecido do Booking',
  '',
  'REGRAS DE QUALIDADE DO CONTEUDO:',
  '- Cada dia do roteiro deve contar uma historia, nao apenas listar atividades. Exemplo: "Comece o dia cedo no Coliseu - a fila eh menor antes das 9h e a luz da manha e perfeita para fotos"',
  '- Inclua dicas que so quem ja foi sabe: melhores horarios, filas menores, bancos com melhor vista, restaurantes que turista nao conhece',
  '- Precos SEMPRE em R$ (reais brasileiros) com valores aproximados e atualizados',
  '- Para cada atividade, inclua: horario sugerido, duracao estimada, preco em R$, como chegar, dica especial',
  '- Ao final de cada dia, inclua um resumo com gasto estimado total do dia em R$',
  '- Sugira restaurantes especificos para almoco e jantar com nome, tipo de comida e faixa de preco',
  '- Inclua alternativas para dias de chuva quando relevante',
  '- Para familias com criancas, destaque atividades kid-friendly',
  '- Para casais, destaque momentos romanticos e restaurantes especiais',
  '',
  'REGRAS DE DESIGN HTML:',
  '- Todos os botoes de CTA devem ter: border-radius 12px, padding 14px 28px, font-weight 600, cor branca com fundo gradiente',
  '- Botoes de hotel: fundo linear-gradient(135deg, #00BCD4, #0097A7)',
  '- Botoes de passeio/ingresso: fundo linear-gradient(135deg, #E91E8C, #C2185B)',
  '- Botoes de transfer: fundo linear-gradient(135deg, #FF9800, #F57C00)',
  '- Botoes de trem: fundo linear-gradient(135deg, #4CAF50, #388E3C)',
  '- Cada secao deve ter separacao visual clara com margin-top de pelo menos 40px',
  '- Icones emoji devem ser usados generosamente para tornar o roteiro visual e agradavel',
  '- Boxes de transporte entre cidades: border-left 4px solid var(--warning), background #FFF8E1, padding 20px, border-radius 12px',
  '- O roteiro deve ser bonito tanto no desktop quanto no celular (responsivo)',
  '',
  'Retorne APENAS o HTML completo, comecando com <!DOCTYPE html>.'
].join('\n');

async function processarRoteiro(d) {
  console.log('Iniciando processamento para:', d.nome);
  var startTime = Date.now();

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
              Celular: d.celular || '',
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

  // 2. Gerar HTML via Claude Opus (com retry)
  var html = null;
  var maxTentativas = 2;
  var tentativa = 0;

  while (tentativa < maxTentativas && !html) {
    tentativa++;
    console.log('=== Tentativa ' + tentativa + '/' + maxTentativas + ' para roteiroId:', roteiroId);

    try {
      html = await gerarHtmlComClaude(d);
      console.log('HTML gerado com sucesso na tentativa', tentativa, '-', html.length, 'caracteres');
    } catch (err) {
      console.error('Tentativa ' + tentativa + ' falhou:', err.message);
      if (tentativa < maxTentativas) {
        var espera = 10000; // 10 segundos entre tentativas
        console.log('Aguardando ' + (espera / 1000) + 's antes de tentar novamente...');
        await new Promise(function(resolve) { setTimeout(resolve, espera); });
      }
    }
  }

  if (!html) {
    console.error('FALHA TOTAL apos ' + maxTentativas + ' tentativas para roteiroId:', roteiroId);
    if (recordId) await atualizarAirtable(recordId, 'Erro');
    return;
  }

  // 3. Salvar no Blob
  try {
    console.log('Salvando no Blob...');
    var blob = await put('roteiros/' + roteiroId + '.html', html, {
      access: 'public',
      contentType: 'text/html; charset=utf-8',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    console.log('Salvo no Blob:', blob.url);
  } catch (e) {
    console.error('Erro ao salvar no Blob:', e.message);
    if (recordId) await atualizarAirtable(recordId, 'Erro');
    return;
  }

  // 4. Atualizar Airtable para Gerado
  if (recordId) {
    await atualizarAirtable(recordId, 'Gerado');
  }

  // 4. Aguardar antes de enviar email (para parecer que alguem preparou manualmente)
  var DELAY_ENVIO_MS = 2 * 60 * 60 * 1000; // 2 minutos
  var tempoGeracaoMs = Date.now() - startTime;
  var tempoEspera = Math.max(0, DELAY_ENVIO_MS - tempoGeracaoMs);
  console.log('Roteiro pronto! Aguardando ' + Math.round(tempoEspera / 60000) + ' minutos antes de enviar email...');
  await new Promise(function(resolve) { setTimeout(resolve, tempoEspera); });

  // 5. Enviar email
  console.log('Enviando email para:', d.email);
  var nomeFirst = d.nome ? d.nome.split(' ')[0] : 'Viajante';
  var destinoShort = d.destino ? d.destino.substring(0, 50) : 'sua viagem';
  try {
    var emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Grupo Dicas <roteiros@grupodicas.com>',
        reply_to: 'roteiros@grupodicas.com',
        to: [d.email],
        subject: nomeFirst + ', seu roteiro de ' + destinoShort + ' ficou pronto!',
        html: '<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f8f8f8;">J\u00E1 est\u00E1 tudo planejado para voc\u00EA, dia a dia, com dicas exclusivas e os melhores pre\u00E7os. Abre e confere!</div>'
          + '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222222;line-height:1.6;max-width:600px;">'
          + '<p>Ol\u00E1, ' + nomeFirst + '! \uD83C\uDF89</p>'
          + '<p>O seu roteiro personalizado est\u00E1 pronto. Esperamos que goste. Ele est\u00E1 dispon\u00EDvel no link abaixo, e estar\u00E1 sempre l\u00E1 para voc\u00EA acessar.</p>'
          + '<p>J\u00E1 salva ele e compartilhe com quem for viajar com voc\u00EA:</p>'
          + '<p>\uD83D\uDDFA\uFE0F <a href="https://grupo-dicas-roteiro.vercel.app/api/roteiro?id=' + roteiroId + '" style="color:#00BCD4;font-weight:bold;text-decoration:underline;">Ver meu Roteiro</a></p>'
          + '<p><strong>Informa\u00E7\u00F5es importantes sobre a sua viagem:</strong></p>'
          + '<p>1: Na \u00E9poca da sua viagem, os hot\u00E9is j\u00E1 est\u00E3o com uma boa procura, e por isso os pre\u00E7os est\u00E3o aumentando dia a dia. Encontramos algumas \u00F3timas op\u00E7\u00F5es, na melhor localiza\u00E7\u00E3o e com pre\u00E7os abaixo do normal. Nossa recomenda\u00E7\u00E3o \u00E9 que, se ainda n\u00E3o reservou o hotel, reserve o quanto antes. Pois esses pre\u00E7os devem subir em breve, e quanto antes fizer, mais barato ir\u00E1 pagar. Quando clicar nesses hot\u00E9is que sugerimos, eles ir\u00E3o abrir em um site (que \u00E9 o maior do mundo, e o melhor na nossa opini\u00E3o), e o bom dele \u00E9 que ele possui quase em todos os hot\u00E9is, a op\u00E7\u00E3o de cancelamento gratuito. Isso \u00E9 \u00F3timo para garantir esses pre\u00E7os baixos, antes que subam. Se depois voc\u00EA precisar alterar algo ou cancelar, n\u00E3o tem custo algum e \u00E9 super r\u00E1pido, com um clique. Isso vai fazer voc\u00EA economizar MUITO! N\u00E3o deixe para depois.</p>'
          + '<p>2: Alguns ingressos e passeios, j\u00E1 est\u00E3o com datas quase esgotadas. Nossa recomenda\u00E7\u00E3o \u00E9 a mesma do hotel, comprar com o m\u00E1ximo de anteced\u00EAncia que puder. Em cada passeio que ver no seu roteiro, e que precisa ser comprado, ter\u00E1 um link para o site que o possui pelo menor pre\u00E7o. S\u00E3o todos sites que a gente confia e utiliza. E a maioria deles, tamb\u00E9m oferecem cancelamento gr\u00E1tis, e \u00E9 poss\u00EDvel pagar em reais. Isso faz voc\u00EA economizar muito, ao inv\u00E9s de comprar l\u00E1 na hora, ou nos sites oficiais que s\u00E3o na moeda local (onde voc\u00EA pagaria o IOF por ser outra moeda e convers\u00E3o cambial salgada do cart\u00E3o de cr\u00E9dito).</p>'
          + '<p>Ent\u00E3o aproveite! Seguindo esse roteiro, voc\u00EA ter\u00E1 uma viagem inesquec\u00EDvel e economizar\u00E1 muito!</p>'
          + '<p>Boa viagem! \u2708\uFE0F</p>'
          + '<p>Equipe Grupo Dicas</p>'
          + '</div>'
      })
    });
    var emailData = await emailRes.json();
    console.log('Email status:', emailRes.status, JSON.stringify(emailData).substring(0, 200));
  } catch (e) {
    console.error('Erro ao enviar email:', e.message);
  }

  // 6. Enviar SMS via Twilio (se celular foi informado)
  if (d.celular && process.env.TWILIO_ACCOUNT_SID) {
    console.log('Enviando SMS para:', d.celular);
    var nomeFirstSms = d.nome ? d.nome.split(' ')[0] : 'Viajante';
    var destinoSms = d.destino ? d.destino.substring(0, 60) : 'sua viagem';
    var smsBody = 'Ola, ' + nomeFirstSms + '! Seu roteiro de ' + destinoSms + ' ficou pronto! Confira no seu email (' + d.email + '). Se nao encontrar, verifique a pasta de spam. Boa viagem! - Equipe Grupo Dicas';

    // Formatar numero para formato internacional (+55...)
    var celularFormatado = d.celular.replace(/\D/g, '');
    if (celularFormatado.length === 11) {
      celularFormatado = '+55' + celularFormatado;
    } else if (celularFormatado.length === 13 && celularFormatado.startsWith('55')) {
      celularFormatado = '+' + celularFormatado;
    } else if (!celularFormatado.startsWith('+')) {
      celularFormatado = '+55' + celularFormatado;
    }
    console.log('SMS numero formatado:', celularFormatado);

    try {
      var twilioAuth = Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64');
      var smsRes = await fetch(
        'https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + twilioAuth,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'To=' + encodeURIComponent(celularFormatado) + '&From=' + encodeURIComponent(process.env.TWILIO_PHONE_NUMBER) + '&Body=' + encodeURIComponent(smsBody)
        }
      );
      var smsData = await smsRes.json();
      console.log('SMS status:', smsRes.status, 'SID:', smsData.sid || 'erro', 'Msg:', smsData.message || smsData.error_message || '');
      if (smsData.error_code) {
        console.error('SMS erro:', smsData.error_message);
      }
    } catch (smsErr) {
      console.error('Erro ao enviar SMS:', smsErr.message);
    }
  }

  // 7. Atualizar Airtable
  if (recordId) {
    await atualizarAirtable(recordId, 'Enviado');
  }

  console.log('=== ROTEIRO COMPLETO! ID:', roteiroId, '===');
}

// =============================================================
// GERACAO VIA CLAUDE API COM STREAMING + PROMPT CACHING
// =============================================================
async function gerarHtmlComClaude(d) {
  var startTime = Date.now();
  var userPrompt = buildUserPrompt(d);

  console.log('Chamando Claude Opus com streaming...');
  console.log('API Key existe:', !!process.env.ANTHROPIC_API_KEY);

  var claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 64000,
      stream: true,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userPrompt }]
    }),
    // Timeout generoso no nivel do fetch (45 minutos)
    timeout: 45 * 60 * 1000
  });

  console.log('Claude conectou, status:', claudeResponse.status);

  if (!claudeResponse.ok) {
    var errTxt = await claudeResponse.text();
    throw new Error('Claude API erro ' + claudeResponse.status + ': ' + errTxt.substring(0, 500));
  }

  // Processar stream SSE
  var html = '';
  var totalTokensIn = 0;
  var totalTokensOut = 0;
  var cacheCreated = 0;
  var cacheRead = 0;
  var ultimoLog = Date.now();
  var buffer = '';

  return new Promise(function(resolve, reject) {
    claudeResponse.body.on('data', function(chunk) {
      buffer += chunk.toString('utf8');

      // Processar eventos SSE linha por linha
      var linhas = buffer.split('\n');
      buffer = linhas.pop(); // manter ultima linha incompleta no buffer

      for (var i = 0; i < linhas.length; i++) {
        var linha = linhas[i].trim();
        if (!linha || !linha.startsWith('data: ')) continue;

        var jsonStr = linha.substring(6);
        if (jsonStr === '[DONE]') continue;

        try {
          var evento = JSON.parse(jsonStr);

          // Conteudo sendo gerado
          if (evento.type === 'content_block_delta' && evento.delta && evento.delta.text) {
            html += evento.delta.text;

            // Log de progresso a cada 5 segundos
            if (Date.now() - ultimoLog > 5000) {
              var elapsed = Math.round((Date.now() - startTime) / 1000);
              console.log('Streaming: ' + html.length + ' chars, ' + elapsed + 's decorridos');
              ultimoLog = Date.now();
            }
          }

          // Info de tokens (no inicio e no fim)
          if (evento.type === 'message_start' && evento.message && evento.message.usage) {
            totalTokensIn = evento.message.usage.input_tokens || 0;
            cacheCreated = evento.message.usage.cache_creation_input_tokens || 0;
            cacheRead = evento.message.usage.cache_read_input_tokens || 0;
          }
          if (evento.type === 'message_delta' && evento.usage) {
            totalTokensOut = evento.usage.output_tokens || 0;
          }

          // Erro no stream
          if (evento.type === 'error') {
            return reject(new Error('Stream error: ' + JSON.stringify(evento.error)));
          }
        } catch (parseErr) {
          // Ignorar linhas que nao sao JSON valido (eventos ping, etc)
        }
      }
    });

    claudeResponse.body.on('end', function() {
      var elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log('=== Stream finalizado em ' + elapsed + 's ===');
      console.log('Tokens input:', totalTokensIn, '| output:', totalTokensOut);
      console.log('Cache criado:', cacheCreated, '| Cache lido:', cacheRead);

      if (!html || html.length < 1000) {
        return reject(new Error('HTML gerado muito curto ou vazio: ' + html.length + ' chars'));
      }

      // Limpar possiveis backticks
      html = html.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
      resolve(html);
    });

    claudeResponse.body.on('error', function(err) {
      reject(new Error('Stream connection error: ' + err.message));
    });
  });
}

// =============================================================
// USER PROMPT - DADOS VARIAVEIS DO USUARIO
// Edite aqui APENAS se adicionar/remover campos no formulario
// =============================================================
function buildUserPrompt(d) {
  return [
    'Gere um roteiro personalizado com os seguintes dados:',
    '',
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
    'Siga rigorosamente TODAS as regras e as 9 secoes obrigatorias. Retorne APENAS o HTML completo.'
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
