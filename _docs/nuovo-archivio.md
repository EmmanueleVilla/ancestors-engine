# Creare un nuovo archivio

Un archivio è un repository **privato** che contiene i dati e usa l'engine come dipendenza npm.

## Inizializzazione rapida con `ancestors init`

Il modo più rapido per creare un nuovo archivio è usare il comando `init`:

```sh
# Nella cartella del tuo nuovo archivio privato:
npx ancestors init --name "Rossi"
```

Lo script crea automaticamente:
- Tutte le cartelle richieste in `data/` (`people`, `families`, `events`, `places`, `sources`, `citations`, `media`, `relationships`, `research`);
- Il file iniziale `data/research/registro_ricerche.yml`;
- La configurazione `archivio.config.yml` con titolo personalizzato e chiave pseudonimi generata casualmente;
- `package.json`, `.gitignore`, `CLAUDE.md`, `AGENTS.md` e l'hook `.githooks/pre-commit`.

Dopo l'inizializzazione:
1. Esegui `npm install`.
2. Imposta l'identificativo della persona radice in `archivio.config.yml` (`tree.root_id`).
3. Esegui `npm run check` per validare l'integrità.

## Passi manuali alternativi

1. Crea un repository privato. Non renderlo mai pubblico: contiene dati di persone vive.
2. Copia `templates/` dell'engine nella radice del nuovo repository. Rinomina `CLAUDE.md` e `package.json` se servono.
3. In `package.json` scegli la versione dell'engine: `"ancestors-engine": "github:EmmanueleVilla/ancestors-engine#v1.4.3"`.
4. Esegui `npm install`.
5. Compila `archivio.config.yml`: titolo, persona radice, chiave degli pseudonimi (vedi [configurazione.md](configurazione.md)).
6. Crea `data/` con le cartelle del [modello dei dati](modello-dati.md) e un `data/research/registro_ricerche.yml` con `searches: []`.
7. Esegui `npm run check`, poi `npm run site`.

Per partire da un esempio funzionante, copia `example/` dell'engine.

## Lavorare su engine e archivio insieme

1. Clona l'engine in una cartella accanto all'archivio.
2. Nell'archivio usa `"ancestors-engine": "file:../ancestors-engine"` e rilancia `npm install`.
3. Dopo ogni modifica all'engine esegui `npm run build` nell'engine.
4. Prima di rilasciare una versione, torna a una dipendenza con tag (`#vX.Y.Z`).

## Prima di ogni rilascio dell'engine

Dall'archivio, esegui `node scripts/controlla-engine.mjs ../ancestors-engine`. Lo script cerca nell'engine gli ID e i nomi dell'archivio e si ferma se ne trova.
