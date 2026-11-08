# ancestors-engine

Engine per archivi genealogici in YAML: schemi, validatore, filtro privacy e generatore di siti statici. Il codice TypeScript è in `src/`. Questo repository è **pubblico**: non contiene dati reali.

Lingua: scrivi in italiano, con gli accenti corretti.

## Comandi

- `npm test`: esegue i test (Vitest).
- `npm run typecheck`: controlla i tipi.
- `npm run build`: compila in `dist/`.
- `npm run example:check`: controlla l'archivio inventato in `example/`.
- `npm run example:site` / `npm run example:site:public`: genera i due siti dell'esempio.

Il pre-commit hook (`.githooks/pre-commit`) esegue il controllo dei tipi e i test.

## Regole che valgono sempre

1. Non scrivere nel codice, nei test o nelle doc nomi, ID o testi di un archivio reale. Usa l'esempio inventato (famiglia Rossi).
2. Ciò che dipende da un archivio va in `archivio.config.yml` (`src/config/archive.ts`), non nel codice.
3. Ogni modifica al profilo pubblico deve passare il controllo anti-fuga e i test in `tests/integration/privacy_redaction.test.ts`.
4. Aggiungi un test per ogni nuova regola del validatore o del filtro.
5. Non modificare `dist/`. È un risultato della build.

## Quale documento leggere

| Compito | Leggi |
|---|---|
| Schemi e convenzioni dei record | [_docs/modello-dati.md](_docs/modello-dati.md) |
| Registro ricerche e paradati | [_docs/registro-ricerche.md](_docs/registro-ricerche.md) |
| Generatore e vincoli del sito | [_docs/sito.md](_docs/sito.md) |
| Configurazione dell'archivio | [_docs/configurazione.md](_docs/configurazione.md) |
| Privacy, pseudonimi, anti-fuga | [_docs/privacy.md](_docs/privacy.md) |
| Nuovo archivio, sviluppo insieme a un archivio | [_docs/nuovo-archivio.md](_docs/nuovo-archivio.md) |

L'indice completo è in [_docs/README.md](_docs/README.md).
