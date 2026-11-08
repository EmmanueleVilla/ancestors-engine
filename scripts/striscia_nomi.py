"""Ritaglia la fascia alta (matricola + nome) di ogni pagina di un ruolo matricolare
e impila le strisce, N per pagina, in un nuovo PDF. Le immagini originali non vengono
ricampionate: si usano le stesse pagine, spostate e ritagliate. Accanto a ogni striscia
c'è il numero della pagina originale ("p.147"), per tornare subito al foglio intero.

Scritto il 4/11/2026 con Claude per i ruoli matricolari del Distretto militare di Como
(Biblioteca Digitale Lombarda). Esempio: Reg. 445_1893, 806 pagine -> 81 pagine di strisce.

Uso:
    python3 -m venv .venv && .venv/bin/pip install pypdf
    .venv/bin/python scripts/striscia_nomi.py input.pdf output.pdf [frazione=0.10] [per_pagina=10]

Parametri usati finora: classe 1890 e 1893 -> 0.10 e 10; classe 1899 -> 0.15 e 8.
Annota nel registro ricerche: method: targeted_reading, tools: [scripts/striscia_nomi.py].
Vedi _docs/fonti.md, sezione "Ruoli matricolari senza indice".
"""
import sys
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.annotations import FreeText
from pypdf.generic import RectangleObject

src, dst = sys.argv[1], sys.argv[2]
frac = float(sys.argv[3]) if len(sys.argv) > 3 else 0.10
per_page = int(sys.argv[4]) if len(sys.argv) > 4 else 10

reader = PdfReader(src)
writer = PdfWriter()
LABEL = 40  # margine a sinistra per il numero di pagina sorgente

pages = reader.pages
NORMAL_H = 1300  # le pagine più alte (copertine) si ritagliano come una normale

for start in range(0, len(pages), per_page):
    chunk = list(range(start, min(start + per_page, len(pages))))
    hs = [min(float(pages[j].mediabox.height), NORMAL_H) * frac for j in chunk]
    W = max(float(pages[j].mediabox.width) for j in chunk)
    out_h = sum(hs)
    out = writer.add_blank_page(width=W + LABEL, height=out_h)
    y_cursor = out_h
    for i, idx in enumerate(chunk):
        p = pages[idx]
        pw, ph = float(p.mediabox.width), float(p.mediabox.height)
        top = float(p.mediabox.top)
        left = float(p.mediabox.left)
        h = hs[i]
        strip_h = h
        # Ritaglia la pagina sorgente sulla fascia alta
        p.cropbox = RectangleObject([left, top - h, left + pw, top])
        p.mediabox = RectangleObject([left, top - h, left + pw, top])
        y_cursor -= h
        y_dest = y_cursor
        out.merge_transformed_page(
            p, Transformation().translate(LABEL - left, y_dest - (top - h)), expand=False
        )
        writer.add_annotation(
            page_number=len(writer.pages) - 1,
            annotation=FreeText(
                text=f"p.{idx + 1}",
                rect=(0, y_dest + strip_h / 2 - 10, LABEL - 2, y_dest + strip_h / 2 + 10),
                font_size="8pt",
                border_color=None,
                background_color=None,
            ),
        )

writer.compress_identical_objects()
with open(dst, "wb") as f:
    writer.write(f)
print(f"{len(pages)} pagine -> {len(writer.pages)} pagine in {dst}")
