# Radar Votuporanga

Mapa (PWA) dos radares e câmeras de trânsito de Votuporanga-SP, feito para o celular, com alerta por voz e vibração via GPS.

- **Endereço:** https://devsilvver.github.io/radar-votuporanga/
- **Repositório:** https://github.com/devsilvver/radar-votuporanga
- **Dados levantados em:** 21/11/2026 (notícias da prefeitura, Ipem-SP, DER-SP e jornais locais; links em `radares.json`).

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html`, `style.css`, `app.js` | O app (MapLibre GL + mapa vetorial do OpenFreeMap: gira, inclina e mostra prédios em 3D) |
| `radares.json` | **Base de dados.** Para adicionar/corrigir um radar, edite aqui |
| `osm-brasil.json` | Radares do resto do Brasil tirados do OpenStreetMap (gerado, **não edite à mão**). Aparecem como "não verificado", agrupados ao longe |
| `ferramentas/baixar_osm.py` | Gera o `osm-brasil.json`: baixa o extrato do Brasil da Geofabrik (~2,1 GB), lê os nós `highway=speed_camera` com o pyosmium e filtra pelo contorno do Brasil (`ferramentas/brasil-contorno.json`). Feito para rodar no GitHub Actions; no PC: `pip install osmium` e `python ferramentas/baixar_osm.py`. A API Overpass foi abandonada: vive lotada (502/504) |
| `.github/workflows/osm.yml` | Roda o script todo dia 1º às 06:00 de Brasília e publica se mudou. Para rodar na hora: aba **Actions** do GitHub → "Atualizar radares do OpenStreetMap" → **Run workflow** |
| `sw.js`, `manifest.webmanifest`, `icons/` | Funciona como app instalado e guarda o mapa já visto para sinal fraco |
| `ferramentas/geocodificar.py` | Converte endereços em coordenadas (ArcGIS). Uso: um endereço por linha num .txt → `python ferramentas/geocodificar.py lista.txt saida.json` |
| `ferramentas/gerar_icones.py` | Gera os ícones PNG |

## Campos de cada item em `radares.json`

- `tipo`: `velocidade`, `semaforo`, `rodovia` ou `placa` (câmera OCR)
- `status`: `verificado` (Ipem 2025/2026), `ativo` (prefeitura confirma), `confirmar` (citado sem confirmação recente), `previsto`
- `limite` / `limitePesados` em km/h, `limiteNota` quando o limite é suposto
- `lat`, `lon`, `precisao`, `info`, `fontes` (chaves do bloco `fontes`)

## Radares do OpenStreetMap

- Um radar do OSM a menos de 80 m de um ponto do `radares.json` é ignorado (o nosso vale mais).
- O app descobre a rua de cada radar do OSM quando ele entra na tela (rua com nome mais perto, até 20 m, pelos nomes do próprio mapa) e então só avisa se for a rua em que você está; antes disso vale a regra da linha de frente (35 m de lado).
- Se a rua tiver número tipo SP-310/BR-153, o radar passa a contar como de rodovia (aviso a 650 m).
- Dados © colaboradores do OpenStreetMap, licença ODbL: manter o crédito na tela "Sobre" e no detalhe de cada radar.

## Testar

- Local: `python -m http.server 8765` e abrir http://localhost:8765/#demo (o `#demo` simula um carro andando pela Av. Wilson Foz).
- `#demo-rota=lat,lon;lat,lon;...` simula qualquer trajeto (ex.: Av. Nove de Julho em SP: `#demo-rota=-23.55541,-46.64962;-23.55586,-46.65033;-23.55788,-46.65329;-23.55855,-46.65389;-23.56035,-46.65517` → avisa o radar do OSM a 300 m). Depois de trocar o `#`, recarregue a página.
- Publicar: `git add -A; git commit -m "..."; git push` — o GitHub Pages atualiza em ~1 minuto. Ao mudar `app.js`/`style.css`, suba a versão em `VERSAO` no `sw.js` para os celulares pegarem a atualização.
