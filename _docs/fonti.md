# Fonti

## Tipi di fonte

| Tipo | Contenuto |
|---|---|
| Stato civile | Registri dei Comuni: nati, matrimoni, morti, pubblicazioni |
| Ruoli e fogli matricolari | Servizio militare, genitori, data e luogo di nascita |
| Estratti dei Comuni | Copie brevi di atti recenti, rilasciate su richiesta |
| Registri parrocchiali | Battesimi, matrimoni, defunti |
| Lapidi | Date di nascita e morte |
| Memoria di famiglia | Racconti, da confermare con un documento |

Le fonti online e gli uffici di un archivio specifico vanno nella cartella `_docs/` dell'archivio.

## Come leggere un atto

1. Trascrivi le parole dell'atto in `quoted_text` della citazione.
2. Scrivi `(?)` dopo una lettura incerta.
3. Scrivi `[...]` per una parte illeggibile o non trascritta.
4. Scrivi in `page_or_folio` il numero dell'atto, la pagina o l'immagine del portale.
5. Se l'atto contraddice un dato già inserito, scrivi le due versioni nelle note.
6. Compila `transcribed_by`. Scrivi `verified_on_original: true` solo dopo che una persona ha riletto l'immagine.

`quoted_text` è un estratto letterale, non un'edizione diplomatica completa.

## Ruoli matricolari senza indice

Molti ruoli matricolari digitalizzati sono ordinati per matricola e non hanno un indice. Il nome è in alto su ogni pagina.

1. Scarica il PDF del registro in una cartella che git non registra.
2. Esegui `scripts/striscia_nomi.py`. Lo script crea un PDF con le sole strisce dei nomi. Le istruzioni sono in testa allo script.
3. Scorri le strisce. Ogni striscia riporta il numero della pagina originale.
4. Apri la pagina originale e leggi il foglio intero.
5. Nel registro ricerche scrivi `method: targeted_reading` e lo script in `tools`.

**Perché:** un registro di 806 pagine diventa un PDF di 81 pagine di nomi. La verifica resta sul foglio originale.
