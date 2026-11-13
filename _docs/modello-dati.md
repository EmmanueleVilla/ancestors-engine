# Modello dei dati

I campi esatti di ogni record sono negli schemi Zod in `src/model/*.ts`. Questo file spiega le convenzioni che gli schemi non dicono. Gli esempi vengono dall'archivio inventato in `example/`.

## Cartelle

| Cartella | Record | Esempio di ID |
|---|---|---|
| `data/people/` | Persona | `P007_rossi_carlo` |
| `data/families/` | Famiglia (coppia e figli) | `FAM004_rossi_carlo__galli_maria` |
| `data/events/` | Evento (nascita, matrimonio, morte, leva) | `EVT009` |
| `data/places/` | Luogo | `PLC001` |
| `data/sources/` | Fonte (registro, archivio, foglio) | `SRC003` |
| `data/sources/citations/` | Citazione (un punto preciso di una fonte) | `CIT005` |
| `data/media/` | Documento (scansione, PDF, foto) e il suo record | `MED001` |
| `data/research/` | Registro ricerche e spogli dei registri | - |

## ID e nomi dei file

1. Il nome del file è uguale all'`id`, più `.yml`.
2. Le persone usano `Pnnn_cognome_nome`.
3. Le famiglie usano `FAMnnn_` + partner 1 + `__` + partner 2. Ogni partner è scritto `cognome_nome`.
4. Scrivi gli ID in minuscolo, senza accenti. Sostituisci spazi e apostrofi con `_`.
5. Gli altri record usano solo il numero: `EVTnnn`, `PLCnnn`, `SRCnnn`, `CITnnn`, `MEDnnn`.
6. Per un nuovo record, usa il numero libero più alto più uno.
7. Nei collegamenti scrivi sempre l'ID completo, con il suffisso.

**Perché:** un ID leggibile rende chiari i diff. Gli ID contengono nomi, quindi il sito pubblico li sostituisce con pseudonimi per le persone vive (vedi [privacy.md](privacy.md)).

## Collegamenti

1. Collega ogni persona agli eventi con `birth_event_id` e `death_event_id`.
2. Collega i figli alla famiglia con `children_ids`. Collega la coppia con `partner_ids`.
3. Collega ogni affermazione a una citazione (`source_citation_ids`).
4. Nella citazione scrivi `quoted_text` con le parole dell'atto. Scrivi anche `page_or_folio`, `evidence_type` e `confidence`.
5. Non collegare un figlio a una famiglia se l'atto non prova chi sono i genitori.

Il legame genitore-figlio non eredita le citazioni della famiglia. Il controllo lo accetta se una citazione del figlio è anche della famiglia, ha il `family_id` della famiglia o ha un `claim_type` con `parentage`. Altrimenti collega la citazione in `child_citation_ids`.

## Incertezza

1. Usa `precision` nelle date: per esempio `exact`, `year_only`, `approximate`, `range`. I valori ammessi sono in `src/model/date.ts`.
2. Usa `certainty` nella data quando due fonti non sono d'accordo.
3. Scrivi "TBC" nella nota quando un legame non è ancora confermato.
4. Usa `child_confidence` per un legame genitore-figlio non provato. Può valere per entrambi i genitori o per uno solo (esempio: `FAM004_rossi_carlo__galli_maria`).
5. Se due fonti non sono d'accordo, scrivi le due versioni nelle note. Non sceglierne una in silenzio.
6. Distingui una persona sconosciuta da una persona nota ma non ancora cercata.

Lo schema conserva una sola conclusione per evento. Le asserzioni in conflitto restano nelle citazioni (`quoted_text`) e nelle note.

## Campi speciali

- `parents_next_step` (persona): cosa serve per trovare i genitori. L'albero lo mostra sulla scheda "?", la scheda persona quando ha meno di due genitori. Con `tree.root_id` configurato, il controllo avvisa se un antenato diretto della radice (o del coniuge con cui ha figli) non ha padre o madre e non ha questo campo. Avvisa anche se il campo c'è ma il sito non lo mostra: genitori già collegati o persona riservata.
- `unrecorded_children` (famiglia): figli che sappiamo esistere ma che non inseriamo come persone.
- `tags: [scollegato]` (persona): la persona è volutamente fuori dall'albero, perché nessun atto prova il legame. Senza questo tag, il controllo avvisa se la persona non è in nessuna famiglia.
- `tags: [conoscenza_diretta]` (persona): la fonte è la conoscenza diretta della famiglia, di solito per le generazioni viventi. Senza questo tag e senza citazioni, il controllo avvisa su persone, famiglie, eventi, relazioni e legami genitore-figlio senza fonti.
- `tags: [decesso_ignoto]` (persona): la persona è nata oltre 115 anni fa ma l'atto di morte non è ancora noto. Senza questo tag o un evento di decesso/sepoltura, il validatore segnala una violazione della presunzione biologica di decesso.
- `transcribed_by` e `verified_on_original` (citazione): chi ha trascritto l'atto (`user`, `assistant`, `user_and_assistant`, `other`) e se una persona ha riletto la trascrizione sull'immagine originale.

Non usare `conoscenza_diretta` per un antenato. Per un antenato collega la citazione dell'atto che lo nomina, anche in `child_citation_ids`.

**Attenzione:** i tag `conoscenza_diretta` e `scollegato` spengono alcuni controlli. Controlla ogni loro uso nel diff, anche quando li scrive un agente.

## Dopo ogni modifica

1. Esegui `npm run check` nell'archivio.
2. Correggi tutti gli errori. Leggi anche gli avvisi su date e collegamenti: con `--strict` ogni avviso blocca, compresi i legami genitore-figlio senza fonti.
