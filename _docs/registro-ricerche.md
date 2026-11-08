# Registro ricerche

Il registro è `data/research/registro_ricerche.yml` (chiave `searches:`). Contiene una voce per ogni controllo in un archivio, anche quando non trovi niente.

**Perché:** le richieste agli uffici sono poche e lente. Il registro evita di controllare due volte lo stesso registro.

**Perché, nel metodo:**

1. Il registro è il *research log* della genealogia professionale. Annota anche le *negative searches*. Vedi Mills, *Evidence Explained*, e Shan & Luther (2025, *PACM HCI* 9(2), CSCW155).
2. "Non trovato" non vuol dire "non esiste". Un esito negativo vale solo per quella fonte, quegli anni, quelle grafie e quella data.
3. I campi "da chi" e "come" sono paradati: documentano il processo, non il dato. Vedi Huvila (2022) e Feliciati & Duranti (2025).

## Campi

Lo schema è in `src/model/research.ts`. I campi principali sono: `date`, `goal`, `references`, `source`, `place`, `register`, `years`, `outcome`, `notes`, `media`.

I valori controllati di `outcome` sono:

| Valore | Significato |
|---|---|
| `found` | L'atto c'è |
| `not_found` | Il registro c'è, l'atto no |
| `partial` | Trovata solo una parte (per esempio solo l'indice) |
| `awaiting_reply` | Richiesta inviata, in attesa di risposta |
| `not_available` | Il registro non c'è o non è consultabile per quegli anni |
| `withdrawn` | Richiesta annullata o ritirata |
| `delivery_failed` | Il messaggio o la mail non è arrivata (es. casella piena) |
| `planned` | Ricerca decisa ma non ancora fatta. `date` è il giorno della decisione |

Non scrivere mai che un atto "non esiste", nemmeno nelle note. Scrivi quali registri disponibili non lo contengono, con le lacune in `coverage`.

## Paradati

Compila questi campi facoltativi in ogni voce nuova.

| Campo | Cosa scrivere |
|---|---|
| `performed_by` | `user`, `assistant`, `user_and_assistant` o `institution` |
| `method` | `index`, `full_reading`, `targeted_reading`, `text_search`, `inquiry`, `reading_room` o `other` |
| `search_terms` | I nomi e le grafie cercati, anche le varianti |
| `tools` | Gli script e il modello AI usati, con i parametri |
| `coverage` | Le lacune note della fonte: anni mancanti, pagine illeggibili, indice incompleto |

1. Scrivi `user_and_assistant` se uno ha letto e l'altro ha controllato.
2. Fai ricontrollare a una persona ogni esito `not_found` letto solo dall'assistente.
3. Non indovinare i paradati di una voce vecchia. Compilali solo se la sessione lo dice.
4. Scrivi le note in parole semplici. Il sito pubblico le mostra: non usare ID e non nominare persone vive.

**Perché:** i paradati dicono quanto vale un esito negativo. "Not found" con una lettura completa (`full_reading`) pesa più di "not found" con un indice (`index`). Un nome saltato da una lettura automatica lascia solo un `not_found`: per scoprirlo bisogna rileggere la fonte.

## Come aggiungere una ricerca

1. Cerca una voce con lo stesso luogo, registro e obiettivo.
2. Se c'è, aggiungi l'anno a `years`. Non creare un doppione.
3. Se non c'è, crea una voce nuova sotto `searches:`.
4. Per un registro che manca, crea una voce separata con `not_available`.
5. Metti in `references` gli ID di persone e famiglie. Le voci con un `FAMxxx` compaiono nel pannello della famiglia nell'albero.
6. Compila i paradati (vedi sopra).
7. Per un passo deciso ma non ancora fatto, crea una voce `planned`. Quando lo fai, cambia l'esito e la data.

## Spogli

Quando leggi un registro intero, scrivi l'elenco in `data/research/spogli/<luogo>_<tipo>_<anni>.md`.
