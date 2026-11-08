---
name: genealogy-crud-wizard
description: >-
  Interactive conversational CRUD wizard for the Ancestors genealogy archive.
  Use whenever the user wants to add, insert, query, update, link, or delete genealogy records
  (people, families, events, places, sources, citations, media) using natural language.
---

# Genealogy Natural Language CRUD Wizard

This skill guides an LLM agent to act as an interactive, conversational CRUD assistant for the Ancestors genealogy archive. Instead of manually editing YAML files or writing raw schemas, the user interacts in natural language (e.g. *"Voglio inserire una nuova persona"*, *"Aggiungi la moglie di Luca Rossi"*, *"Registra il matrimonio tra X e Y a Roma"*).

The agent guides the user step-by-step ("uno alla volta"), dynamically resolves entity references, ensures referential integrity, and validates all changes against the CLI.

---

## 1. Core Principles

1. **Schema-Driven, Dynamic Exploration**:
   Do **not** hardcode fixed forms into memory. When the user requests an operation on an entity (e.g., Person, Family, Event, Place, Source, Citation, Media), inspect the authoritative Zod schemas in `src/model/*.ts` (inside an archive: `node_modules/ancestors-engine/src/model/*.ts`) and the conventions in `_docs/modello-dati.md` (inside an archive: `node_modules/ancestors-engine/_docs/modello-dati.md`) to discover:
   - Required fields vs. optional fields.
   - Allowed enum values (e.g., `sex`, `relationship_type`, `event_type`, `precision`, `certainty`).
   - Structural relationships and references (`place_id`, `partner_ids`, `children_ids`, `source_id`, etc.).

2. **Step-by-Step Questioning (One Step at a Time)**:
   - **Never dump a massive 15-field questionnaire on the user.**
   - Ask for essential/required fields first (e.g., Given name and surname).
   - Once essential fields are answered, ask for immediate lifecycle events (Birth date/place) or family links.
   - Next, offer optional enrichments gracefully (e.g., *"Vuoi aggiungere altre informazioni come professione, soprannomi, fonti o note?"*).
   - If the user provides multiple pieces of information in their initial message (e.g., *"Inserisci Giuseppe Rossi nato a Firenze il 3 marzo 1890"*), extract everything already mentioned and only ask for what is missing.

3. **Intelligent Cross-Referencing & Disambiguation**:
   Whenever the user references another person, family, location, or source:
   - **Step A: Search `data/`**: Check existing YAML files in `data/people/`, `data/places/`, `data/families/`, `data/sources/`, etc.
   - **Step B: Exact Match Found**: Confirm the match with the user:
     > *"Ho trovato **Luca Rossi** (ID: `P001_rossi_luca`, nato nel 1990). Collego questo record?"*
   - **Step C: Multiple Matches Found**: Present candidates with distinguishing details (dates, places, relatives) and ask the user to pick one:
     > *"Ho trovato due persone chiamate Giuseppe Rossi:*  
     > *1. Giuseppe Rossi (`P002`), nato nel 1880 a Milano*  
     > *2. Giuseppe Rossi (`P005`), nato nel 1912 a Bergamo*  
     > *A quale ti riferisci?"*
   - **Step D: No Match Found**: Inform the user clearly and propose next steps:
     > *"Non ho trovato **Milano** tra i luoghi registrati. Vuoi che lo creiamo adesso come nuovo luogo (`data/places/PLC002.yml`), oppure lasciamo il campo vuoto per ora?"*
     If the user agrees, immediately spawn a brief sub-wizard for that referenced entity, save it, and resume the parent record.

4. **Automatic ID Generation**:
   Examine existing files in `data/<category>/` to find the highest existing numeric ID and increment it:
   - People: `Pxxx_cognome_nome` (es. `P056_rossi_mario`, tutto minuscolo, accenti e caratteri speciali rimossi/convertiti in underscore).
   - Families: `FAMxxx_partner1__partner2` (es. `FAM021_rossi_mario__bianchi_anna` dove i partner usano `cognome_nome`, separati da doppio underscore `__`).
   - Events: `EVT001`, `EVT002`, ...
   - Places: `PLC001`, `PLC002`, ...
   - Sources: `SRC001`, `SRC002`, ...
   - Citations: `CIT001`, `CIT002`, ...
   - Media: `MED001`, `MED002`, ...
   - Non-biological Relationships: `REL001`, `REL002`, ...

5. **Strict Post-Operation Validation**:
   After writing or editing any file, execute the validation CLI:
   ```bash
   ./dist/cli/index.js validate --data-dir data/
   ```
   If any validation error or circular reference is detected, inform the user and automatically correct it before concluding the turn.

---

## 2. Entity Workflows

### 2.1 Inserting a Person (`Person`)
- **Step 1 - Identity**:
  - Ask: Given names (`given_names`) and Surname (`surname`).
  - Optional: Biological sex (`male`, `female`, `unknown`).
- **Step 2 - Birth & Place**:
  - Ask: Birth date and place.
  - If date provided: Build a structured `GenealogyDate` object (see Section 3).
  - If place provided: Search `data/places/` for existing matching place. If not found, ask to create it.
  - Create the `birth` `Event` in `data/events/EVTxxx.yml`, and link `birth_event_id: EVTxxx` in the person's YAML.
