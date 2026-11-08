# Documentazione dell'engine

Questa cartella contiene le regole generiche per un archivio che usa `ancestors-engine`. Valgono per persone e agenti LLM. Leggi solo il file che serve per il compito.

In un archivio questi file sono in `node_modules/ancestors-engine/_docs/`. Le regole specifiche di un archivio (strategia di ricerca, fonti locali, decisioni) stanno nella cartella `_docs/` dell'archivio.

## File

| File | Contenuto |
|---|---|
| [modello-dati.md](modello-dati.md) | Tipi di record, formato degli ID, collegamenti, incertezza |
| [registro-ricerche.md](registro-ricerche.md) | Come annotare ogni ricerca nel registro, anche quando non trovi niente |
| [fonti.md](fonti.md) | Come leggere un atto e scrivere una citazione |
| [media.md](media.md) | Nomi dei file in `data/media` e record `MEDxxx` |
| [sito.md](sito.md) | Generatore, profili privato e pubblico, vincoli del sito |
| [configurazione.md](configurazione.md) | Il file `archivio.config.yml` |
| [privacy.md](privacy.md) | Persone vive, pseudonimi, controllo anti-fuga |
| [nuovo-archivio.md](nuovo-archivio.md) | Come creare un archivio che usa l'engine |
| [glossario.md](glossario.md) | Significato delle parole del progetto |

Gli schemi Zod in `src/model/*.ts` sono la fonte di verità per i campi dei record.

## Come scrivere in questa cartella

Questi testi sono per agenti e per persone. Scrivi in modo che non si possano leggere in due modi.

1. Scrivi una regola per frase. Usa al massimo 20 parole per un'istruzione.
2. Usa la forma attiva e l'imperativo: "Aggiungi la citazione", non "La citazione deve essere aggiunta".
3. Usa un verbo, non un nome: "Controlla l'atto", non "Effettua un controllo dell'atto".
4. Usa sempre la stessa parola per la stessa cosa. Le parole del progetto sono nel [glossario](glossario.md).
5. Usa una lista numerata se ci sono 3 o più passi.
6. Non cambiare il grado di certezza: "forse" resta "forse".
7. Scrivi il motivo di una regola quando non è ovvio (**Perché:**).
8. Non copiare qui i campi degli schemi. Rimanda a `src/model/`.
9. Non scrivere qui nomi o ID di un archivio reale. Per gli esempi usa l'archivio inventato di `example/` (famiglia Rossi).

Queste regole vengono dallo standard ASD-STE100, adattato all'italiano.
