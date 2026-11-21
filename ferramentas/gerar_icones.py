"""Gera os ícones PNG do app (placa R-19 de 50 km/h sobre fundo escuro)."""
import os
from PIL import Image, ImageDraw, ImageFont
AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, "..", "icons")
def fonte(tam):
    for f in ("C:/Windows/Fonts/bahnschrift.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if os.path.exists(f):
            ft = ImageFont.truetype(f, tam)
            try: ft.set_variation_by_name("Bold Condensed")
            except Exception: pass
            return ft
    return ImageFont.load_default()
def icone(tam, margem, nome, fundo_redondo):
    S = tam * 4
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if fundo_redondo: d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * .22), fill="#14181f")
    else: d.rectangle([0, 0, S, S], fill="#14181f")
    m = int(S * margem); r = S - 2 * m
    d.ellipse([m, m, S - m, S - m], fill="#c8102e")
    b = int(r * .13)
    d.ellipse([m + b, m + b, S - m - b, S - m - b], fill="#ffffff")
    ft = fonte(int(r * .46))
    d.text((S / 2, S / 2 + r * .01), "50", font=ft, fill="#111111", anchor="mm")
    im.resize((tam, tam), Image.LANCZOS).save(os.path.join(SAIDA, nome))
icone(192, .1, "icon-192.png", True)
icone(512, .1, "icon-512.png", True)
icone(512, .2, "icon-maskable-512.png", False)
icone(180, .1, "apple-touch-icon.png", False)
print("ok")
