"""Gera osm-brasil.json com os radares de velocidade do Brasil cadastrados no OpenStreetMap.

Uso:  pip install osmium
      python ferramentas/baixar_osm.py                       (baixa o Brasil da Geofabrik, ~2,1 GB)
      python ferramentas/baixar_osm.py --pbf brazil.osm.pbf  (usa um arquivo já baixado)

Roda todo mês pelo GitHub Actions (.github/workflows/osm.yml), que é o jeito recomendado: o arquivo do
Brasil é grande demais para baixar no PC à toa.

Como funciona:
- Baixa o extrato do Brasil da Geofabrik (cópia diária do OpenStreetMap, feita para download) e lê só os
  nós highway=speed_camera com o pyosmium. Antes usávamos a API Overpass, mas os servidores públicos
  vivem lotados (502/504) e a consulta do país inteiro não passava.
- Fica só o que está dentro do contorno do Brasil (ferramentas/brasil-contorno.json, simplificado) ou a
  até 3 km da fronteira (cidades-gêmeas).
- A rua de cada radar o app descobre sozinho, pelos nomes das ruas que já vêm no mapa.

Formato de saída (compacto, para o celular baixar rápido):
  {"atualizado": "DD/MM/AAAA", "total": N, "r": [[lat, lon, limite_ou_0, id_osm], ...]}
Dados © colaboradores do OpenStreetMap, licença ODbL (https://www.openstreetmap.org/copyright).
"""
import argparse
import json
import math
import re
import shutil
import sys
import tempfile
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

URL_PBF = 'https://download.geofabrik.de/south-america/brazil-latest.osm.pbf'
AGENTE = 'radar-votuporanga/1.0 (mapa de radares, atualizacao mensal)'
RAIZ = Path(__file__).resolve().parent.parent
CONTORNO = json.loads((Path(__file__).resolve().parent / 'brasil-contorno.json').read_text(encoding='utf-8'))['contorno']


def numero(v):
    m = re.match(r'\s*(\d{2,3})', str(v or ''))
    return int(m.group(1)) if m else 0


def dist_segmento(lat, lon, a, b):
    """Distância em metros do ponto ao segmento a-b ((lon, lat)), em projeção local."""
    c = math.cos(math.radians(lat))
    ax, ay = (a[0] - lon) * 111320 * c, (a[1] - lat) * 110574
    bx, by = (b[0] - lon) * 111320 * c, (b[1] - lat) * 110574
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0 if not l2 else max(0, min(1, -(ax * dx + ay * dy) / l2))
    return math.hypot(ax + t * dx, ay + t * dy)


def dentro(lat, lon):
    """Ponto dentro do contorno do Brasil (raio cruzando as bordas)."""
    d = False
    for i in range(len(CONTORNO)):
        x1, y1 = CONTORNO[i - 1]
        x2, y2 = CONTORNO[i]
        if (y1 > lat) != (y2 > lat) and lon < x1 + (lat - y1) * (x2 - x1) / (y2 - y1):
            d = not d
    return d


def no_brasil(lat, lon, folga=3000):
    return dentro(lat, lon) or any(dist_segmento(lat, lon, CONTORNO[i - 1], CONTORNO[i]) <= folga for i in range(len(CONTORNO)))


def baixar_pbf(destino):
    print(f'baixando {URL_PBF} ...', flush=True)
    req = urllib.request.Request(URL_PBF, headers={'User-Agent': AGENTE})
    with urllib.request.urlopen(req, timeout=120) as r, open(destino, 'wb') as f:
        shutil.copyfileobj(r, f, 4 * 1024 * 1024)
    print(f'  {destino.stat().st_size // (1024 * 1024)} MB', flush=True)


def ler_radares(pbf):
    import osmium  # pip install osmium
    radares = {}
    fp = osmium.FileProcessor(str(pbf), osmium.osm.NODE).with_filter(osmium.filter.TagFilter(('highway', 'speed_camera')))
    for n in fp:
        if not n.location.valid():
            continue
        radares[n.id] = (n.location.lat, n.location.lon, n.tags.get('maxspeed'))
    return radares


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pbf', help='arquivo .osm.pbf do Brasil já baixado')
    ap.add_argument('--saida', default=str(RAIZ / 'osm-brasil.json'))
    a = ap.parse_args()
    saida = Path(a.saida)

    if a.pbf:
        radares = ler_radares(a.pbf)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            pbf = Path(tmp) / 'brasil.osm.pbf'
            baixar_pbf(pbf)
            radares = ler_radares(pbf)
    antes = len(radares)
    radares = {k: v for k, v in radares.items() if no_brasil(v[0], v[1])}
    print(f'{len(radares)} radares no Brasil ({antes - len(radares)} de países vizinhos descartados)', flush=True)

    r = [[round(lat, 5), round(lon, 5), numero(ms), k] for k, (lat, lon, ms) in sorted(radares.items())]
    if len(r) < 1000:
        sys.exit(f'só {len(r)} radares: algo deu errado, arquivo antigo mantido')
    if saida.exists():
        try:
            if json.loads(saida.read_text(encoding='utf-8')).get('r') == r:
                print('nada mudou desde a última vez')
                return
        except ValueError:
            pass
    agora = datetime.now(timezone(timedelta(hours=-3)))
    j = {'atualizado': agora.strftime('%d/%m/%Y'), 'total': len(r), 'r': r}
    saida.write_text(json.dumps(j, separators=(',', ':')), encoding='utf-8')
    sem_lim = sum(1 for x in r if not x[2])
    print(f'gravado {saida} ({saida.stat().st_size // 1024} KB): {len(r)} radares, {sem_lim} sem limite')


if __name__ == '__main__':
    main()
