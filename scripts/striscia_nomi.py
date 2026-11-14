"""Ritaglia fisicamente la fascia alta (matricola + nome) di ogni pagina di un ruolo
matricolare e impila le strisce, N per pagina, in un nuovo PDF leggero. Accanto a ogni
striscia c'è il numero della pagina originale ("p.147"), per tornare subito al foglio intero.

Scritto il 4/11/2026 per i ruoli matricolari del Distretto militare di Como
(Biblioteca Digitale Lombarda) e aggiornato il 14/11/2026 con PyMuPDF per ritagliare
davvero le immagini (riducendo il peso di ~85-95% rispetto al PDF originale).

Uso:
    python3 -m venv .venv && .venv/bin/pip install pymupdf
    .venv/bin/python scripts/striscia_nomi.py input.pdf output.pdf [frazione=0.10] [per_pagina=10]

Parametri usati finora: classe 1888, 1890 e 1893 -> 0.10 e 10; classe 1899 -> 0.15 e 8.
Annota nel registro ricerche: method: targeted_reading, tools: [scripts/striscia_nomi.py].
Vedi _docs/fonti.md, sezione "Ruoli matricolari senza indice".
"""
import sys
import pymupdf

src, dst = sys.argv[1], sys.argv[2]
frac = float(sys.argv[3]) if len(sys.argv) > 3 else 0.10
per_page = int(sys.argv[4]) if len(sys.argv) > 4 else 10

src_doc = pymupdf.open(src)
out_doc = pymupdf.open()
LABEL = 40  # margine a sinistra per il numero di pagina sorgente
NORMAL_H = 1300  # le pagine più alte (copertine) si ritagliano come una normale
DPI = 115
JPG_QUALITY = 70

total = len(src_doc)
for start in range(0, total, per_page):
    chunk = list(range(start, min(start + per_page, total)))
    hs = [min(float(src_doc[j].rect.height), NORMAL_H) * frac for j in chunk]
    W = max(float(src_doc[j].rect.width) for j in chunk)
    out_h = sum(hs)
    out_page = out_doc.new_page(width=W + LABEL, height=out_h)
    y_cursor = 0.0
    for i, idx in enumerate(chunk):
        p = src_doc[idx]
        r = p.rect
        h = hs[i]
        clip = pymupdf.Rect(r.x0, r.y0, r.x1, min(r.y1, r.y0 + h))
        pix = p.get_pixmap(clip=clip, dpi=DPI, colorspace=pymupdf.csGRAY)
        dest_rect = pymupdf.Rect(LABEL, y_cursor, LABEL + r.width, y_cursor + h)
        out_page.insert_image(
            dest_rect,
            stream=pix.tobytes("jpg", jpg_quality=JPG_QUALITY),
        )
        out_page.insert_text(
            (4, y_cursor + h / 2 + 3),
            f"p.{idx + 1}",
            fontsize=9,
            color=(0, 0, 0),
        )
        y_cursor += h

out_doc.save(dst, garbage=4, deflate=True)
print(f"{total} pagine -> {len(out_doc)} pagine in {dst}")