- **Step 3 - Family Connections**:
  - Ask if the person has known parents or spouses.
  - If spouse/partner mentioned:
    - Search if spouse already exists in `data/people/`.
    - If found: Check if a `Family` entity already links them in `data/families/`. If not, create a new `FAMxxx` with `partner_ids: [P_A, P_B]`.
    - If not found: Ask if user wants to create the spouse now.
  - If parents mentioned:
    - Search for the parents.
    - Find their existing `Family` record, or create a `Family` with both parents as `partner_ids`.
    - Add this new person's ID to `children_ids` of that `Family`.
- **Step 4 - Death / Living Status**:
  - Ask: Is this person deceased? If yes, collect death date and place; create a `death` `Event` and set `death_event_id`.
  - If living or recent: System automatically derives privacy status, or allow setting `privacy: public | private`.
- **Step 5 - Summary & Confirmation**:
  - Show a formatted preview of the YAML files to be created/updated.
  - Ask for quick user confirmation before saving to disk.

### 2.2 Inserting a Family Union (`Family`)
- Check `data/families/` and `src/model/family.ts`.
- Ask for partners (`partner_ids`). Cross-reference each partner against `data/people/`.
- Ask for union type (`marriage`, `civil_union`, `partnership`, `informal_union`).
- Ask for marriage date/place. If provided, create an `Event` of type `marriage` and set `start_event_id`.
- Ask for known children (`children_ids`). Cross-reference each child.

### 2.3 Inserting Places (`Place`)
- Check `data/places/` and `src/model/place.ts`.
- Ask for place name (`name`, e.g. `"Bergamo"`).
- Ask for administrative hierarchy (`country`, `administrative_area` like region/province).
- Check if a parent place exists (e.g., linking a parish to a city using `parent_place_id`).

### 2.4 Inserting Events (`Event`)
- Check `data/events/` and `src/model/event.ts`.
- Ask for `event_type` (`birth`, `death`, `marriage`, `baptism`, `residence`, `emigration`, `occupation`, etc.).
- Ask for participating individuals (`person_ids`) or associated family (`family_id`).
- Ask for date (`date`) and place (`place_id`).

### 2.5 Inserting Sources & Citations (`Source`, `SourceCitation`)
- When user references a document (e.g., *"Atto di nascita dal registro parrocchiale di..."*):
- Check `data/sources/` to see if the source exists, or create a `Source` (`title`, `source_type`, `repository`, etc.).
- Create a `SourceCitation` referencing `source_id`, the specific claim (`claim_type`, e.g. `birth_date`, `parentage`), `page_or_folio`, and link to the entity ID.

---

## 3. Date Parsing & Conversion (`GenealogyDate`)

Genealogy dates often have varying precision. Translate natural language into the model defined in `src/model/date.ts`:

| Natural Language Input | Parsed `GenealogyDate` Structure |
|---|---|
| *"15 aprile 1892"* | `precision: "exact"`, `year: 1892`, `month: 4`, `day: 15`, `normalized_sort_date: "1892-04-15"` |
| *"maggio 1910"* | `precision: "year_month"`, `year: 1910`, `month: 5`, `normalized_sort_date: "1910-05-01"` |
| *"nel 1945"* | `precision: "year_only"`, `year: 1945`, `normalized_sort_date: "1945-01-01"` |
| *"circa 1880"* / *"verso il 1880"* | `precision: "approximate"`, `year: 1880`, `certainty: "estimated"`, `normalized_sort_date: "1880-01-01"` |
| *"tra il 1914 e il 1918"* | `precision: "range"`, `year: 1914`, `end_year: 1918`, `normalized_sort_date: "1914-01-01"` |
| *"prima del 1750"* | `precision: "before"`, `year: 1750`, `normalized_sort_date: "1750-01-01"` |
| *"dopo il 1900"* | `precision: "after"`, `year: 1900`, `normalized_sort_date: "1900-01-01"` |

---

## 4. Query, Update, and Delete Operations (Full CRUD)

### Read / Query (R)
- When user asks *"Chi è Mario Rossi?"* or *"Mostrami i figli di P001"*:
  - Read YAML files from `data/`.
  - Format a human-readable genealogical summary (lifespan, spouse, parents, children, birth/death places, attached sources).

### Update (U)
- When user says *"Aggiungi la data di morte a Giuseppe Rossi"* or *"Correggi il cognome di P003"*:
  - Locate the target YAML file.
  - If adding an event (e.g. death/burial), create the `Event` record if it doesn't exist and link it.
  - Save the file and run `./dist/cli/index.js validate --data-dir data/`.

### Delete (D)
- When user asks to delete an entity:
  - **Check all incoming references**: Check if any `Family` references this person in `partner_ids` or `children_ids`, any `Event` in `person_ids`, or any `Media` in `person_ids`.
  - Warn the user if dangling references will occur, and offer to automatically clean them up from associated files.
  - Delete the file and run `./dist/cli/index.js validate --data-dir data/` to confirm zero orphaned references.

---

## 5. Execution Checklist for the Agent

When activated:
1. [ ] Parse user intent: Create, Read, Update, or Delete?
2. [ ] Identify target entity type: Person, Family, Place, Event, Source, Media.
3. [ ] Check existing records in `data/` for IDs and potential cross-reference matches.
4. [ ] Converse interactively: ask questions one at a time.
5. [ ] Resolve any entity references (exact match, disambiguation, or offer to create).
6. [ ] Draft YAML with proper schema formatting.
7. [ ] Confirm with the user, write files to `data/`.
8. [ ] Execute `./dist/cli/index.js validate --data-dir data/`.
9. [ ] Report success to the user with the new ID and updated family summary.
