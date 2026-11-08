# Media

I file (scansioni, PDF, foto) sono in `data/media/`. Ogni file ha un record `MEDnnn.yml` nella stessa cartella. Il campo `file_path` è relativo alla radice dell'archivio (la cartella che contiene `data/`).

## Nome del file

Schema: `tipo_luogo_anno_soggetto.ext`

1. Scrivi tutto in minuscolo, senza accenti.
2. Separa i campi con `_`. Separa le parole dentro un campo con `-`: `castel-nuovo`.
3. Ometti un campo che non serve.
4. Scrivi l'anno intero. Per un intervallo usa `1916-1925`.
5. Scrivi l'estensione in minuscolo. Usa `.jpg`, non `.jpeg`.

### Tipi ammessi

`indice-matrimoni`, `indice-decennale-matrimoni`, `atto-nascita`, `atto-matrimonio`, `atto-morte`, `estratto-nascita`, `estratto-matrimonio`, `pubblicazioni`, `richiesta-pubblicazioni`, `tomba`, `lettera`, `foglio-matricolare`.

Per `foglio-matricolare` il luogo è il Comune di nascita.

### Soggetto

1. Scrivi ogni persona come `cognome-nome`.
2. Per una coppia, scrivi prima il marito.
3. Per un ritaglio di indice, scrivi il cognome cercato. Aggiungi `-1`, `-2` se le pagine sono più di una.
4. Per le pagine di un indice usa `_a`, `_b`.

Esempio: `atto-matrimonio_borgonuovo_1950_rossi-pietro_ferrari-teresa.jpg`

**Attenzione:** il nome del file finisce nel sito pubblico. Non scrivere il nome di una persona viva nel nome di un file.

## Quando arriva un file nuovo

1. Rinomina il file con `git mv` secondo lo schema.
2. Crea il record `MEDnnn.yml` con `file_path`, `media_type`, `mime_type`, `title` e `source_id`.
3. Se il file era già nominato nel registro ricerche, aggiorna il nome anche lì.
4. Collega il media alla persona con `media_ids`.
