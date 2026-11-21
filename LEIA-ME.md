# Radar Votuporanga

Mapa (PWA) dos radares e câmeras de trânsito de Votuporanga-SP, feito para o celular, com alerta por voz e vibração via GPS.

- **Endereço:** https://devsilvver.github.io/radar-votuporanga/
- **Repositório:** https://github.com/devsilvver/radar-votuporanga
- **Dados levantados em:** 21/11/2026 (notícias da prefeitura, Ipem-SP, DER-SP e jornais locais; links em `radares.json`).

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html`, `style.css`, `app.js` | O app (Leaflet + mapa do OpenStreetMap) |
| `radares.json` | **Base de dados.** Para adicionar/corrigir um radar, edite aqui |
| `sw.js`, `manifest.webmanifest`, `icons/` | Funciona como app instalado e guarda o mapa já visto para sinal fraco |
| `ferramentas/geocodificar.py` | Converte endereços em coordenadas (ArcGIS). Uso: um endereço por linha num .txt → `python ferramentas/geocodificar.py lista.txt saida.json` |
| `ferramentas/gerar_icones.py` | Gera os ícones PNG |

## Campos de cada item em `radares.json`

- `tipo`: `velocidade`, `semaforo`, `rodovia` ou `placa` (câmera OCR)
- `status`: `verificado` (Ipem 2025/2026), `ativo` (prefeitura confirma), `confirmar` (citado sem confirmação recente), `previsto`
- `limite` / `limitePesados` em km/h, `limiteNota` quando o limite é suposto
- `lat`, `lon`, `precisao`, `info`, `fontes` (chaves do bloco `fontes`)

## Testar

- Local: `python -m http.server 8765` e abrir http://localhost:8765/#demo (o `#demo` simula um carro andando pela Av. Wilson Foz).
- Publicar: `git add -A; git commit -m "..."; git push` — o GitHub Pages atualiza em ~1 minuto. Ao mudar `app.js`/`style.css`, suba a versão em `VERSAO` no `sw.js` para os celulares pegarem a atualização.
