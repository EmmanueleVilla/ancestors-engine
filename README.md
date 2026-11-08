# ancestors-engine

Engine per archivi genealogici scritti in file YAML, pensato per lavorare con un agente LLM:

- **schemi stretti** (Zod) per persone, famiglie, eventi, luoghi, fonti, citazioni e media;
- **provenienza sui legami**: citazioni e grado di certezza sul singolo legame genitore-figlio;
- **paradati di lettura**: chi ha trascritto una fonte e se una persona l'ha riletta sull'originale;
- **registro delle ricerche**, comprese quelle senza risultato, con esiti controllati;
- **validatore** (riferimenti, cicli, date impossibili, fonti mancanti);
- **sito statico** con un profilo privato e un profilo pubblico che maschera le persone vive, sostituisce i loro ID con pseudonimi e si ferma se trova una fuga di dati.

Con `ancestors export` il dataset del profilo pubblico si esporta in JSON, per depositarlo come dato aperto.

I dati di un archivio reale stanno in un repository **privato** separato, che usa l'engine come dipendenza.

## Provare l'esempio

```sh
npm install
npm run example:check
npm run example:site          # sito privato in dist-example/
npm run example:site:public   # sito pubblico in dist-example-public/
```

L'esempio (`example/`) è una famiglia inventata.

## Usare l'engine in un archivio

```json
"dependencies": { "ancestors-engine": "github:EmmanueleVilla/ancestors-engine#v1.0.0" },
"scripts": {
  "check": "ancestors validate --strict",
  "site": "ancestors build --profile private",
  "site:public": "ancestors build --profile public"
}
```

I passi completi sono in [_docs/nuovo-archivio.md](_docs/nuovo-archivio.md). I file di partenza sono in `templates/`.

## Documentazione

La documentazione, per persone e agenti LLM, è in [_docs/](_docs/README.md).

## Licenza

MIT. Vedi [LICENSE](LICENSE).
