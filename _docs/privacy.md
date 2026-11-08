# Privacy

Un archivio di famiglia contiene dati di persone vive. Il GDPR protegge le persone vive, non i defunti. Il sito privato mostra tutto. Il sito pubblico protegge le persone vive in tre modi.

## 1. Mascheramento

Il filtro (`src/privacy/filter.ts`) considera viva una persona senza morte registrata e nata meno di 100 anni fa. Se la data manca, la stima dai parenti (±30 anni per generazione).

Per ogni persona viva il sito pubblico:

1. scrive "[Living]" al posto del nome;
2. toglie date, eventi, note, media e citazioni;
3. toglie le voci del registro ricerche che la riguardano;
4. toglie il testo delle citazioni che la hanno come soggetto;
5. toglie le note delle famiglie in cui è partner.

Le persone in `privacy.named_living_ids` tengono nome e ID. Gli altri dati restano nascosti.

## 2. Pseudonimi degli ID

Gli ID contengono nome e cognome (`P001_rossi_luca`). Nel sito pubblico l'ID di una persona viva diventa un codice stabile, per esempio `L-2a9cce2636`. Il codice compare nei nomi dei file, nei link, nell'indice di ricerca, nel JSON degli alberi e nel testo.

Il codice viene da un HMAC dell'ID con `privacy.pseudonym_key`. Senza la chiave non si risale al nome.

## 3. Controllo anti-fuga

Dopo il build pubblico, `src/privacy/leak-check.ts` cerca in tutti i file generati gli ID originali e i nomi delle persone mascherate, nei due ordini (nome cognome, cognome nome). Se trova qualcosa, il build esce con codice 3 e scrive dove.

1. Non pubblicare mai un build pubblico che non finisce con `SUCCESS`.
2. Correggi la fuga nei dati: riscrivi il testo ("testimonianza di un familiare"). Non disattivare il controllo.
3. Il controllo non conosce le persone che non sono nell'archivio. Non scrivere nel testo libero nomi di terzi vivi (parroci, impiegati, parenti non inseriti).

Lo stesso controllo vale per `ancestors export`, che scrive il dataset pubblico in JSON.

## Testo libero

Il filtro toglie i campi delle persone vive, ma non può capire il testo libero degli altri record. Una nota su un defunto può nominare un nipote vivo.

1. Nelle note dei defunti scrivi la relazione, non il nome: "padre di un figlio vivente".
2. Non scrivere date di nascita di persone vive nelle note di altri.
3. Non scrivere nomi di persone vive nei nomi dei file media.
