/* Radar Votuporanga — mapa de radares com alerta por GPS. Sem dependências além do Leaflet. */
(function () {
  'use strict';

  const CENTRO = [-20.4176, -49.9745];
  const RAIO_ALERTA = { velocidade: 300, semaforo: 250, rodovia: 650, placa: 200 };
  const RAIO_BUSCA = 1500; // m: até onde o painel mostra o "próximo radar"

  const NOMES_TIPO = {
    velocidade: 'Radar fixo de velocidade',
    semaforo: 'Radar de semáforo (avanço de sinal)',
    rodovia: 'Radar de rodovia (DER-SP)',
    placa: 'Câmera de leitura de placa (OCR)'
  };
  const NOMES_STATUS = {
    verificado: '✓ Verificado pelo Ipem',
    ativo: 'Em operação',
    confirmar: 'A confirmar',
    previsto: 'Previsto'
  };

  const ICO = {
    semaforo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="3" fill="#2b3036"/><circle cx="12" cy="6.5" r="2.2" fill="#ff3b3b"/><circle cx="12" cy="12" r="2.2" fill="#f5b400"/><circle cx="12" cy="17.5" r="2.2" fill="#2fbf71"/></svg>',
    placa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6H8l1.5-2h5L16 6h2.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    foto: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12.5" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 6l1.2-2h4.6l1.2 2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    placaCarro: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="7" width="19" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 12h3M11 12h2M15 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    relogio: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    velocimetro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17a8 8 0 1 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 17l4-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    banco: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="2.8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    pessoa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    seta: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11.5" fill="#fff"/><circle cx="13" cy="13" r="9" fill="var(--user)"/><path d="M13 5.5l4.8 11.2L13 14l-4.8 2.7z" fill="#fff"/></svg>'
  };

  // O que cada tipo de equipamento registra (Res. Contran 798/2020 para radares; programas estaduais/federais para OCR).
  const REGISTRA = {
    velocidade: [
      [ICO.velocimetro, 'Velocidade de todos que passam', 'Mede cada veículo na faixa, mas só gera registro quando passa do limite mais a tolerância.'],
      [ICO.foto, 'Foto do veículo com a placa legível', 'Tirada na hora da infração. A placa é a única identificação usada; o rosto do motorista não é necessário.'],
      [ICO.relogio, 'Data, hora e local', 'Junto com o código do equipamento e a data da última verificação do Ipem/Inmetro.'],
      [ICO.placaCarro, 'Velocidade medida e considerada', 'A considerada já desconta a tolerância (7 km/h até 100 km/h, 7% acima disso).'],
      [ICO.banco, 'Consulta ao cadastro do veículo', 'Com a placa, o órgão de trânsito puxa o proprietário no Renavam/Detran e manda a notificação para ele, que pode indicar o condutor.']
    ],
    rodovia: null, // igual ao de velocidade
    semaforo: [
      [ICO.foto, 'Sequência de fotos (ou vídeo) com a placa', 'Mostra o veículo antes e depois da faixa de retenção com o sinal vermelho.'],
      [ICO.relogio, 'Data, hora e tempo de vermelho', 'Registra há quantos segundos o sinal estava vermelho quando o carro cruzou.'],
      [ICO.placaCarro, 'Parada sobre a faixa de pedestres', 'O mesmo equipamento costuma registrar quem para em cima da faixa.'],
      [ICO.banco, 'Consulta ao cadastro do veículo', 'A placa leva ao proprietário no Renavam/Detran, que recebe a notificação.']
    ],
    placa: [
      [ICO.placaCarro, 'A placa de TODOS os veículos', 'Lê a placa de quem passa, a qualquer hora, sem relação com velocidade. O texto da placa vira um registro.'],
      [ICO.foto, 'Imagem do veículo', 'Em geral também marca, modelo e cor, que ajudam a achar placa clonada.'],
      [ICO.relogio, 'Data, hora, local e sentido', 'Forma o histórico de passagem do veículo por aquele ponto.'],
      [ICO.banco, 'Cruzamento automático com bancos policiais', 'Em Votuporanga as câmeras são ligadas ao Muralha Paulista (SSP-SP) e ao Alerta Brasil (PRF): alertam a polícia sobre veículo roubado ou furtado, placa clonada e veículo com restrição ou ligado a ocorrências.'],
      [ICO.pessoa, 'Não gera multa de trânsito', 'Não há notícia de multa emitida por essas câmeras em Votuporanga; o uso divulgado é segurança pública.']
    ]
  };

  // ---------- estado ----------
  let DADOS = null;
  const filtros = { velocidade: true, semaforo: true, rodovia: true, placa: true, previsto: true };
  const marcadores = new Map();
  let map, camada, userMarker, userAccuracy;
  let pos = null;             // {lat, lon, acc, kmh, heading, t}
  let ultimaPos = null;
  let watchId = null;
  let dirigindo = false;
  let seguir = false;
  let somLigado = lerPref('som', true);
  let audioCtx = null;
  let wakeLock = null;
  const alertados = new Map(); // id -> true enquanto estiver dentro do raio
  let ultimoBipAcima = 0;
  let selecionado = null;

  const $ = (s) => document.querySelector(s);

  function lerPref(k, padrao) {
    try { const v = localStorage.getItem('radarvotu.' + k); return v === null ? padrao : JSON.parse(v); } catch (e) { return padrao; }
  }
  function gravarPref(k, v) {
    try { localStorage.setItem('radarvotu.' + k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ }
  }
  Object.assign(filtros, lerPref('filtros', {}));

  // ---------- geometria ----------
  const rad = (d) => d * Math.PI / 180;
  function distancia(a, b) {
    const R = 6371000, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function rumo(a, b) {
    const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
    const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  const difAng = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  function fmtDist(m) {
    if (m < 1000) return (m < 100 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50) + ' m';
    return (m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',') + ' km';
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- regras de multa ----------
  function tolerancia(medida) { return medida <= 100 ? 7 : medida * 0.07; }
  function considerada(medida) { return medida - tolerancia(medida); }
  function primeiraMedidaAcima(lim) { let m = lim; while (considerada(m) <= lim) m++; return m; }
  function faixasMulta(lim) {
    const a = primeiraMedidaAcima(lim);
    const b = primeiraMedidaAcima(lim * 1.2);
    const c = primeiraMedidaAcima(lim * 1.5);
    return [
      [a + '–' + (b - 1), 'Até 20% acima', 'Média · R$ 130,16 · 4 pontos'],
      [b + '–' + (c - 1), '20% a 50% acima', 'Grave · R$ 195,23 · 5 pontos'],
      [c + '+', 'Mais de 50% acima', 'Gravíssima ×3 · R$ 880,41 · 7 pontos e suspensão da CNH']
    ];
  }

  // ---------- marcadores ----------
  function htmlPlaca(it, extraCls) {
    const cls = ['sign'];
    if (it.status === 'previsto') cls.push('previsto');
    if (extraCls) cls.push(extraCls);
    let miolo = '';
    if (it.tipo === 'semaforo') { cls.push('sem'); miolo = ICO.semaforo; }
    else if (it.tipo === 'placa') { cls.push('pla'); miolo = ICO.placa; }
    else {
      if (it.tipo === 'rodovia') cls.push('rod');
      if (it.limite >= 100) cls.push('big');
      miolo = it.limite ? String(it.limite) : '?';
    }
    let badge = '';
    if (it.status === 'verificado') badge = '<i class="badge ok">✓</i>';
    else if (it.status === 'confirmar') badge = '<i class="badge q">?</i>';
    return '<div class="' + cls.join(' ') + '">' + miolo + badge + '</div>';
  }

  function visivel(it) {
    if (!filtros[it.tipo]) return false;
    if (it.status === 'previsto' && !filtros.previsto) return false;
    return true;
  }

  function desenhar() {
    camada.clearLayers();
    marcadores.clear();
    for (const it of DADOS.itens) {
      if (!visivel(it)) continue;
      const icon = L.divIcon({ className: 'mk' + (selecionado === it.id ? ' sel' : ''), html: htmlPlaca(it), iconSize: [38, 38], iconAnchor: [19, 19] });
      const m = L.marker([it.lat, it.lon], { icon, title: it.nome, keyboard: true, riseOnHover: true, zIndexOffset: it.status === 'previsto' ? 0 : 100 });
      m.on('click', () => abrirDetalhe(it));
      m.addTo(camada);
      marcadores.set(it.id, m);
    }
    const ativos = DADOS.itens.filter((i) => i.tipo !== 'placa' && i.status !== 'previsto').length;
    const cams = DADOS.itens.filter((i) => i.tipo === 'placa').length;
    $('#resumo').textContent = ativos + ' radares no mapa · ' + cams + ' câmeras previstas · dados de ' + DADOS.atualizado;
  }

  // ---------- painel inferior (sheet) ----------
  function abrirSheet(html, aoFechar) {
    $('#sheet-body').innerHTML = html;
    $('#sheet').hidden = false;
    $('#backdrop').hidden = false;
    $('#sheet-body').scrollTop = 0;
    $('#sheet').__aoFechar = aoFechar;
    setTimeout(() => $('#sheet-close').focus({ preventScroll: true }), 50);
  }
  function fecharSheet() {
    $('#sheet').hidden = true;
    $('#backdrop').hidden = true;
    const f = $('#sheet').__aoFechar; $('#sheet').__aoFechar = null;
    if (f) f();
  }

  function listaFontes(ids) {
    return '<ul class="fontes">' + ids.map((k) => {
      const f = DADOS.fontes[k]; if (!f) return '';
      return '<li><a href="' + esc(f.u) + '" target="_blank" rel="noopener">' + esc(f.t) + '</a> <small>(' + esc(f.d) + ')</small></li>';
    }).join('') + '</ul>';
  }

  function blocoRegistra(tipo) {
    const lista = REGISTRA[tipo] || REGISTRA.velocidade;
    return '<div class="registra">' + lista.map(([ico, t, d]) =>
      '<div class="reg-item"><div class="reg-ico">' + ico + '</div><div><b>' + esc(t) + '</b><span>' + esc(d) + '</span></div></div>'
    ).join('') + '</div>';
  }

  function abrirDetalhe(it) {
    selecionado = it.id;
    desenhar();
    const campos = [['Tipo', NOMES_TIPO[it.tipo]]];
    if (it.sentido) campos.push(['Sentido', it.sentido]);
    if (it.limite) {
      let l = it.limite + ' km/h';
      if (it.limitePesados && it.limitePesados !== it.limite) l = it.limite + ' km/h leves · ' + it.limitePesados + ' km/h pesados';
      if (it.limiteNota) l += ' — ' + it.limiteNota + ', confira a placa';
      campos.push(['Limite', l]);
    }
    campos.push(['Posição', it.precisao === 'endereço' ? 'Pelo número do endereço' : it.precisao === 'cruzamento' ? 'No cruzamento' : 'Aproximada (' + it.precisao.replace('aprox. ', '±').replace('aprox.', 'pelo ponto de referência') + ')']);
    if (pos) campos.push(['Distância de você', fmtDist(distancia(pos, it))]);

    let multa = '';
    if ((it.tipo === 'velocidade' || it.tipo === 'rodovia') && it.limite) {
      multa = '<h3>Se passar acima de ' + it.limite + ' km/h</h3><table class="tabela-multa"><thead><tr><th>No radar</th><th>Infração</th></tr></thead><tbody>' +
        faixasMulta(it.limite).map(([v, q, m]) => '<tr><td>' + v + '</td><td>' + q + '<br><span class="nota">' + m + '</span></td></tr>').join('') +
        '</tbody></table><p class="nota">Velocidades aproximadas, já com a tolerância do radar. Valores do art. 218 do CTB.</p>';
    } else if (it.tipo === 'semaforo') {
      multa = '<h3>Infrações registradas</h3><table class="tabela-multa"><tbody>' +
        '<tr><td>Vermelho</td><td>Avançar o sinal vermelho<br><span class="nota">Gravíssima · R$ 293,47 · 7 pontos (art. 208)</span></td></tr>' +
        '<tr><td>Faixa</td><td>Parar sobre a faixa de pedestres<br><span class="nota">Média · R$ 130,16 · 4 pontos (art. 183)</span></td></tr></tbody></table>';
    }

    const gm = 'https://www.google.com/maps/search/?api=1&query=' + it.lat + ',' + it.lon;
    const wz = 'https://waze.com/ul?ll=' + it.lat + ',' + it.lon + '&navigate=yes';
    abrirSheet(
      '<div class="det-head">' + htmlPlaca(it) + '<div><span class="pill ' + it.status + '">' + NOMES_STATUS[it.status] + '</span>' +
      '<h2 id="sheet-title">' + esc(it.nome) + '</h2></div></div>' +
      '<p>' + esc(it.info) + '</p>' +
      '<dl class="campos">' + campos.map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl>' +
      '<h3>O que ele registra da sua placa</h3>' + blocoRegistra(it.tipo) + multa +
      '<h3>Fontes</h3>' + listaFontes(it.fontes) +
      '<div class="acoes"><a href="' + gm + '" target="_blank" rel="noopener">Abrir no Google Maps</a><a href="' + wz + '" target="_blank" rel="noopener">Abrir no Waze</a></div>',
      () => { selecionado = null; desenhar(); }
    );
    if (!dirigindo) map.panTo([it.lat, it.lon], { animate: true });
  }

  function abrirLista() {
    const ref = pos || { lat: map.getCenter().lat, lon: map.getCenter().lng };
    const itens = DADOS.itens.filter(visivel).map((it) => ({ it, d: distancia(ref, it) })).sort((a, b) => a.d - b.d);
    abrirSheet(
      '<h2 id="sheet-title">Radares e câmeras</h2><p class="nota">' + (pos ? 'Ordenados pela distância de você.' : 'Ordenados pela distância do centro do mapa. Toque em “Dirigir” ou no botão de localização para usar sua posição.') + '</p>' +
      '<ul class="lista">' + itens.map(({ it, d }) =>
        '<li><button data-id="' + it.id + '">' + htmlPlaca(it) + '<span class="l-txt"><b>' + esc(it.nome) + '</b><span>' + NOMES_TIPO[it.tipo] + ' · ' + NOMES_STATUS[it.status] + '</span></span><span class="l-dist">' + fmtDist(d) + '</span></button></li>'
      ).join('') + '</ul>'
    );
    $('#sheet-body').querySelectorAll('.lista button').forEach((b) => b.addEventListener('click', () => {
      const it = DADOS.itens.find((x) => x.id === b.dataset.id);
      fecharSheet();
      map.setView([it.lat, it.lon], Math.max(map.getZoom(), 16));
      abrirDetalhe(it);
    }));
  }

  function abrirInfo() {
    const confirmados = DADOS.itens.filter((i) => i.tipo !== 'placa' && i.status !== 'previsto');
    abrirSheet(
      '<h2 id="sheet-title">Sobre o mapa</h2>' +
      '<p>Locais levantados em ' + DADOS.atualizado + ' a partir de notícias da prefeitura, do Ipem-SP, do DER-SP e dos jornais da cidade. A prefeitura não publica uma lista oficial completa, então alguns pontos podem ter mudado.</p>' +
      '<div class="numeros"><div><b>20</b><span>radares fixos na cidade (prefeitura, 2025)</span></div><div><b>15.421</b><span>multas por radar em 2024 (R$ 4,5 mi)</span></div><div><b>' + confirmados.length + '</b><span>pontos com endereço neste mapa</span></div></div>' +
      '<h3>Legenda</h3><ul>' +
      '<li><b>Placa vermelha com número</b>: radar de velocidade e o limite provável. Contorno verde: rodovia.</li>' +
      '<li><b>✓ verde</b>: aprovado pelo Ipem-SP em 2025 ou 2026. <b>Sem selo</b>: em operação segundo a prefeitura. <b>?</b>: citado em 2023–2025, sem confirmação recente.</li>' +
      '<li><b>Contorno tracejado</b>: previsto, ainda sem confirmação de instalação.</li></ul>' +
      '<h3>Radar de velocidade e de rodovia</h3>' + blocoRegistra('velocidade') +
      '<h3>Radar de semáforo</h3>' + blocoRegistra('semaforo') +
      '<h3>Câmera de leitura de placa</h3><p>Votuporanga tem 57 câmeras de monitoramento, 24 delas com leitura de placa, e abriu licitação em abril de 2026 para mais 24 (16 com leitura de placa). Os pontos roxos são os locais anunciados para as novas.</p>' + blocoRegistra('placa') +
      '<h3>Sem localização exata</h3><ul>' + DADOS.semLocal.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul>' +
      '<h3>Alertas ao dirigir</h3><p>Com <b>Dirigir</b> ligado, o celular avisa por voz e bipe (e vibração no Android; o iPhone não deixa sites vibrarem) a cerca de 300 m de um radar na cidade e 650 m na rodovia, e fica vermelho se você passar do limite. A tela fica acesa enquanto o mapa estiver aberto; com a tela bloqueada ou outro app na frente, os alertas param. Para usar como app, abra no navegador e escolha <b>Adicionar à tela inicial</b>.</p>' +
      '<p class="aviso">Respeite sempre a sinalização da via: o limite real é o da placa. Não mexa no celular dirigindo.</p>' +
      '<h3>Fontes</h3>' + listaFontes(Object.keys(DADOS.fontes))
    );
  }

  // ---------- áudio e voz ----------
  function bip(freq, dur, vezes) {
    if (!audioCtx || !somLigado) return;
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < (vezes || 1); i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      const ini = t0 + i * (dur + 0.08);
      g.gain.setValueAtTime(0.0001, ini);
      g.gain.exponentialRampToValueAtTime(0.35, ini + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ini + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(ini); o.stop(ini + dur + 0.02);
    }
  }
  function falar(txt) {
    if (!somLigado || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'pt-BR'; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find((x) => /pt[-_]BR/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* voz indisponível */ }
  }
  function vibrar(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* */ } }

  function frasePara(it, d) {
    const dist = d >= 1000 ? fmtDist(d) : (Math.round(d / 50) * 50) + ' metros';
    if (it.tipo === 'semaforo') return 'Radar de semáforo a ' + dist + '.';
    if (it.tipo === 'placa') return 'Câmera de leitura de placa a ' + dist + '.';
    return (it.tipo === 'rodovia' ? 'Radar na rodovia a ' : 'Radar a ') + dist + '. Limite ' + it.limite + '.';
  }

  // ---------- GPS ----------
  function aoMover(p) {
    const agora = p.timestamp || Date.now();
    const novo = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy || 30, t: agora, kmh: null, heading: null };
    if (typeof p.coords.speed === 'number' && !isNaN(p.coords.speed) && p.coords.speed >= 0) novo.kmh = p.coords.speed * 3.6;
    if (typeof p.coords.heading === 'number' && !isNaN(p.coords.heading) && novo.kmh > 3) novo.heading = p.coords.heading;
    if (ultimaPos) {
      const d = distancia(ultimaPos, novo), dt = (agora - ultimaPos.t) / 1000;
      if (novo.kmh === null && dt > 0.4 && dt < 10) novo.kmh = d / dt * 3.6;
      if (novo.heading === null && d > 4) novo.heading = rumo(ultimaPos, novo);
      if (novo.heading === null && pos) novo.heading = pos.heading;
      if (d > 4 || dt > 10) ultimaPos = novo;
    } else {
      ultimaPos = novo;
    }
    pos = novo;
    desenharUsuario();
    if (dirigindo) avaliarAlertas();
  }

  function desenharUsuario() {
    const ll = [pos.lat, pos.lon];
    if (!userMarker) {
      userMarker = L.marker(ll, {
        icon: L.divIcon({ className: '', html: '<div class="user-dot"><div class="halo"></div><div class="arrow">' + ICO.seta + '</div></div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
        interactive: false, zIndexOffset: 1000, keyboard: false
      }).addTo(map);
      userAccuracy = L.circle(ll, { radius: pos.acc, stroke: false, fillColor: '#1867d6', fillOpacity: 0.08, interactive: false }).addTo(map);
    } else {
      userMarker.setLatLng(ll);
      userAccuracy.setLatLng(ll).setRadius(Math.min(pos.acc, 300));
    }
    const el = userMarker.getElement();
    if (el) {
      const seta = el.querySelector('.arrow');
      if (seta) seta.style.transform = 'rotate(' + (pos.heading || 0) + 'deg)';
    }
    if (seguir) map.setView(ll, Math.max(map.getZoom(), 16), { animate: true });
  }

  function erroGPS(e) {
    const msg = e.code === 1
      ? 'Permita o acesso à localização nas configurações do navegador para usar os alertas.'
      : 'Não consegui pegar sua localização agora. Verifique se o GPS está ligado.';
    $('#hud-next').innerHTML = '<div class="hud-msg">' + msg + '</div>';
  }

  function iniciarGPS() {
    if (watchId !== null || !('geolocation' in navigator)) return;
    if (location.hash === '#demo') { iniciarDemo(); return; }
    watchId = navigator.geolocation.watchPosition(aoMover, erroGPS, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }
  function pararGPS() {
    if (watchId !== null && watchId !== 'demo') navigator.geolocation.clearWatch(watchId);
    if (watchId === 'demo') clearInterval(demoTimer);
    watchId = null;
  }

  // ---------- alertas ----------
  function candidatos() {
    return DADOS.itens.filter((it) => visivel(it) && it.status !== 'previsto');
  }

  function avaliarAlertas() {
    const hud = $('#hud');
    const kmh = pos.kmh;
    $('#vel').textContent = kmh === null ? '--' : Math.round(kmh);

    let prox = null;
    for (const it of candidatos()) {
      const d = distancia(pos, it);
      const raio = RAIO_ALERTA[it.tipo];
      if (d > raio * 2 + 100) alertados.delete(it.id);
      if (d > RAIO_BUSCA) continue;
      // à frente? se não temos rumo confiável, considera tudo
      let frente = true;
      if (pos.heading !== null && kmh !== null && kmh > 8 && d > 40) frente = difAng(pos.heading, rumo(pos, it)) <= 55;
      if (!frente) continue;
      if (!prox || d < prox.d) prox = { it, d };
    }

    hud.classList.remove('perto', 'acima');
    if (!prox) {
      $('#hud-next').innerHTML = '<div class="hud-msg">Nenhum radar à frente nos próximos ' + fmtDist(RAIO_BUSCA) + '.</div>';
      return;
    }
    const { it, d } = prox;
    const raio = RAIO_ALERTA[it.tipo];
    $('#hud-next').innerHTML = htmlPlaca(it) + '<div class="txt"><span class="dist">' + fmtDist(d) + '</span><span class="onde">' + esc(it.nome) + '</span></div>';

    if (d <= raio) {
      hud.classList.add('perto');
      if (!alertados.has(it.id)) {
        alertados.set(it.id, true);
        bip(880, 0.14, 2);
        vibrar([180, 90, 180]);
        setTimeout(() => falar(frasePara(it, d)), 350);
      }
      const lim = it.limite; // em rodovia, o de veículos leves
      if (lim && kmh !== null && kmh > lim + 2) {
        hud.classList.add('acima');
        const agora = Date.now();
        if (agora - ultimoBipAcima > 2500) { ultimoBipAcima = agora; bip(1240, 0.18, 3); vibrar([300, 100, 300]); }
      }
    }
  }

  async function pedirWakeLock() {
    try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch (e) { wakeLock = null; }
  }

  function alternarDirigir() {
    dirigindo = !dirigindo;
    const hud = $('#hud');
    hud.classList.toggle('dirigindo', dirigindo);
    $('#btn-go').textContent = dirigindo ? 'Parar' : 'Dirigir';
    if (dirigindo) {
      try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { audioCtx = null; }
      bip(660, 0.08, 1);
      if ('speechSynthesis' in window) speechSynthesis.getVoices();
      falar('Alertas de radar ligados.');
      seguir = true;
      $('#btn-recentrar').hidden = true;
      $('#hud-next').innerHTML = '<div class="hud-msg">Procurando o sinal do GPS…</div>';
      pedirWakeLock();
      iniciarGPS();
      if (pos) { desenharUsuario(); avaliarAlertas(); }
    } else {
      seguir = false;
      hud.classList.remove('perto', 'acima');
      alertados.clear();
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
      $('#vel').textContent = '--';
      $('#hud-next').innerHTML = '<div class="hud-msg">Alertas desligados. Toque em <b>Dirigir</b> para ligar de novo.</div>';
    }
  }

  // ---------- simulação (#demo) para testar sem sair de casa ----------
  let demoTimer = null;
  function iniciarDemo() {
    const rota = [[-20.4150, -49.9799], [-20.4125, -49.9803], [-20.4094, -49.9806], [-20.4075, -49.9808], [-20.4040, -49.9811], [-20.4010, -49.9813]];
    const passos = [];
    for (let i = 0; i < rota.length - 1; i++) {
      const a = { lat: rota[i][0], lon: rota[i][1] }, b = { lat: rota[i + 1][0], lon: rota[i + 1][1] };
      const n = Math.max(1, Math.round(distancia(a, b) / 16)); // ~16 m por segundo ≈ 58 km/h
      for (let k = 0; k < n; k++) passos.push([a.lat + (b.lat - a.lat) * k / n, a.lon + (b.lon - a.lon) * k / n]);
    }
    let i = 0;
    watchId = 'demo';
    const tick = () => {
      const [lat, lon] = passos[i % passos.length];
      aoMover({ coords: { latitude: lat, longitude: lon, accuracy: 8, speed: null, heading: null }, timestamp: Date.now() });
      i++;
    };
    tick();
    demoTimer = setInterval(tick, 1000);
  }

  // ---------- inicialização ----------
  function iniciarMapa() {
    map = L.map('map', { zoomControl: false, attributionControl: true, minZoom: 11, maxZoom: 19 }).setView(CENTRO, 14);
    const escuro = () => document.documentElement.dataset.theme === 'dark' ||
      (document.documentElement.dataset.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
    }).addTo(map);
    const tema = () => tiles.getContainer() && tiles.getContainer().classList.toggle('tiles-escuros', escuro());
    tiles.on('load', tema); tema();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
    camada = L.layerGroup().addTo(map);
    map.on('dragstart', () => {
      if (seguir) { seguir = false; if (dirigindo) $('#btn-recentrar').hidden = false; }
    });
  }

  function ligarControles() {
    document.querySelectorAll('.chip').forEach((c) => {
      const f = c.dataset.f;
      c.classList.toggle('on', !!filtros[f]);
      c.setAttribute('aria-pressed', String(!!filtros[f]));
      c.addEventListener('click', () => {
        filtros[f] = !filtros[f];
        c.classList.toggle('on', filtros[f]);
        c.setAttribute('aria-pressed', String(filtros[f]));
        gravarPref('filtros', filtros);
        desenhar();
      });
    });
    $('#btn-info').addEventListener('click', abrirInfo);
    $('#btn-lista').addEventListener('click', abrirLista);
    $('#btn-go').addEventListener('click', alternarDirigir);
    $('#btn-recentrar').addEventListener('click', () => {
      seguir = true; $('#btn-recentrar').hidden = true;
      if (pos) map.setView([pos.lat, pos.lon], Math.max(map.getZoom(), 16));
    });
    $('#btn-local').addEventListener('click', () => {
      if (pos) { map.setView([pos.lat, pos.lon], Math.max(map.getZoom(), 16)); return; }
      $('#btn-local').classList.add('ativo');
      if (location.hash === '#demo') { iniciarGPS(); return; }
      navigator.geolocation.getCurrentPosition((p) => {
        aoMover(p); map.setView([pos.lat, pos.lon], 16);
        iniciarGPS();
      }, erroGPS, { enableHighAccuracy: true, timeout: 15000 });
    });
    const bs = $('#btn-som');
    const syncSom = () => { bs.setAttribute('aria-pressed', String(somLigado)); bs.setAttribute('aria-label', somLigado ? 'Desligar alerta por voz' : 'Ligar alerta por voz'); };
    syncSom();
    bs.addEventListener('click', () => {
      somLigado = !somLigado; gravarPref('som', somLigado); syncSom();
      if (!somLigado && 'speechSynthesis' in window) speechSynthesis.cancel();
    });
    $('#sheet-close').addEventListener('click', fecharSheet);
    $('#backdrop').addEventListener('click', fecharSheet);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#sheet').hidden) fecharSheet(); });
    document.addEventListener('visibilitychange', () => { if (dirigindo && document.visibilityState === 'visible') pedirWakeLock(); });
  }

  async function iniciar() {
    iniciarMapa();
    ligarControles();
    try {
      const r = await fetch('radares.json', { cache: 'no-cache' });
      DADOS = await r.json();
    } catch (e) {
      $('#resumo').textContent = 'Não consegui carregar os radares. Verifique a internet e recarregue.';
      return;
    }
    desenhar();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  iniciar();
})();
