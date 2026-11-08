# <Nome dell'archivio>

Archivio genealogico della famiglia <Cognome>. I dati sono file YAML in `data/`. L'engine (`ancestors-engine`) controlla i dati e genera il sito in `dist/`.

Questo repository è **privato**: contiene dati di persone vive. Non renderlo pubblico.

Lingua: scrivi in italiano, con gli accenti corretti.

## Comandi

- `npm run check`: controlla tutti i dati in modo stretto. Usalo dopo ogni modifica a `data/`.
- `npm run site`: genera il sito privato (tutte le persone).
- `npm run site:public`: genera il sito pubblico. Pubblicalo solo se finisce con `SUCCESS`.

## Regole che valgono sempre

1. Ogni fatto ha una fonte. Collega ogni persona, evento e famiglia a una citazione (`CITxxx`).
2. Non inventare dati. Se un dato è incerto, scrivi "TBC" nella nota e usa i campi di precisione della data.
3. Il nome del file è uguale all'`id` del record.
4. Non modificare `dist/`. È un risultato della build.
5. Registra ogni ricerca nel registro ricerche, anche se non trovi niente.
6. Non scrivere nomi di persone vive nel testo libero dei record dei defunti.

## Quale documento leggere

Le regole generiche sono nell'engine, in `node_modules/ancestors-engine/_docs/`. Quelle di questo archivio sono in `_docs/`.

| Compito | Leggi |
|---|---|
| Aggiungere o modificare persone, famiglie, eventi | `node_modules/ancestors-engine/_docs/modello-dati.md` |
| Annotare una ricerca fatta | `node_modules/ancestors-engine/_docs/registro-ricerche.md` |
| Leggere un atto o una nuova fonte | `node_modules/ancestors-engine/_docs/fonti.md` |
| Aggiungere una scansione o un PDF | `node_modules/ancestors-engine/_docs/media.md` |
| Sito, configurazione, privacy | `node_modules/ancestors-engine/_docs/sito.md`, `configurazione.md`, `privacy.md` |
| Decidere cosa cercare | [_docs/strategia-ricerca.md](_docs/strategia-ricerca.md) |
