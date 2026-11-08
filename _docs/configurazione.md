# Configurazione dell'archivio

Ogni archivio ha un file `archivio.config.yml` nella sua radice. L'engine lo legge a ogni build. Lo schema è in `src/config/archive.ts`. Un esempio completo è `example/archivio.config.yml`.

**Perché:** il codice dell'engine è pubblico e non deve contenere nomi, ID o testi di un archivio reale.

## Sezioni

| Chiave | Contenuto |
|---|---|
| `site.title`, `site.subtitle` | Nome dell'archivio nella barra in alto |
| `site.description` | Descrizione delle pagine per i motori di ricerca |
| `site.footer` | Testo a piè di pagina |
| `site.home_title`, `site.home_intro` | Titolo e paragrafo della home |
| `site.series_colors` | Colori delle serie 1-8 (`color`, `on_color`), facoltativi |
| `next_steps_file` | File dei prossimi passi, solo nel sito privato |
| `privacy.named_living_ids` | Persone vive che nel sito pubblico tengono nome e ID |
| `privacy.pseudonym_key` | Chiave degli pseudonimi degli ID delle persone vive |
| `tree.root_id` | Persona radice dell'albero principale |
| `tree.mirror_root_id` | Coniuge della radice: i suoi antenati scendono verso il basso |
| `tree.positions` | Posizioni manuali dei nodi: `ID: { x: …, y: … }` |

## Regole

1. Tieni il file solo nel repository privato dell'archivio. Contiene la chiave degli pseudonimi.
2. Scegli una chiave lunga e casuale. Non cambiarla: cambierebbero i link pubblici delle persone vive.
3. Metti in `named_living_ids` solo chi ha accettato di comparire per nome (di solito l'autore).
4. Se il file manca, l'engine usa valori neutri e nessuna persona radice.
5. Se il file non è valido, il build si ferma con un errore.
