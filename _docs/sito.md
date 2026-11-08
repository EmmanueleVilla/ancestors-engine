# Sito

Il sito è statico. `src/generator/` lo genera dai file YAML. Non c'è un server.

## Comandi (in un archivio)

1. Esegui `npm run site` per il profilo privato.
2. Esegui `npm run site:public` per il profilo pubblico.
3. Pubblica solo l'output del profilo pubblico, e solo se il build finisce con `SUCCESS`.

I due comandi chiamano `ancestors build --profile private|public`. Le opzioni sono `--data-dir`, `--config`, `--out` (vedi `ancestors --help`).

## Profili

| Profilo | Contenuto |
|---|---|
| `private` | Tutte le persone e la pagina "Prossimi passi" (da `next_steps_file`) |
| `public` | Le persone vive diventano "[Living]" con un ID pseudonimo. Niente "Prossimi passi" |

Il filtro è in `src/privacy/`. Le regole sono in [privacy.md](privacy.md).

## Vincoli

1. Usa solo HTML, un file CSS e piccoli script JavaScript senza framework.
2. Usa link relativi. Il sito deve funzionare anche aperto da file locale.
3. Non scrivere handler JavaScript inline (`onclick=` e simili). La Content Security Policy li blocca.
4. Non modificare l'output generato. Modifica `src/` e rigenera.
5. Il target è il web da computer.
6. Non scrivere nel codice nomi, ID o testi di un archivio reale. Mettili in `archivio.config.yml` (vedi [configurazione.md](configurazione.md)).

## Codice

| Cartella | Compito |
|---|---|
| `src/model/` | Schemi Zod dei record |
| `src/parser/` | Lettura dei file YAML |
| `src/validator/` | Controlli: riferimenti, cicli, date, coerenza |
| `src/privacy/` | Filtro delle persone vive, pseudonimi, controllo anti-fuga |
| `src/config/` | Lettura di `archivio.config.yml` |
| `src/generator/` | Pagine, albero, ricerca, CSS e JS |
| `src/cli/` | Comandi `validate` e `build` |
| `tests/` | Test con Vitest |
| `example/` | Archivio inventato, usato nei test e come modello |

## Albero (disposizione)

- La persona radice è `tree.root_id`. Le posizioni manuali dei nodi sono in `tree.positions` della configurazione.
- Gli antenati del coniuge della radice (`tree.mirror_root_id`) sono calcolati in automatico e **scendono verso il basso**, sotto la riga dei figli. Ogni antenato sta al centro dello spazio dei suoi antenati, il padre a sinistra e la madre a destra.
- I segnaposto "?" e la linea diretta valgono per la radice e per gli antenati del coniuge.
- Serie (`src/generator/components/serie.ts`): partono dalle coppie di bisnonni della radice e dalle linee dei nonni o bisnonni del coniuge. In home ogni ramo ha il suo scaffale. I colori predefiniti sono nel CSS; un archivio li cambia con `site.series_colors`.
