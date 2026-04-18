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

// API endpoint para dados do dashboard (JSON)
app.get('/api/dashboard', async function(req, res) {
  try {
    var allRecords = [];
    var offset = null;
    do {
      var url = 'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/Pedidos?pageSize=100' + (offset ? '&offset=' + offset : '');
      var aRes = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN }
      });
      var aData = await aRes.json();
      allRecords = allRecords.concat(aData.records || []);
      offset = aData.offset;
    } while (offset);
    res.json({ records: allRecords });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dashboard HTML
app.get('/dashboard', function(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

var DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grupo Dicas - Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Outfit',sans-serif;min-height:100vh;background:linear-gradient(135deg,#0a0a1a 0%,#1a1a3e 50%,#0d1117 100%);color:#fff;padding:24px}
.container{max-width:1200px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;margin-bottom:32px}
.logo{font-size:28px;font-weight:700}
.logo .m{color:#E91E8C}
.logo .c{color:#00BCD4}
.logo .sub{color:rgba(255,255,255,0.3);font-weight:400;font-size:18px;margin-left:12px}
.btn-refresh{padding:8px 20px;border-radius:10px;border:1px solid rgba(0,188,212,0.3);background:rgba(0,188,212,0.1);color:#00BCD4;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.updated{color:rgba(255,255,255,0.3);font-size:12px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px}
.kpi{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px 24px;display:flex;align-items:center;gap:16px}
.kpi-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0}
.kpi-val{font-size:28px;font-weight:700;line-height:1}
.kpi-label{font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
@media(max-width:768px){.charts{grid-template-columns:1fr}}
.card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px}
.card-title{font-size:15px;font-weight:600;color:rgba(255,255,255,0.7);margin:0 0 20px}
.bar-chart{display:flex;align-items:flex-end;gap:6px;height:160px}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px}
.bar-val{font-size:11px;color:#00BCD4;font-weight:600}
.bar{width:100%;border-radius:6px 6px 2px 2px;min-height:4px;background:linear-gradient(180deg,#00BCD4,#0097A7);transition:height 0.5s}
.bar-label{font-size:9px;color:rgba(255,255,255,0.3);white-space:nowrap}
.dest-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.dest-num{font-size:12px;color:rgba(255,255,255,0.5);width:20px;text-align:right}
.dest-bar-bg{flex:1;background:rgba(255,255,255,0.05);border-radius:8px;height:28px;position:relative;overflow:hidden}
.dest-bar-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,rgba(233,30,140,0.3),rgba(0,188,212,0.3));border-radius:8px}
.dest-name{position:relative;z-index:1;font-size:12px;color:rgba(255,255,255,0.8);padding:0 10px;line-height:28px;font-weight:500}
.dest-count{font-size:13px;color:#00BCD4;font-weight:700;min-width:24px;text-align:right}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
@media(max-width:768px){.stats-grid{grid-template-columns:1fr}}
.stat-pills{display:flex;gap:12px;flex-wrap:wrap}
.pill{background:rgba(255,255,255,0.05);border-radius:12px;padding:12px 20px;text-align:center}
.pill-val{font-size:24px;font-weight:700}
.pill-label{font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:10px 12px;color:rgba(255,255,255,0.4);font-weight:500;border-bottom:1px solid rgba(255,255,255,0.06);white-space:nowrap}
td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.03)}
.status-badge{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600}
.footer{text-align:center;margin-top:32px;color:rgba(255,255,255,0.15);font-size:12px}
.loading{text-align:center;padding:60px;color:rgba(255,255,255,0.3);font-size:16px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo"><span class="m">GRUPO</span><span class="c">DICAS</span><span class="sub">Dashboard</span></div>
    <div style="display:flex;align-items:center;gap:12px">
      <span class="updated" id="updatedAt"></span>
      <button class="btn-refresh" onclick="loadData()">🔄 Atualizar</button>
    </div>
  </div>
  <div id="content"><div class="loading">⏳ Carregando dados...</div></div>
</div>

<script>
async function loadData() {
  try {
    document.getElementById('updatedAt').textContent = 'Carregando...';
    var res = await fetch('/api/dashboard');
    var data = await res.json();
    if (data.error) { document.getElementById('content').innerHTML = '<div class="loading">Erro: '+data.error+'</div>'; return; }
    renderDashboard(data.records);
    document.getElementById('updatedAt').textContent = 'Atualizado: ' + new Date().toLocaleTimeString('pt-BR');
  } catch(e) {
    document.getElementById('content').innerHTML = '<div class="loading">Erro ao carregar: '+e.message+'</div>';
  }
}

function renderDashboard(records) {
  var total = records.length;
  var sc = {Gerando:0,Gerado:0,Enviado:0,Erro:0};
  var dailyMap = {}, monthlyMap = {}, orcMap = {}, viajMap = {};
  var cidadeMap = {}, paisMap = {};
  var hoje = new Date().toLocaleDateString('pt-BR');
  var hojeCount = 0;
  var comCel = 0;

  // Mapa de cidades para paises
  var cidadePais = {
    'roma':'Itália','florenca':'Itália','veneza':'Itália','milao':'Itália','napoles':'Itália','florença':'Itália','milano':'Itália','toscana':'Itália','amalfi':'Itália','cinque terre':'Itália',
    'paris':'França','nice':'França','lyon':'França','marselha':'França','bordeaux':'França',
    'londres':'Inglaterra','liverpool':'Inglaterra','edinburgo':'Escócia','dublin':'Irlanda',
    'barcelona':'Espanha','madri':'Espanha','madrid':'Espanha','sevilha':'Espanha','ibiza':'Espanha','mallorca':'Espanha','malaga':'Espanha',
    'lisboa':'Portugal','porto':'Portugal','algarve':'Portugal','faro':'Portugal',
    'berlim':'Alemanha','munique':'Alemanha','frankfurt':'Alemanha',
    'amsterda':'Holanda','amsterdam':'Holanda',
    'praga':'República Tcheca','viena':'Áustria','zurique':'Suíça','genebra':'Suíça','interlaken':'Suíça',
    'atenas':'Grécia','santorini':'Grécia','mykonos':'Grécia','creta':'Grécia',
    'istambul':'Turquia','cairo':'Egito','dubai':'Emirados Árabes','abu dhabi':'Emirados Árabes',
    'miami':'EUA','orlando':'EUA','nova york':'EUA','new york':'EUA','ny':'EUA','las vegas':'EUA','los angeles':'EUA','san francisco':'EUA','chicago':'EUA','san diego':'EUA','hawaii':'EUA','boston':'EUA','washington':'EUA',
    'cancun':'México','riviera maya':'México','cidade do mexico':'México','playa del carmen':'México',
    'punta cana':'República Dominicana',
    'buenos aires':'Argentina','bariloche':'Argentina','mendoza':'Argentina','ushuaia':'Argentina',
    'santiago':'Chile','atacama':'Chile',
    'cartagena':'Colômbia','bogota':'Colômbia','san andres':'Colômbia',
    'cusco':'Peru','lima':'Peru','machu picchu':'Peru',
    'montevideo':'Uruguai',
    'aruba':'Aruba','bahamas':'Bahamas','jamaica':'Jamaica','curacao':'Curaçao',
    'tokyo':'Japão','kyoto':'Japão','osaka':'Japão',
    'bangkok':'Tailândia','phuket':'Tailândia',
    'bali':'Indonésia',
    'cape town':'África do Sul',
    'maldivas':'Maldivas',
    'rio de janeiro':'Brasil','sao paulo':'Brasil','florianopolis':'Brasil','salvador':'Brasil','gramado':'Brasil','bonito':'Brasil','fernando de noronha':'Brasil','maceio':'Brasil','fortaleza':'Brasil','jericoacoara':'Brasil','foz do iguacu':'Brasil','buzios':'Brasil','campos do jordao':'Brasil','balneario camboriu':'Brasil'
  };
  var cidadesConhecidas = Object.keys(cidadePais);

  // Data de 30 dias atras
  var d30 = new Date(); d30.setDate(d30.getDate()-30);

  records.forEach(function(r) {
    var f = r.fields;
    sc[f.Status] = (sc[f.Status]||0) + 1;
    if (f.Celular && f.Celular.trim()) comCel++;

    var criado = r.createdTime || f.Criado_Em || '';
    var criadoDate = criado ? new Date(criado) : null;

    // Diario
    if (criadoDate) {
      var dia = criadoDate.toLocaleDateString('pt-BR');
      dailyMap[dia] = (dailyMap[dia]||0) + 1;
      if (dia === hoje) hojeCount++;

      // Mensal
      var mes = criadoDate.toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
      monthlyMap[mes] = (monthlyMap[mes]||0) + 1;
    }

    var orc = f.Orcamento || 'N/A';
    orcMap[orc] = (orcMap[orc]||0) + 1;
    var viaj = f.Viajantes || 'N/A';
    viajMap[viaj] = (viajMap[viaj]||0) + 1;

    // Extrair cidades e paises (ultimos 30 dias)
    if (criadoDate && criadoDate >= d30) {
      var destLower = (f.Destino||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
      cidadesConhecidas.forEach(function(cid) {
        var cidNorm = cid.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
        if (destLower.includes(cidNorm)) {
          // Capitalizar nome da cidade
          var cidCap = cid.charAt(0).toUpperCase() + cid.slice(1);
          cidadeMap[cidCap] = (cidadeMap[cidCap]||0) + 1;
          var pais = cidadePais[cid];
          if (pais) paisMap[pais] = (paisMap[pais]||0) + 1;
        }
      });
    }
  });

  var taxaCel = total > 0 ? Math.round((comCel/total)*100) : 0;

  // KPIs
  var html = '<div class="kpi-grid">';
  html += kpi('📊','Total de Roteiros',total,'#00BCD4');
  html += kpi('📅','Hoje',hojeCount,'#E91E8C');
  html += kpi('✅','Enviados',sc.Enviado||0,'#10B981');
  html += kpi('⏳','Aguardando Envio',sc.Gerado||0,'#3B82F6');
  html += kpi('🔄','Gerando Agora',sc.Gerando||0,'#F59E0B');
  html += kpi('❌','Erros',sc.Erro||0,'#EF4444');
  html += kpi('📱','Com Celular',taxaCel+'%','#8B5CF6');
  html += '</div>';

  // ===== GRAFICOS DIARIO (30 dias) + MENSAL =====
  var dailyArr = Object.entries(dailyMap).sort(function(a,b){
    var da = a[0].split('/').reverse().join('-');
    var db = b[0].split('/').reverse().join('-');
    return da.localeCompare(db);
  }).slice(-30);
  var maxD = Math.max.apply(null, dailyArr.map(function(d){return d[1]})) || 1;

  var monthlyArr = Object.entries(monthlyMap).sort(function(a,b){
    var ma = new Date(a[0]); var mb = new Date(b[0]);
    return ma-mb;
  });
  var maxM = Math.max.apply(null, monthlyArr.map(function(d){return d[1]})) || 1;

  html += '<div class="charts">';
  // Bar chart diario
  html += '<div class="card"><h3 class="card-title">📈 Roteiros por Dia (últimos 30 dias)</h3><div class="bar-chart">';
  dailyArr.forEach(function(d) {
    var h = Math.round((d[1]/maxD)*120);
    var label = d[0].substring(0,5);
    html += '<div class="bar-col"><span class="bar-val">'+d[1]+'</span><div class="bar" style="height:'+h+'px"></div><span class="bar-label">'+label+'</span></div>';
  });
  html += '</div></div>';

  // Bar chart mensal
  html += '<div class="card"><h3 class="card-title">📊 Roteiros por Mês</h3><div class="bar-chart">';
  monthlyArr.forEach(function(d) {
    var h = Math.round((d[1]/maxM)*120);
    html += '<div class="bar-col"><span class="bar-val">'+d[1]+'</span><div class="bar" style="height:'+h+'px;background:linear-gradient(180deg,#E91E8C,#C2185B)"></div><span class="bar-label">'+d[0]+'</span></div>';
  });
  if (!monthlyArr.length) html += '<p style="color:rgba(255,255,255,0.3)">Nenhum dado ainda</p>';
  html += '</div></div></div>';

  // ===== TOP 15 CIDADES + TOP 15 PAISES (ultimos 30 dias) =====
  var topCidades = Object.entries(cidadeMap).sort(function(a,b){return b[1]-a[1]}).slice(0,15);
  var topPaises = Object.entries(paisMap).sort(function(a,b){return b[1]-a[1]}).slice(0,15);

  html += '<div class="charts">';
  // Top cidades
  html += '<div class="card"><h3 class="card-title">🏙️ Top 15 Cidades (últimos 30 dias)</h3>';
  var topCMax = topCidades[0] ? topCidades[0][1] : 1;
  topCidades.forEach(function(d, i) {
    var w = Math.round((d[1]/topCMax)*100);
    html += '<div class="dest-row"><span class="dest-num">#'+(i+1)+'</span><div class="dest-bar-bg"><div class="dest-bar-fill" style="width:'+w+'%"></div><span class="dest-name">'+d[0]+'</span></div><span class="dest-count">'+d[1]+'</span></div>';
  });
  if (!topCidades.length) html += '<p style="color:rgba(255,255,255,0.3);font-size:13px">Nenhum dado ainda</p>';
  html += '</div>';

  // Top paises
  html += '<div class="card"><h3 class="card-title">🌍 Top 15 Países (últimos 30 dias)</h3>';
  var topPMax = topPaises[0] ? topPaises[0][1] : 1;
  topPaises.forEach(function(d, i) {
    var w = Math.round((d[1]/topPMax)*100);
    html += '<div class="dest-row"><span class="dest-num">#'+(i+1)+'</span><div class="dest-bar-bg"><div class="dest-bar-fill" style="width:'+w+'%;background:linear-gradient(90deg,rgba(0,188,212,0.3),rgba(16,185,129,0.3))"></div><span class="dest-name">'+d[0]+'</span></div><span class="dest-count">'+d[1]+'</span></div>';
  });
  if (!topPaises.length) html += '<p style="color:rgba(255,255,255,0.3);font-size:13px">Nenhum dado ainda</p>';
  html += '</div></div>';

  // Orcamento + Viajantes
  html += '<div class="stats-grid">';
  html += '<div class="card"><h3 class="card-title">💰 Orçamento</h3><div class="stat-pills">';
  Object.entries(orcMap).forEach(function(e) { html += '<div class="pill"><div class="pill-val" style="color:#00BCD4">'+e[1]+'</div><div class="pill-label">'+e[0]+'</div></div>'; });
  html += '</div></div>';
  html += '<div class="card"><h3 class="card-title">👥 Tipo de Viajante</h3><div class="stat-pills">';
  Object.entries(viajMap).forEach(function(e) { html += '<div class="pill"><div class="pill-val" style="color:#E91E8C">'+e[1]+'</div><div class="pill-label">'+e[0]+'</div></div>'; });
  html += '</div></div></div>';

  // Tabela ultimos
  var ultimos = records.slice().sort(function(a,b){return (b.createdTime||'').localeCompare(a.createdTime||'')}).slice(0,15);
  var statusColors = {Gerando:'#F59E0B',Gerado:'#3B82F6',Enviado:'#10B981',Erro:'#EF4444'};
  html += '<div class="card"><h3 class="card-title">🕐 Últimos Roteiros</h3><div style="overflow-x:auto"><table><thead><tr>';
  ['Nome','Destino','Dias','Orçamento','Status','📱'].forEach(function(h){html += '<th>'+h+'</th>'});
  html += '</tr></thead><tbody>';
  ultimos.forEach(function(r) {
    var f = r.fields;
    var sc2 = statusColors[f.Status] || '#6B7280';
    html += '<tr>';
    html += '<td style="color:rgba(255,255,255,0.8);font-weight:500">'+(f.Nome||'-')+'</td>';
    html += '<td style="color:rgba(255,255,255,0.6);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(f.Destino||'-')+'</td>';
    html += '<td style="color:rgba(255,255,255,0.6)">'+(f.Duracao_Dias||'-')+'</td>';
    html += '<td style="color:rgba(255,255,255,0.6)">'+(f.Orcamento||'-')+'</td>';
    html += '<td><span class="status-badge" style="background:'+sc2+'22;color:'+sc2+'">'+(f.Status||'-')+'</span></td>';
    html += '<td style="color:rgba(255,255,255,0.4)">'+(f.Celular?'📱':'—')+'</td>';
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  html += '<div class="footer">Grupo Dicas Dashboard • '+total+' roteiros no total</div>';

  document.getElementById('content').innerHTML = html;
}

function kpi(icon,label,val,color) {
  return '<div class="kpi"><div class="kpi-icon" style="background:'+color+'15">'+icon+'</div><div><div class="kpi-val" style="color:'+color+'">'+val+'</div><div class="kpi-label">'+label+'</div></div></div>';
}

loadData();
setInterval(loadData, 60000);
</script>
</body>
</html>`;


// Endpoint para gerar roteiro
app.post('/gerar', function(req, res) {
  var d = req.body;
  console.log('Recebido pedido de:', d.nome, '-', d.destino);
  res.json({ success: true, message: 'Roteiro sendo gerado' });
  processarRoteiro(d).catch(function(err) {
    console.error('Erro fatal ao processar roteiro:', err.message);
  });
});

// =============================================================
// SYSTEM PROMPT - REGRAS FIXAS (com prompt caching)
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
  '3. BOX DE DESTAQUE - "Reserve tudo acessando esses links!" (OBRIGATORIO)',
  'Este box deve aparecer LOGO APOS o resumo da viagem, ANTES do checklist. Design com muito destaque visual (fundo gradiente primary com texto branco, ou borda grossa colorida, icones grandes). Deve conter 3 mensagens:',
  '- MELHOR PRECO: "Todos os sites e servicos indicados neste roteiro sao os mais baratos que encontramos em anos de viagem. Ja testamos, ja compramos, e usamos esses mesmos sites em todas as nossas viagens."',
  '- DESCONTOS EXCLUSIVOS: "Nossos links ja incluem descontos e parcerias exclusivas que conseguimos para voce. Sao precos que voce nao encontra em nenhum outro lugar."',
  '- TRANSPARENCIA: "Ao reservar pelos nossos links, voce nos ajuda a continuar criando conteudo gratuito e roteiros como esse para milhares de viajantes. Nao custa nada a mais pra voce e faz toda a diferenca pra gente continuar esse trabalho. Obrigado!"',
  '- Design sugerido: box com background linear-gradient(135deg, var(--primary), var(--primary-dark)), texto branco, border-radius 20px, padding 30px, com icones de coracao, estrela e moeda',
  '',
  '4. ONDE FICAR (HOSPEDAGEM) - REGRAS DETALHADAS',
  '',
  'REGRAS GERAIS DE HOTEIS:',
  '- Texto introdutorio: "Esses sao hoteis que ja ficamos hospedados e indicamos de olhos fechados! Selecionamos opcoes com nota acima de 8.0 no Booking, mais de 1000 avaliacoes reais, na melhor localizacao e com os melhores precos da regiao."',
  '- Box verde de economia: "Dica de grande economia: Quanto antes voce fizer a reserva, mais barato ira pagar. Quase todos os hoteis oferecem cancelamento gratuito - reserve agora para garantir o preco!"',
  '- LOCALIZACAO E PRIORIDADE #1: Sempre indicar hoteis na MELHOR regiao turistica. NUNCA sugerir hotel longe das atracoes.',
  '- PARAMETROS MINIMOS OBRIGATORIOS: nota Booking minimo 8.0, minimo 1000 avaliacoes.',
  '- FOCO NO PRECO: Dentro da melhor localizacao e dos parametros minimos, SEMPRE busque as opcoes MAIS BARATAS possiveis.',
  '- Adaptar ao orcamento: Economico = mais barato possivel. Moderado = 3-4 estrelas mais baratos. Luxo = melhor custo-beneficio entre os de luxo.',
  '- Cada hotel DEVE ter botao com link afiliado Booking: "Reserve com cancelamento gratis"',
  '',
  'REGRA ESPECIAL - DESTINOS DE PRAIA COM RESORTS ALL INCLUSIVE:',
  'Para destinos como Punta Cana, Cancun, Riviera Maya, Jamaica, Aruba, Bahamas, Caribe:',
  '- SEMPRE oferecer 4 opcoes: 2 RESORTS ALL INCLUSIVE adaptados ao orcamento + 2 HOTEIS/POUSADAS mais baratas para quem quer focar nos passeios',
  '- Explicar a diferenca entre as opcoes. Para resorts: destacar o que inclui (refeicoes, bebidas, atividades)',
  '',
  'REGRA ESPECIAL - DESTINOS ONDE CARRO E ESSENCIAL:',
  'Para destinos como Miami, Orlando, Los Angeles, Toscana, Algarve:',
  '- Box de DESTAQUE: "Em [destino], ter carro e praticamente obrigatorio."',
  '- Link: https://www.rentcars.com/pt-br/?campaign=App&content=[Pais]&requestorid=42&source=Carro',
  '- Mencionar aluguel de carro no checklist E no dia a dia. Para destinos urbanos (Paris, Londres, NY), NAO destacar.',
  '',
  '5. ANTES DE VIAJAR (CHECKLIST) - SECAO CRITICA DE MONETIZACAO',
  'Titulo: "Itens que voce JA precisa reservar". Links de afiliados em TODOS os itens:',
  '- Seguro: https://www.seguroviagem.srv.br/?ag=215&lead_tag=App_[Pais]&promo=18exclusivogrupodicas (NUNCA citar "Seguros Promo")',
  '- Ingressos/passeios: https://www.civitatis.com/pt/[cidade]/?aid=3472&cmp=App_[Pais] (link generico da cidade)',
  '- Transfers: https://www.civitatis.com/pt/[cidade-em-portugues-sem-acento]/transfers/?aid=3472&cmp=App_[Pais]',
  '- Trens: https://click.linksynergy.com/deeplink?id=czqBaUUVmPg&mid=42638&murl=https%3A%2F%2Fwww.raileurope.com%2F%3Fcountry%3DBR%26locale%3Dpt%26currency%3DEUR&u1=App (NUNCA citar "Rail Europe")',
  '- Aluguel carro: https://www.rentcars.com/pt-br/?campaign=App&content=[Pais]&requestorid=42&source=Carro (NUNCA citar "RentCars")',
  '- Conta global: https://nomad.onelink.me/wIQT/gabriellorenzi15 cupom GABRIELLORENZI20 (NUNCA citar "Nomad")',
  '- Chip: https://americachip.com/?oid=12&affid=103&sub1=App (NUNCA citar "America Chip")',
  '- Documentacao e itens para levar (personalizar por clima/epoca)',
  '',
  '6. ROTEIRO DIA A DIA - SECAO PRINCIPAL COM MONETIZACAO INTEGRADA',
  'Para CADA dia: header com gradiente, 4-6 atividades com horario, emoji, descricao detalhada, preco em R$, dicas praticas.',
  '- Aeroportos: tempo ate centro + link transfer Civitatis',
  '- Passeios: link generico Civitatis da cidade + CTA "Compre em reais, sem IOF"',
  '- Transporte entre cidades: BOX NO MEIO DO ROTEIRO (nao no final) com trem/onibus/carro, tempos, precos, links afiliados',
  '- Carro (quando essencial): dicas estacionamento, pedagios, reforcar link aluguel',
  '- Restaurantes: sugerir especificos com nome, tipo, faixa de preco em R$',
  '- Resumo de gastos ao final de cada dia',
  '',
  '7. DICAS PARA ECONOMIZAR - 6 cards praticos com links de afiliados quando relevante',
  '',
  '8. BOXES DOS PARCEIROS - FORMATO PADRAO FIXO (mesmo texto para todos os roteiros, so trocar [Pais]):',
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
  '9. CONTRACAPA - Fundo escuro, logo, tagline, site, nome viajante',
  '',
  'TOM DE VOZ: Amigavel, como amigo que ja foi. Narrativa envolvente. Precos em R$. Vendedor sutil. Urgencia natural.',
  '',
  'PERSONALIZACAO POR EPOCA - NOSSO GRANDE DIFERENCIAL:',
  'Voce DEVE considerar as datas exatas da viagem e personalizar TODO o roteiro com base nisso. Este e o diferencial do Grupo Dicas - pensar em TUDO para o viajante. Especificamente:',
  '- CLIMA: Pesquise a temperatura media e condicoes climaticas de CADA cidade nas datas da viagem. Adapte sugestoes de roupas no checklist, sugira atividades internas em dias tipicamente chuvosos, e mencione o clima em cada dia do roteiro.',
  '- EVENTOS E FERIADOS: Considere eventos sazonais, festivais, feriados locais e nacionais. Inclua eventos especificos quando houver e alerte sobre feriados que fecham atracoes. Exemplos: Natal e mercados natalinos na Europa em dezembro, Carnaval em fevereiro, alta temporada jun-ago, baixa temporada com precos menores em novembro.',
  '- HORARIO DE FUNCIONAMENTO: Adapte horarios considerando a epoca (dias mais longos no verao = mais tempo para passear, inverno = escurece cedo = priorize atividades de manha).',
  '- LOTACAO: Alerte sobre alta temporada (filas maiores, reserva antecipada obrigatoria). Na baixa temporada, destaque beneficios (menos filas, precos menores, experiencia mais tranquila).',
  '- ROUPAS E ITENS: Personalize a lista de roupas com base no clima das datas especificas ("Para [mes] em [cidade], leve casacos pesados e luvas" ou "Nessa epoca so precisa de roupas leves e protetor solar").',
  '- NASCER E POR DO SOL: Considere horarios de nascer e por do sol da epoca para sugerir melhores momentos para fotos e passeios ao ar livre.',
  '',
  'REGRAS DE LINKS:',
  '- Para TRANSFERS: pode montar a URL com padrao /pt/[cidade]/transfers/ - funciona sempre. Exemplos corretos: /pt/roma/transfers/, /pt/paris/transfers/, /pt/londres/transfers/, /pt/barcelona/transfers/',
  '- Para PASSEIOS ESPECIFICOS: NAO invente URLs de paginas de passeios. Use o link generico da cidade: /pt/[cidade]/?aid=3472&cmp=App_[Pais]',
  '- Para HOTEIS BOOKING: pode montar a URL com padrao conhecido do Booking: https://www.booking.com/hotel/[codigo-pais]/[nome-hotel].pt-br.html?aid=390200&label=App_[Pais]',
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
  'REGRAS DE QUALIDADE DO CONTEUDO:',
  '- Cada dia do roteiro deve contar uma historia, nao apenas listar atividades. Exemplo: "Comece o dia cedo no Coliseu - a fila e menor antes das 9h e a luz da manha e perfeita para fotos"',
  '- Inclua dicas que so quem ja foi sabe: melhores horarios, filas menores, bancos com melhor vista, restaurantes que turista nao conhece',
  '- Precos SEMPRE em R$ (reais brasileiros) com valores aproximados e atualizados',
  '- Para cada atividade: horario sugerido, duracao estimada, preco em R$, como chegar, dica especial',
  '- Ao final de cada dia, inclua um resumo com gasto estimado total do dia em R$',
  '- Sugira restaurantes especificos para almoco e jantar com nome, tipo de comida e faixa de preco em R$',
  '- Inclua alternativas para dias de chuva quando relevante',
  '- Para familias com criancas, destaque atividades kid-friendly e horarios mais adequados',
  '- Para casais, destaque momentos romanticos, restaurantes especiais e experiencias a dois',
  '- Para terceira idade, priorize atividades com menos caminhada e mais conforto',
  '',
  'REGRAS DE DESIGN HTML:',
  '- Todos os botoes de CTA devem ter: border-radius 12px, padding 14px 28px, font-weight 600, cor branca com fundo gradiente',
  '- Botoes de hotel: fundo linear-gradient(135deg, #00BCD4, #0097A7)',
  '- Botoes de passeio/ingresso: fundo linear-gradient(135deg, #E91E8C, #C2185B)',
  '- Botoes de transfer: fundo linear-gradient(135deg, #FF9800, #F57C00)',
  '- Botoes de trem: fundo linear-gradient(135deg, #4CAF50, #388E3C)',
  '- Botoes de aluguel de carro: fundo linear-gradient(135deg, #2196F3, #1565C0)',
  '- Cada secao deve ter separacao visual clara com margin-top de pelo menos 40px',
  '- Icones emoji devem ser usados generosamente para tornar o roteiro visual e agradavel',
  '- Boxes de transporte entre cidades: border-left 4px solid var(--warning), background #FFF8E1, padding 20px, border-radius 12px',
  '- O roteiro deve ser bonito tanto no desktop quanto no celular (responsivo)',
  '',
  'Retorne APENAS o HTML completo, comecando com <!DOCTYPE html>.'
].join('\n');

// =============================================================
// FUNCAO AUXILIAR - Mascarar email para SMS (LGPD)
// =============================================================
function mascararEmail(email) {
  if (!email || !email.includes('@')) return '***';
  var partes = email.split('@');
  var usuario = partes[0];
  var dominio = partes[1];
  var uMask = usuario.length <= 3 ? usuario[0] + '***' : usuario.substring(0, 2) + '*****' + usuario.substring(usuario.length - 2);
  var dMask = dominio.length <= 5 ? '***' : dominio.substring(0, 2) + '*****' + dominio.substring(dominio.length - 2);
  return uMask + ' ' + dMask;
}

// =============================================================
// PROCESSAMENTO PRINCIPAL
// =============================================================
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
        console.log('Aguardando 10s antes de tentar novamente...');
        await new Promise(function(resolve) { setTimeout(resolve, 10000); });
      }
    }
  }

  if (!html) {
    console.error('FALHA TOTAL apos ' + maxTentativas + ' tentativas para roteiroId:', roteiroId);
    if (recordId) await atualizarAirtable(recordId, { Status: 'Erro' });
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
    if (recordId) await atualizarAirtable(recordId, { Status: 'Erro' });
    return;
  }

  // 4. Atualizar Airtable para Gerado + salvar horario de envio e roteiroId
  var DELAY_HORAS = 2;
  var enviarEm = new Date(Date.now() + DELAY_HORAS * 60 * 60 * 1000).toISOString();
  if (recordId) {
    await atualizarAirtable(recordId, {
      Status: 'Gerado',
      Enviar_Em: enviarEm,
      Roteiro_ID: roteiroId
    });
  }

  console.log('Roteiro gerado! Envio agendado para:', enviarEm);
}

// =============================================================
// FILA PERSISTENTE - Verifica a cada 5 min quem precisa ser enviado
// =============================================================
async function verificarFilaDeEnvio() {
  try {
    // Buscar roteiros com Status = Gerado
    var url = 'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/Pedidos?filterByFormula=' + encodeURIComponent("{Status}='Gerado'") + '&maxRecords=10';
    var res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN }
    });
    var data = await res.json();

    if (!data.records || data.records.length === 0) return;

    var agora = new Date();
    for (var i = 0; i < data.records.length; i++) {
      var reg = data.records[i];
      var enviarEm = reg.fields.Enviar_Em ? new Date(reg.fields.Enviar_Em) : null;

      // Se Enviar_Em ja passou, enviar agora
      if (enviarEm && agora >= enviarEm) {
        console.log('=== Fila: Enviando roteiro para', reg.fields.Nome, '===');
        await enviarEmailESms(reg);
      }
    }
  } catch (e) {
    console.error('Erro na fila de envio:', e.message);
  }
}

// Rodar a fila a cada 5 minutos
setInterval(verificarFilaDeEnvio, 5 * 60 * 1000);
// Rodar uma vez ao iniciar (pega pendentes de antes do redeploy)
setTimeout(verificarFilaDeEnvio, 30 * 1000);

// =============================================================
// ENVIO DE EMAIL + SMS (chamado pela fila)
// =============================================================
async function enviarEmailESms(reg) {
  var f = reg.fields;
  var recordId = reg.id;
  var roteiroId = f.Roteiro_ID || recordId;
  var nomeFirst = f.Nome ? f.Nome.split(' ')[0] : 'Viajante';
  var destinoShort = f.Destino ? f.Destino.substring(0, 50) : 'sua viagem';

  // 1. Enviar email
  console.log('Enviando email para:', f.Email);
  try {
    var emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Fernanda | Grupo Dicas <roteiros@grupodicas.com>',
        reply_to: 'roteiros@grupodicas.com',
        to: [f.Email],
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
          + '<div style="margin-top:32px;padding-top:24px;border-top:2px solid #E0F7FA;">'
          + '<table cellpadding="0" cellspacing="0" border="0"><tr>'
          + '<td style="padding-right:16px;border-right:3px solid #00BCD4;">'
          + '<p style="margin:0;font-weight:700;color:#1A1A2E;font-size:16px;">Fernanda Rodrigues</p>'
          + '<p style="margin:3px 0 0;color:#00BCD4;font-size:13px;font-weight:600;">Especialista em Roteiros</p>'
          + '</td>'
          + '<td style="padding-left:16px;">'
          + '<p style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.5px;"><span style="color:#E91E8C;">GRUPO</span><span style="color:#00BCD4;">DICAS</span></p>'
          + '<p style="margin:2px 0 0;color:#9CA3AF;font-size:11px;font-weight:500;">Roteiros Personalizados</p>'
          + '</td>'
          + '</tr></table>'
          + '</div>'
          + '</div>'
      })
    });
    var emailData = await emailRes.json();
    console.log('Email status:', emailRes.status, JSON.stringify(emailData).substring(0, 200));
  } catch (e) {
    console.error('Erro ao enviar email:', e.message);
  }

  // 2. Enviar SMS via Twilio (se celular foi informado)
  if (f.Celular && process.env.TWILIO_ACCOUNT_SID) {
    console.log('Enviando SMS para:', f.Celular);
    var emailMascarado = mascararEmail(f.Email);
    var smsBody = 'Olá, ' + nomeFirst + '! Seu roteiro de viagem personalizado ficou pronto! Confira no email enviado para ' + emailMascarado + '. Se não encontrar, verifique as pastas de spam e promoções. Mova para a caixa de entrada para não perder o acesso! Boa viagem! - Equipe Grupo Dicas';

    // O numero ja vem formatado com codigo do pais do intl-tel-input (ex: +5511999999999)
    var celularFormatado = f.Celular.replace(/\s/g, '');
    if (!celularFormatado.startsWith('+')) {
      // Fallback: se nao veio com +, tentar adicionar +55
      var nums = celularFormatado.replace(/\D/g, '');
      if (nums.length === 11) {
        celularFormatado = '+55' + nums;
      } else if (nums.length === 13 && nums.startsWith('55')) {
        celularFormatado = '+' + nums;
      } else {
        celularFormatado = '+' + nums;
      }
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
    } catch (smsErr) {
      console.error('Erro ao enviar SMS:', smsErr.message);
    }
  }

  // 3. Atualizar Airtable para Enviado
  await atualizarAirtable(recordId, { Status: 'Enviado' });
  console.log('=== ROTEIRO ENVIADO! ID:', roteiroId, '===');
}

// =============================================================
// GERACAO VIA CLAUDE API COM STREAMING + PROMPT CACHING
// =============================================================
async function gerarHtmlComClaude(d) {
  var startTime = Date.now();
  var userPrompt = buildUserPrompt(d);

  console.log('Chamando Claude Opus com streaming...');

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
    timeout: 45 * 60 * 1000
  });

  if (!claudeResponse.ok) {
    var errTxt = await claudeResponse.text();
    throw new Error('Claude API erro ' + claudeResponse.status + ': ' + errTxt.substring(0, 500));
  }

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
      var linhas = buffer.split('\n');
      buffer = linhas.pop();

      for (var i = 0; i < linhas.length; i++) {
        var linha = linhas[i].trim();
        if (!linha || !linha.startsWith('data: ')) continue;
        var jsonStr = linha.substring(6);
        if (jsonStr === '[DONE]') continue;

        try {
          var evento = JSON.parse(jsonStr);
          if (evento.type === 'content_block_delta' && evento.delta && evento.delta.text) {
            html += evento.delta.text;
            if (Date.now() - ultimoLog > 5000) {
              console.log('Streaming: ' + html.length + ' chars, ' + Math.round((Date.now() - startTime) / 1000) + 's');
              ultimoLog = Date.now();
            }
          }
          if (evento.type === 'message_start' && evento.message && evento.message.usage) {
            totalTokensIn = evento.message.usage.input_tokens || 0;
            cacheCreated = evento.message.usage.cache_creation_input_tokens || 0;
            cacheRead = evento.message.usage.cache_read_input_tokens || 0;
          }
          if (evento.type === 'message_delta' && evento.usage) {
            totalTokensOut = evento.usage.output_tokens || 0;
          }
          if (evento.type === 'error') {
            return reject(new Error('Stream error: ' + JSON.stringify(evento.error)));
          }
        } catch (parseErr) {}
      }
    });

    claudeResponse.body.on('end', function() {
      console.log('=== Stream finalizado em ' + Math.round((Date.now() - startTime) / 1000) + 's ===');
      console.log('Tokens input:', totalTokensIn, '| output:', totalTokensOut);
      console.log('Cache criado:', cacheCreated, '| Cache lido:', cacheRead);
      if (!html || html.length < 1000) {
        return reject(new Error('HTML muito curto: ' + html.length + ' chars'));
      }
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

// =============================================================
// ATUALIZAR AIRTABLE (aceita objeto com multiplos campos)
// =============================================================
async function atualizarAirtable(recordId, campos) {
  try {
    await fetch(
      'https://api.airtable.com/v0/' + process.env.AIRTABLE_BASE_ID + '/Pedidos/' + recordId,
      {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + process.env.AIRTABLE_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: campos })
      }
    );
    console.log('Airtable atualizado:', JSON.stringify(campos));
  } catch (e) {
    console.error('Erro ao atualizar Airtable:', e.message);
  }
}

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Servidor rodando na porta ' + PORT);
});
