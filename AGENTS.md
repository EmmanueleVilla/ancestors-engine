# ancestors-engine

Engine per archivi genealogici in YAML: schemi, validatore, filtro privacy e generatore di siti statici. Il codice TypeScript è in `src/`. Questo repository è **pubblico**: non contiene dati reali.

Lingua: scrivi in italiano, con gli accenti corretti.


# Code Reuse and Architecture

## Mandatory code reuse

Before implementing any new method, function, class, component, or utility:

1. Search the entire codebase for existing implementations of the same or similar functionality.
2. Inspect existing APIs, extensions, utilities, repositories, services, and shared modules.
3. Identify whether existing code can be reused, extended, or composed.
4. Prefer reusing existing implementations over creating new ones.

## Avoid duplication

- NEVER create a method that duplicates existing functionality.
- NEVER reimplement an algorithm or business rule already present in the codebase.
- NEVER introduce a new utility when an existing one can be extended.
- Prefer existing abstractions and established architectural patterns.
- Avoid introducing unnecessary wrappers around existing methods.
- Do not duplicate logic across platforms or modules when shared code already exists.

## Before creating new code

If no suitable implementation exists:
- Explain why existing implementations are insufficient.
- Consider whether the existing abstraction should be extended.
- Only then introduce new code.

## Refactoring

- Do not replace existing implementations just because a new implementation seems cleaner.
- Preserve existing behavior and API contracts.
- Avoid unrelated refactoring.

## Verification

Before considering a task complete:
- Check for duplicated functionality introduced by your changes.
- Verify that existing methods are reused wherever appropriate.
- Report which existing implementations were reused.
- Explicitly justify any newly introduced methods that overlap with existing functionality.


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
