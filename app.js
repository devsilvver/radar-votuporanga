/* Radar Votuporanga — mapa de radares com alerta por GPS. Mapa: MapLibre GL + OpenFreeMap (gira e inclina em 3D). */
(function () {
  'use strict';

  const CENTRO = [-49.9745, -20.4176]; // [lon, lat]
  const ESTILO = { claro: 'https://tiles.openfreemap.org/styles/liberty', escuro: 'https://tiles.openfreemap.org/styles/dark' };
  const INCLINACAO_3D = 60;
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
    previsto: 'Previsto',
    osm: 'Não verificado · OpenStreetMap'
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
  let OSM = null;             // radares do resto do Brasil (OpenStreetMap): {atualizado, itens, porId}
  const filtros = { velocidade: true, semaforo: true, rodovia: true, placa: true, previsto: true, osm: true };
  const marcadores = new Map();
  let map, userMarker;
  let modoDirecao = lerPref('modoDirecao', false); // true: o mapa gira para a direção em que você anda
  let toastTimer = null;
  let pos = null;             // {lat, lon, acc, kmh, heading, t}
  const trilha = [];          // últimas posições, para calcular direção e velocidade sem tremer
  let via = null;             // via em que você está: {nome, ref, chaves:Set, t}
  let watchId = null;
  let dirigindo = false;
  let seguir = false;
  let somLigado = lerPref('som', true);
  let bipes = null;           // <audio> com bipes gerados no próprio app (tocam no iPhone mesmo no silencioso)
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
    if (it.status === 'osm') cls.push('osm');
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
    if (it.status === 'osm' && !filtros.osm) return false;
    if (it.status === 'previsto' && !filtros.previsto) return false;
    return true;
  }

  function desenhar() {
    marcadores.forEach((m) => m.remove());
    marcadores.clear();
    // previstos primeiro, para ficarem por baixo dos ativos
    const ordem = DADOS.itens.filter(visivel).sort((a, b) => (a.status === 'previsto' ? 0 : 1) - (b.status === 'previsto' ? 0 : 1));
    for (const it of ordem) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mk' + (selecionado === it.id ? ' sel' : '');
      el.title = it.nome;
      el.setAttribute('aria-label', it.nome);
      el.innerHTML = htmlPlaca(it);
      el.addEventListener('click', (e) => { e.stopPropagation(); abrirDetalhe(it); });
      const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([it.lon, it.lat]).addTo(map);
      marcadores.set(it.id, m);
    }
    atualizarResumo();
  }
  function atualizarResumo() {
    const ativos = DADOS.itens.filter((i) => i.tipo !== 'placa' && i.status !== 'previsto').length;
    const cams = DADOS.itens.filter((i) => i.tipo === 'placa').length;
    $('#resumo').textContent = OSM
      ? ativos + ' em Votuporanga · ' + OSM.itens.length.toLocaleString('pt-BR') + ' no Brasil (OSM)'
      : ativos + ' radares no mapa · ' + cams + ' câmeras previstas · dados de ' + DADOS.atualizado;
  }
  const todos = () => (OSM ? DADOS.itens.concat(OSM.itens) : DADOS.itens);

  // ---------- radares do resto do Brasil (OpenStreetMap) ----------
  // São milhares: em vez de um botão por radar, viram uma camada do próprio mapa, agrupada em bolinhas
  // com o número de radares quando o mapa está longe.
  function carregarOSM() {
    fetch('osm-brasil.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => {
      const manuais = DADOS.itens.filter((i) => i.tipo !== 'placa');
      const itens = [], porId = new Map();
      for (const [lat, lon, lim, id] of j.r) {
        const p = { lat, lon };
        // mesmo radar já levantado à mão (Votuporanga): fica só o nosso, que tem mais detalhes
        if (manuais.some((m) => Math.abs(m.lat - lat) < 0.002 && Math.abs(m.lon - lon) < 0.002 && distancia(m, p) < 80)) continue;
        // vias: undefined até o app descobrir a rua do radar pelo mapa (viaDoRadar)
        const it = {
          id: 'o' + id, osm: id, tipo: 'velocidade', status: 'osm', vias: undefined,
          nome: 'Radar de velocidade', limite: lim || null, limiteNota: lim ? 'informado no OpenStreetMap' : '', lat, lon
        };
        itens.push(it); porId.set(it.id, it);
      }
      OSM = { atualizado: j.atualizado, itens, porId };
      camadaOSM();
      atualizarResumo();
    }).catch(() => { /* sem o arquivo: fica só Votuporanga */ });
  }
  function geoOSM() {
    return {
      type: 'FeatureCollection',
      features: OSM.itens.filter(visivel).map((it) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: [it.lon, it.lat] },
        properties: { id: it.id, l: it.limite ? String(it.limite) : '?' }
      }))
    };
  }
  function camadaOSM() {
    if (!OSM || !map || !map.getSource('openmaptiles')) return;
    const src = map.getSource('osm-radares');
    if (src) { src.setData(geoOSM()); return; }
    const fonte = ['Noto Sans Bold'];
    map.addSource('osm-radares', { type: 'geojson', data: geoOSM(), cluster: true, clusterMaxZoom: 11, clusterRadius: 55 });
    map.addLayer({
      id: 'osm-grupo', type: 'circle', source: 'osm-radares', filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#c8102e', 'circle-opacity': 0.85, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2,
        'circle-radius': ['step', ['get', 'point_count'], 13, 10, 16, 100, 20, 1000, 25]
      }
    });
    map.addLayer({
      id: 'osm-grupo-n', type: 'symbol', source: 'osm-radares', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': fonte, 'text-size': 12, 'text-allow-overlap': true },
      paint: { 'text-color': '#fff' }
    });
    map.addLayer({
      id: 'osm-ponto', type: 'circle', source: 'osm-radares', filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#fff',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 12],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3.5],
        'circle-stroke-color': '#c8102e'
      }
    });
    map.addLayer({
      id: 'osm-ponto-n', type: 'symbol', source: 'osm-radares', filter: ['!', ['has', 'point_count']], minzoom: 12,
      layout: { 'text-field': ['get', 'l'], 'text-font': fonte, 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#14181f' }
    });
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
    if (it.status === 'osm') {
      if (it.vias && it.vias.length) campos.push(['Via', it.vias.join(' / ')]);
      if (!it.limite) campos.push(['Limite', 'Não informado no OpenStreetMap — confira a placa']);
      campos.push(['Posição', 'Marcada por voluntários do OpenStreetMap']);
    } else campos.push(['Posição', it.precisao === 'endereço' ? 'Pelo número do endereço' : it.precisao === 'cruzamento' ? 'No cruzamento' : 'Aproximada (' + it.precisao.replace('aprox. ', '±').replace('aprox.', 'pelo ponto de referência') + ')']);
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

    const info = it.status === 'osm'
      ? 'Radar cadastrado por voluntários no OpenStreetMap (lista baixada em ' + OSM.atualizado + '). Não foi conferido por nós: pode ter sido desligado, mudado de lugar ou ter outro limite.'
      : it.info;
    const fontes = it.status === 'osm'
      ? '<ul class="fontes"><li><a href="https://www.openstreetmap.org/node/' + it.osm + '" target="_blank" rel="noopener">Ponto nº ' + it.osm + ' no OpenStreetMap</a> <small>(© colaboradores do OpenStreetMap, ODbL)</small></li></ul>'
      : listaFontes(it.fontes);
    const gm = 'https://www.google.com/maps/search/?api=1&query=' + it.lat + ',' + it.lon;
    const wz = 'https://waze.com/ul?ll=' + it.lat + ',' + it.lon + '&navigate=yes';
    abrirSheet(
      '<div class="det-head">' + htmlPlaca(it) + '<div><span class="pill ' + it.status + '">' + NOMES_STATUS[it.status] + '</span>' +
      '<h2 id="sheet-title">' + esc(it.nome) + '</h2></div></div>' +
      '<p>' + esc(info) + '</p>' +
      '<dl class="campos">' + campos.map(([k, v]) => '<dt>' + k + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl>' +
      '<h3>O que ele registra da sua placa</h3>' + blocoRegistra(it.tipo) + multa +
      '<h3>Fontes</h3>' + fontes +
      '<div class="acoes"><a href="' + gm + '" target="_blank" rel="noopener">Abrir no Google Maps</a><a href="' + wz + '" target="_blank" rel="noopener">Abrir no Waze</a></div>',
      () => { selecionado = null; desenhar(); }
    );
    if (!dirigindo) map.easeTo({ center: [it.lon, it.lat], duration: 500 });
  }

  function abrirLista() {
    const c = map.getCenter();
    const ref = pos || { lat: c.lat, lon: c.lng };
    const itens = todos().filter(visivel).map((it) => ({ it, d: distancia(ref, it) })).sort((a, b) => a.d - b.d).slice(0, 60);
    abrirSheet(
      '<h2 id="sheet-title">Radares e câmeras</h2><p class="nota">' + (pos ? 'Os 60 mais perto de você.' : 'Os 60 mais perto do centro do mapa. Toque em “Dirigir” ou no botão de localização para usar sua posição.') + '</p>' +
      '<ul class="lista">' + itens.map(({ it, d }) =>
        '<li><button data-id="' + it.id + '">' + htmlPlaca(it) + '<span class="l-txt"><b>' + esc(it.nome) + '</b><span>' + NOMES_TIPO[it.tipo] + ' · ' + NOMES_STATUS[it.status] + '</span></span><span class="l-dist">' + fmtDist(d) + '</span></button></li>'
      ).join('') + '</ul>'
    );
    $('#sheet-body').querySelectorAll('.lista button').forEach((b) => b.addEventListener('click', () => {
      const it = todos().find((x) => x.id === b.dataset.id);
      fecharSheet();
      seguir = false;
      map.jumpTo({ center: [it.lon, it.lat], zoom: Math.max(map.getZoom(), 16) });
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
      '<h3>Resto do Brasil</h3><p>Fora de Votuporanga, o mapa mostra ' + (OSM ? '<b>' + OSM.itens.length.toLocaleString('pt-BR') + ' radares</b>' : 'os radares') + ' cadastrados por voluntários no <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">OpenStreetMap</a>' + (OSM ? ' (lista de ' + OSM.atualizado + ', atualizada todo mês)' : '') + '. Eles <b>não foram conferidos</b>: cidades pequenas costumam ter poucos ou nenhum cadastrado, e alguns podem estar desligados ou com outro limite. Ao longe aparecem agrupados (o número na bolinha é a quantidade); aproxime para ver cada um. Os alertas ao dirigir também valem para eles. Use o filtro <b>OpenStreetMap</b> para escondê-los. Dados © colaboradores do OpenStreetMap, licença ODbL.</p>' +
      '<h3>Girar e 3D</h3><p>Gire o mapa com dois dedos e incline arrastando dois dedos para cima. O botão da <b>bússola</b> volta o norte para cima; tocando de novo, o mapa passa a girar com a sua direção (como no GPS do carro). O botão <b>3D</b> inclina o mapa e levanta os prédios.</p>' +
      '<h3>Alertas ao dirigir</h3><p>Com <b>Dirigir</b> ligado, o celular avisa por voz e bipe (e vibração no Android; o iPhone não deixa sites vibrarem) a cerca de 300 m de um radar na cidade e 650 m na rodovia, e fica vermelho se você passar do limite. Só entram os radares <b>da rua ou rodovia em que você está, à sua frente</b>: os de ruas paralelas, transversais ou que já ficaram para trás são ignorados. A direção vem do seu próprio movimento, então os avisos começam depois dos primeiros metros andando. A tela fica acesa enquanto o mapa estiver aberto; com a tela bloqueada ou outro app na frente, os alertas param. Para usar como app, abra no navegador e escolha <b>Adicionar à tela inicial</b>.</p>' +
      '<p>Para testar o som, desligue e ligue o botão do alto-falante: ele bipa e diz “Som ligado”. O som sai pelo volume de mídia (o mesmo da música). No iPhone com iOS 17 ou mais novo ele toca mesmo com a chave de silencioso ligada; em versões mais antigas, desligue o silencioso.</p>' +
      '<p class="aviso">Respeite sempre a sinalização da via: o limite real é o da placa. Não mexa no celular dirigindo.</p>' +
      '<h3>Fontes</h3>' + listaFontes(Object.keys(DADOS.fontes))
    );
  }

  // ---------- áudio e voz ----------
  // Bipe em WAV gerado na hora: <audio> segue o volume de mídia e não é calado pela chave de silencioso
  // como o Web Audio (que no iPhone fica mudo no modo silencioso).
  // Som de "sino" suave: notas graves, volume baixo, entrada gradual e queda natural (sem estalo nem apito).
  // notas: [[frequência Hz, duração s], ...] tocadas em sequência.
  function criarWav(notas, volume) {
    const taxa = 22050, pausa = 0.03;
    const totalSeg = notas.reduce((s, n) => s + n[1] + pausa, 0) + 0.05;
    const total = Math.ceil(taxa * totalSeg);
    const amostras = new Float32Array(total);
    let ini = 0;
    for (const [f, d] of notas) {
      const n0 = Math.floor(ini * taxa), n = Math.floor(d * taxa);
      for (let i = 0; i < n && n0 + i < total; i++) {
        const t = i / taxa;
        const env = Math.min(1, t / 0.025) * Math.exp(-t / (d * 0.4)) * Math.min(1, (d - t) / 0.04);
        const s = Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t / (d * 0.15));
        amostras[n0 + i] += s * env * volume;
      }
      ini += d + pausa;
    }
    const buf = new ArrayBuffer(44 + total * 2), v = new DataView(buf);
    const txt = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    txt(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, taxa, true);
    v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, total * 2, true);
    for (let i = 0; i < total; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, amostras[i])) * 32767), true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  }

  // Chamar SEMPRE dentro de um toque do usuário: o iPhone só libera som de site depois de um toque.
  function prepararSom() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* iOS antigo */ }
    if (!bipes) {
      bipes = {
        ok: new Audio(criarWav([[587, 0.4]], 0.2)),                          // ré: um toque curto
        alerta: new Audio(criarWav([[659, 0.38], [523, 0.6]], 0.22)),        // mi → dó: "plim-plom" de aviso
        acima: new Audio(criarWav([[587, 0.22], [587, 0.22], [440, 0.45]], 0.24)) // ré-ré-lá: acima do limite
      };
      Object.values(bipes).forEach((a) => { a.preload = 'auto'; a.setAttribute('playsinline', ''); });
    }
    for (const k of ['alerta', 'acima']) {
      const a = bipes[k];
      if (a.__liberado) continue;
      a.muted = true;
      const p = a.play();
      if (p) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; a.__liberado = true; }).catch(() => { a.muted = false; });
    }
  }
  function tocar(nome) {
    if (!somLigado || !bipes || !bipes[nome]) return;
    const a = bipes[nome];
    try { a.muted = false; a.currentTime = 0; const p = a.play(); if (p) p.catch(() => {}); } catch (e) { /* */ }
  }
  function falar(txt) {
    if (!somLigado || !('speechSynthesis' in window)) return;
    try {
      // cancelar e falar em seguida faz o Safari engolir a fala; só cancela se houver algo tocando
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'pt-BR'; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find((x) => /pt[-_]BR/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* voz indisponível */ }
  }
  function vibrar(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* */ } }

  // Quanto a posição do radar pode estar errada (m). Radar com posição aproximada avisa mais cedo e o aviso
  // continua por essa distância depois do ponto marcado, para nunca chegar depois do radar de verdade.
  function margem(it) {
    const p = it.precisao || '';
    const m = p.match(/aprox\.\s*(\d+)/);
    if (m) return +m[1];
    if (p === 'endereço') return 40;
    return 0;
  }
  function frasePara(it, d) {
    const dist = d >= 1000 ? fmtDist(d) : (Math.round(d / 50) * 50) + ' metros';
    const aprox = margem(it) >= 100 ? ' Posição aproximada, atenção.' : '';
    if (it.tipo === 'semaforo') return 'Radar de semáforo a ' + dist + '.' + aprox;
    if (it.tipo === 'placa') return 'Câmera de leitura de placa a ' + dist + '.' + aprox;
    return (it.tipo === 'rodovia' ? 'Radar na rodovia a ' : 'Radar a ') + dist + '.' + (it.limite ? ' Limite ' + it.limite + '.' : '') + aprox;
  }

  // ---------- GPS ----------
  function aoMover(p) {
    const agora = p.timestamp || Date.now();
    const novo = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy || 30, t: agora, kmh: null, heading: null };
    if (typeof p.coords.speed === 'number' && !isNaN(p.coords.speed) && p.coords.speed >= 0) novo.kmh = p.coords.speed * 3.6;
    const ant = trilha[trilha.length - 1];
    if (novo.kmh === null && ant) {
      const dt = (agora - ant.t) / 1000;
      if (dt > 0.4 && dt < 10) novo.kmh = distancia(ant, novo) / dt * 3.6;
    }
    // Direção: a do GPS quando está andando; senão, a do trecho percorrido (ponto de 20 m atrás até aqui).
    if (typeof p.coords.heading === 'number' && !isNaN(p.coords.heading) && novo.kmh > 10) novo.heading = p.coords.heading;
    if (novo.heading === null) {
      for (let i = trilha.length - 1; i >= 0; i--) {
        if (distancia(trilha[i], novo) >= 20) { novo.heading = rumo(trilha[i], novo); break; }
      }
    }
    if (novo.heading === null && pos) novo.heading = pos.heading; // parado: mantém a última direção
    trilha.push(novo);
    while (trilha.length > 40) trilha.shift();
    pos = novo;
    desenharUsuario();
    if (dirigindo) avaliarAlertas();
  }

  // ---------- em que via você está ----------
  // Usa os nomes das ruas que já vêm no mapa (camada transportation_name do OpenFreeMap): acha a rua
  // mais perto da sua posição que esteja alinhada com a direção em que você anda.
  function normVia(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/^(avenida|av\.?|rua|r\.|travessa|alameda|estrada municipal|estrada|rodovia|vicinal)\s+/, '')
      .replace(/^(doutor|dr\.?|professor|prof\.?|vereador|coronel|padre)\s+/, '')
      .replace(/\s+/g, ' ').trim();
  }
  function chavesVia(nome, ref) {
    const s = new Set();
    if (nome) s.add(normVia(nome));
    String(ref || '').split(/[;,]/).forEach((r) => { if (r.trim()) s.add(normVia(r)); });
    return s;
  }
  let ruas = null; // trechos de rua com nome já carregados no mapa (renovado a cada posição do GPS)
  function carregarRuas() {
    ruas = null;
    if (!map || !map.getSource('openmaptiles')) return;
    try { ruas = map.querySourceFeatures('openmaptiles', { sourceLayer: 'transportation_name' }); } catch (e) { ruas = null; }
  }
  // Chama fn(nome, ref, distância em m, rumo do trecho) para cada trecho de rua com nome a até `raio` m do ponto p.
  function trechosPerto(p, raio, fn) {
    if (!ruas) return;
    const cosL = Math.cos(rad(p.lat));
    const gLat = raio / 110574 + 0.002, gLon = raio / (111320 * cosL) + 0.002;
    for (const f of ruas) {
      const nome = f.properties.name || '', ref = f.properties.ref || '';
      if (!nome && !ref) continue;
      const g = f.geometry;
      const linhas = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      for (const l of linhas) {
        for (let i = 1; i < l.length; i++) {
          if (Math.abs(l[i][1] - p.lat) > gLat && Math.abs(l[i - 1][1] - p.lat) > gLat && (l[i][1] - p.lat) * (l[i - 1][1] - p.lat) > 0) continue;
          if (Math.abs(l[i][0] - p.lon) > gLon && Math.abs(l[i - 1][0] - p.lon) > gLon && (l[i][0] - p.lon) * (l[i - 1][0] - p.lon) > 0) continue;
          const ax = (l[i - 1][0] - p.lon) * 111320 * cosL, ay = (l[i - 1][1] - p.lat) * 110574;
          const bx = (l[i][0] - p.lon) * 111320 * cosL, by = (l[i][1] - p.lat) * 110574;
          const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
          if (!L2) continue;
          const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2));
          const d = Math.hypot(ax + t * dx, ay + t * dy);
          if (d > raio) continue;
          fn(nome, ref, d, (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360);
        }
      }
    }
  }
  // Radar do OpenStreetMap: descobre em que rua ele está (a rua com nome mais perto, até 20 m).
  // Só decide quando o ponto está na tela (os dados da rua já carregaram); até lá vale a regra da linha de frente.
  const ROD_RE = /^(BR|[A-Z]{2})[- ]?\d{2,3}\b/;
  function viaDoRadar(it) {
    if (it.vias !== undefined || !ruas) return;
    const b = map.getBounds();
    if (!b.contains([it.lon, it.lat])) return;
    const perto = new Map();
    trechosPerto(it, 20, (nome, ref, d) => {
      const k = nome + '|' + ref;
      if (!perto.has(k) || d < perto.get(k).d) perto.set(k, { nome, ref, d });
    });
    const lista = [...perto.values()].sort((a, b2) => a.d - b2.d);
    const escolhidas = lista.filter((c) => c.d <= lista[0].d + 4).slice(0, 2); // radar no cruzamento: as duas
    it.vias = [];
    for (const c of escolhidas) {
      if (c.nome && !it.vias.includes(c.nome)) it.vias.push(c.nome);
      String(c.ref).split(/[;,]/).map((r) => r.trim()).filter(Boolean).forEach((r) => { if (!it.vias.includes(r)) it.vias.push(r); });
      if (ROD_RE.test(c.ref)) it.tipo = 'rodovia';
    }
    if (it.vias.length) it.nome = 'Radar · ' + it.vias.slice(0, 2).join(' / ');
  }
  function detectarVia() {
    if (!pos) return via;
    if (!ruas) return via;
    const cands = new Map();
    trechosPerto(pos, 35, (nome, ref, d, brg) => {
      const al = pos.heading === null ? 0 : Math.min(difAng(pos.heading, brg), difAng(pos.heading, (brg + 180) % 360));
      if (al > 40) return; // rua atravessada (cruzamento): não é a sua
      const sc = d + al * 1.5;
      const k = nome + '|' + ref;
      const c = cands.get(k);
      if (!c || sc < c.sc) cands.set(k, { nome, ref, sc });
    });
    if (!cands.size) {
      if (via && Date.now() - via.t > 15000) via = null; // sem rua com nome por perto: esquece depois de 15 s
      return via;
    }
    let melhor = null;
    for (const c of cands.values()) if (!melhor || c.sc < melhor.sc) melhor = c;
    if (via) { // não troca de rua à toa (ex.: ao passar por um cruzamento)
      const c = cands.get(via.nome + '|' + via.ref);
      if (c && c.sc < melhor.sc + 12) melhor = c;
    }
    via = { nome: melhor.nome, ref: melhor.ref, chaves: chavesVia(melhor.nome, melhor.ref), t: Date.now() };
    return via;
  }
  function nomeCurto(v) {
    if (!v) return '';
    return (v.nome || v.ref).replace(/^Avenida /, 'Av. ').replace(/ Doutor /, ' Dr. ');
  }

  // O radar está na sua rota? Precisa estar à frente, no sentido em que você anda, e na mesma via.
  function naRota(it, d) {
    if (pos.heading === null) return false;
    if (d < 30) return alertados.has(it.id); // passando por ele agora
    const th = difAng(pos.heading, rumo(pos, it));
    // ficou para trás; se a posição é aproximada, o aviso segue até sair da faixa de dúvida
    if (th >= 90) return alertados.has(it.id) && d <= margem(it);
    if (via && it.vias && it.vias.length) {
      return th <= 75 && it.vias.some((v) => via.chaves.has(normVia(v)));
    }
    // sem saber a via (mapa sem nome da rua): só o que está praticamente na sua linha de frente
    const lateral = d * Math.sin(rad(th));
    return lateral <= (it.tipo === 'rodovia' ? 80 : 35);
  }

  function desenharUsuario() {
    const ll = [pos.lon, pos.lat];
    if (!userMarker) {
      const el = document.createElement('div');
      el.className = 'user-dot';
      el.innerHTML = '<div class="halo"></div><div class="arrow">' + ICO.seta + '</div>';
      // a seta fica "deitada" no mapa e gira junto com ele
      userMarker = new maplibregl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(ll).addTo(map);
    } else {
      userMarker.setLngLat(ll);
    }
    userMarker.setRotation(pos.heading || 0);
    if (seguir) {
      const alvo = { center: ll, zoom: Math.max(map.getZoom(), 16), duration: 900, essential: true };
      if (modoDirecao && pos.heading !== null) alvo.bearing = pos.heading;
      // em movimento, o carro fica mais para baixo da tela e sobra mapa à frente
      if (dirigindo) alvo.padding = { top: 160, bottom: 40, left: 0, right: 0 };
      map.easeTo(alvo);
    }
  }

  function aviso(txt) {
    const t = $('#toast');
    t.textContent = txt; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  // ---------- rotação e 3D ----------
  function atualizarBussola() {
    const b = map.getBearing();
    $('#btn-bussola .agulha').style.transform = 'rotate(' + (-b) + 'deg)';
    const bt = $('#btn-bussola');
    bt.setAttribute('aria-pressed', String(modoDirecao));
    bt.setAttribute('aria-label', modoDirecao ? 'Mapa girando com a sua direção. Toque para pôr o norte para cima'
      : Math.abs(b) > 1 ? 'Mapa girado. Toque para pôr o norte para cima' : 'Norte para cima. Toque para o mapa girar com a sua direção');
  }
  function tocarBussola() {
    if (modoDirecao) {
      modoDirecao = false; gravarPref('modoDirecao', false);
      map.easeTo({ bearing: 0, duration: 500 });
      aviso('Norte para cima');
    } else if (Math.abs(map.getBearing()) > 1) {
      map.easeTo({ bearing: 0, duration: 500 });
      aviso('Norte para cima');
    } else {
      modoDirecao = true; gravarPref('modoDirecao', true);
      if (pos && pos.heading !== null) map.easeTo({ bearing: pos.heading, duration: 500 });
      aviso(pos ? 'O mapa gira com a sua direção' : 'O mapa vai girar com a sua direção quando o GPS ligar');
    }
    atualizarBussola();
  }
  function atualizar3D() {
    const em3d = map.getPitch() > 10;
    const b = $('#btn-3d');
    b.setAttribute('aria-pressed', String(em3d));
    b.textContent = em3d ? '2D' : '3D';
    b.setAttribute('aria-label', em3d ? 'Voltar o mapa para 2D' : 'Ver o mapa em 3D');
    if (map.getLayer('predios-3d')) map.setLayoutProperty('predios-3d', 'visibility', em3d ? 'visible' : 'none');
  }
  function tocar3D() {
    const em3d = map.getPitch() > 10;
    map.easeTo({ pitch: em3d ? 0 : INCLINACAO_3D, zoom: em3d ? map.getZoom() : Math.max(map.getZoom(), 16), duration: 700 });
    gravarPref('3d', !em3d);
  }
  function adicionarPredios() {
    if (map.getLayer('predios-3d') || !map.getSource('openmaptiles')) return;
    const camadas = map.getStyle().layers;
    camadas.forEach((l) => { if (l.type === 'fill-extrusion') map.setLayoutProperty(l.id, 'visibility', 'none'); });
    const rotulo = camadas.find((l) => l.type === 'symbol');
    map.addLayer({
      id: 'predios-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
      layout: { visibility: map.getPitch() > 10 ? 'visible' : 'none' },
      paint: {
        'fill-extrusion-color': escuro() ? '#2c3442' : '#d8d3cb',
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.88
      }
    }, rotulo ? rotulo.id : undefined);
  }
  function escuro() {
    const t = document.documentElement.dataset.theme;
    return t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function erroGPS(e) {
    const msg = e.code === 1
      ? 'Permita o acesso à localização nas configurações do navegador para usar os alertas.'
      : 'Não consegui pegar sua localização agora. Verifique se o GPS está ligado.';
    $('#hud-next').innerHTML = '<div class="hud-msg">' + msg + '</div>';
  }

  function iniciarGPS() {
    if (watchId !== null || !('geolocation' in navigator)) return;
    if (location.hash.startsWith('#demo')) { iniciarDemo(); return; }
    watchId = navigator.geolocation.watchPosition(aoMover, erroGPS, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }
  function pararGPS() {
    if (watchId !== null && watchId !== 'demo') navigator.geolocation.clearWatch(watchId);
    if (watchId === 'demo') clearInterval(demoTimer);
    watchId = null;
  }

  // ---------- alertas ----------
  function candidatos() {
    return todos().filter((it) => visivel(it) && it.status !== 'previsto');
  }

  function avaliarAlertas() {
    const hud = $('#hud');
    const kmh = pos.kmh;
    $('#vel').textContent = kmh === null ? '--' : Math.round(kmh);

    carregarRuas();
    detectarVia();
    let prox = null;
    for (const it of candidatos()) {
      // longe (mais de ~3 km em linha reta): nem calcula a distância exata
      if (Math.abs(it.lat - pos.lat) > 0.03 || Math.abs(it.lon - pos.lon) > 0.03) { alertados.delete(it.id); continue; }
      const d = distancia(pos, it);
      const raio = RAIO_ALERTA[it.tipo] + margem(it);
      if (d > raio * 2 + 100) alertados.delete(it.id);
      if (d > RAIO_BUSCA) continue;
      if (it.status === 'osm') viaDoRadar(it);
      if (!naRota(it, d)) continue;
      if (!prox || d < prox.d) prox = { it, d };
    }

    hud.classList.remove('perto', 'acima');
    if (!prox) {
      const msg = pos.heading === null
        ? 'Comece a andar para eu saber a sua direção.'
        : 'Nenhum radar à frente' + (via ? ' na ' + esc(nomeCurto(via)) : '') + ' nos próximos ' + fmtDist(RAIO_BUSCA) + '.';
      $('#hud-next').innerHTML = '<div class="hud-msg">' + msg + '</div>';
      return;
    }
    const { it, d } = prox;
    const mg = margem(it);
    const raio = RAIO_ALERTA[it.tipo] + mg;
    // posição aproximada: "± 300 m" ao lado da distância; já passou do ponto marcado: "aqui perto"
    const atras = difAng(pos.heading, rumo(pos, it)) >= 90 && d >= 30;
    const txtDist = atras ? 'aqui perto' : fmtDist(d) + (mg >= 100 ? ' <small>±' + fmtDist(mg) + '</small>' : '');
    $('#hud-next').innerHTML = htmlPlaca(it) + '<div class="txt"><span class="dist">' + txtDist + '</span><span class="onde">' + esc(it.nome) + (mg >= 100 ? ' · posição aproximada' : '') + '</span></div>';

    if (d <= raio) {
      hud.classList.add('perto');
      if (!alertados.has(it.id)) {
        alertados.set(it.id, true);
        tocar('alerta');
        vibrar([180, 90, 180]);
        setTimeout(() => falar(frasePara(it, d)), 350);
      }
      const lim = it.limite; // em rodovia, o de veículos leves
      if (lim && kmh !== null && kmh > lim + 2) {
        hud.classList.add('acima');
        const agora = Date.now();
        if (agora - ultimoBipAcima > 2500) { ultimoBipAcima = agora; tocar('acima'); vibrar([300, 100, 300]); }
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
      prepararSom();
      tocar('ok');
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
      try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch (e) { /* */ }
      $('#vel').textContent = '--';
      $('#hud-next').innerHTML = '<div class="hud-msg">Alertas desligados. Toque em <b>Dirigir</b> para ligar de novo.</div>';
    }
  }

  // ---------- simulação (#demo) para testar sem sair de casa ----------
  let demoTimer = null;
  // #demo: sobe a Av. Wilson Foz (deve avisar os 2 radares dela).
  // #demo-paralela: sobe a Rua Oito de Agosto, paralela (não deve avisar os radares da Wilson Foz).
  function iniciarDemo() {
    // #demo-rota=lat,lon;lat,lon;... : rota qualquer (para testar radares de outras cidades)
    const livre = location.hash.match(/^#demo-rota=(.+)$/);
    const rota = livre ? decodeURIComponent(livre[1]).split(';').map((p) => p.split(',').map(Number))
      : location.hash === '#demo-paralela'
        ? [[-20.4180, -49.98005], [-20.41669, -49.9803], [-20.41014, -49.98141]]
        : [[-20.4155, -49.9795], [-20.41447, -49.97966], [-20.40578, -49.98112], [-20.4045, -49.98137]];
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
    const em3d = lerPref('3d', false);
    map = new maplibregl.Map({
      container: 'map',
      style: escuro() ? ESTILO.escuro : ESTILO.claro,
      center: CENTRO, zoom: em3d ? 15.5 : 14, pitch: em3d ? INCLINACAO_3D : 0,
      minZoom: 3, maxZoom: 19, maxPitch: 70,
      attributionControl: false, dragRotate: true, touchPitch: true, pitchWithRotate: true
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    if (location.hash.startsWith('#demo')) window.__mapa = map; // só para testes
    map.on('style.load', () => { adicionarPredios(); atualizar3D(); camadaOSM(); });
    map.on('click', 'osm-ponto', (e) => { const it = OSM && OSM.porId.get(e.features[0].properties.id); if (it) abrirDetalhe(it); });
    map.on('click', 'osm-grupo', (e) => {
      const f = e.features[0];
      map.getSource('osm-radares').getClusterExpansionZoom(f.properties.cluster_id)
        .then((z) => map.easeTo({ center: f.geometry.coordinates, zoom: z + 0.5, duration: 600 })).catch(() => {});
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => map.setStyle(escuro() ? ESTILO.escuro : ESTILO.claro));
    map.on('rotate', atualizarBussola);
    map.on('pitch', atualizar3D);
    // mexeu no mapa com o dedo: para de seguir (o botão Recentralizar volta a seguir)
    const soltar = (e) => {
      if (!e.originalEvent || !seguir) return;
      seguir = false; if (dirigindo) $('#btn-recentrar').hidden = false;
    };
    map.on('dragstart', soltar);
    map.on('rotatestart', (e) => { soltar(e); if (e.originalEvent && modoDirecao) { modoDirecao = false; gravarPref('modoDirecao', false); atualizarBussola(); } });
    atualizarBussola();
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
        camadaOSM();
      });
    });
    $('#btn-info').addEventListener('click', abrirInfo);
    $('#btn-lista').addEventListener('click', abrirLista);
    $('#btn-go').addEventListener('click', alternarDirigir);
    $('#btn-recentrar').addEventListener('click', () => {
      seguir = true; $('#btn-recentrar').hidden = true;
      if (pos) desenharUsuario();
    });
    $('#btn-bussola').addEventListener('click', tocarBussola);
    $('#btn-3d').addEventListener('click', tocar3D);
    $('#btn-local').addEventListener('click', () => {
      if (pos) { map.easeTo({ center: [pos.lon, pos.lat], zoom: Math.max(map.getZoom(), 16), duration: 600 }); return; }
      $('#btn-local').classList.add('ativo');
      if (location.hash.startsWith('#demo')) { iniciarGPS(); return; }
      navigator.geolocation.getCurrentPosition((p) => {
        aoMover(p); map.easeTo({ center: [pos.lon, pos.lat], zoom: 16, duration: 600 });
        iniciarGPS();
      }, erroGPS, { enableHighAccuracy: true, timeout: 15000 });
    });
    const bs = $('#btn-som');
    const syncSom = () => { bs.setAttribute('aria-pressed', String(somLigado)); bs.setAttribute('aria-label', somLigado ? 'Desligar alerta por voz' : 'Ligar alerta por voz'); };
    syncSom();
    bs.addEventListener('click', () => {
      somLigado = !somLigado; gravarPref('som', somLigado); syncSom();
      if (!somLigado && 'speechSynthesis' in window) speechSynthesis.cancel();
      if (somLigado) { prepararSom(); tocar('ok'); falar('Som ligado.'); } // também serve de teste de volume
    });

    // Zoom só no mapa: impede o pinça/duplo toque de ampliar a interface (o Safari ignora user-scalable=no).
    const fora = (e) => !(e.target && e.target.closest && e.target.closest('#map'));
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) =>
      document.addEventListener(ev, (e) => { if (fora(e)) e.preventDefault(); }, { passive: false }));
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && fora(e)) e.preventDefault(); }, { passive: false });
    let ultimoToque = 0;
    document.addEventListener('touchend', (e) => {
      const agora = Date.now();
      if (agora - ultimoToque < 350 && fora(e) && !e.target.closest('button, a')) e.preventDefault();
      ultimoToque = agora;
    }, { passive: false });
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
    carregarOSM();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  iniciar();
})();
