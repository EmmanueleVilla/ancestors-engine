# ancestors-engine

An engine for genealogical archives kept as YAML files, designed to be maintained and developed in close collaboration with an LLM agent:

- **Strict schemas** (Zod) for persons, families, events, places, sources, citations, media, relationships, and research logs.
- **Provenance on kinship links**: citations, transcriptions, and a confidence level on each individual parent–child relationship.
- **Reading paradata**: records of who transcribed a source and whether a human researcher verified it against the original document.
- **Research log**: systematic tracking of every search attempt across archives (parish, civil, diocesan, state), including negative results (`outcome: not_found`).
- **Comprehensive validator**: checks for referential integrity, kinship cycles, biological plausibility, chronological consistency, and source coverage.
- **Dual-profile static site generator**:
  - **Private profile**: complete family tree, transcriptions, full-resolution media, research notes, and next steps.
  - **Public profile**: automatic masking of living persons, deterministic ID pseudonymization (`P_LIVING_xxx`), and a strict anti-leak gate that aborts the build if any sensitive data is detected. Exports the sanitized dataset as Open Data (JSON).

Real archive data lives in a separate **private** repository that uses this engine as an npm dependency. This public repository contains only the engine code and an invented sample family (the Rossi family in `example/`).

---

## Try the Example Archive

```sh
npm install
npm run example:check
npm run example:site          # generates private site in dist-example/
npm run example:site:public   # generates public site in dist-example-public/
```

The sample archive in `example/` provides a complete working model with sample records and sources.

---

## Initializing a New Archive (`ancestors init`)

The quickest way to start a new private archive is using the `init` command. It scaffolds the complete folder structure, configuration files, agent prompts, and Git hooks.

### How to Run

```sh
# 1. Create and enter a new directory (keep it private!)
mkdir family-archive && cd family-archive

# 2. Run the initialization script
npx ancestors init --name "Rossi"

# Or initialize a specific path from elsewhere:
npx ancestors init ./family-archive --name "Rossi"
```

#### Command Options
- `[dir]` *(optional)*: target directory (defaults to current working directory `.`).
- `-n, --name <name>`: family or archive name (used in titles, `package.json`, `CLAUDE.md`, and `archivio.config.yml`; default: `Famiglia`).
- `--force`: overwrite existing template files if any already exist.

### What `ancestors init` Creates

```text
family-archive/
├── data/
│   ├── people/           # Person records (P001_surname_name.yml)
│   ├── families/         # Family unions & parent-child links (FAM001_partner1__partner2.yml)
│   ├── events/           # Vital & lifecycle events (EVT001.yml)
│   ├── places/           # Hierarchical places with coordinates (PLC001.yml)
│   ├── sources/          # Archival sources, registers, and books (SRC001.yml)
│   ├── citations/        # Transcriptions, quotes, and certainty levels (CIT001.yml)
│   ├── media/            # Photos, scans, and PDFs (MED001.yml)
│   ├── relationships/    # Non-biological links: godparents, witnesses, guardians (REL001.yml)
│   └── research/
│       └── registro_ricerche.yml  # Research log (including negative searches)
├── assets/               # Custom photos, portraits, and static assets
├── scansioni_da_leggere/ # Working inbox for unprocessed high-res document scans (ignored in git)
├── .githooks/
│   └── pre-commit        # Executable Git hook: blocks commits if validation fails
├── archivio.config.yml   # Archive configuration with random 32-char pseudonym_key
├── NEXT_STEPS.md         # Open research threads (rendered on the private site)
├── CLAUDE.md & AGENTS.md # Instructions and rules for AI agents
├── .gitignore            # Excludes node_modules/, dist/, scansioni_da_leggere/
└── package.json          # Pre-configured with validation and build scripts
```

### Next Steps After Initialization

1. **Install dependencies**:
   ```sh
   npm install
   ```
2. **Configure your archive**:
   Open `archivio.config.yml` and adjust titles, subtitles, and set your root person ID in `tree.root_id` (e.g. `P001_rossi_mario`).
3. **Record your first document**:
   Add records interactively using an AI assistant or by placing files in `data/`.
4. **Validate**:
   ```sh
   npm run check
   ```
5. **Build and preview your private site**:
   ```sh
   npm run site
   ```

---

## Use the Engine in an Archive

In your archive's `package.json`:

```json
{
  "name": "smith-family-archive",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "ancestors validate --strict",
    "site": "ancestors build --profile private",
    "site:public": "ancestors build --profile public",
    "export": "ancestors export -o export-public",
    "prepare": "git config core.hooksPath .githooks 2>/dev/null || true"
  },
  "dependencies": {
    "ancestors-engine": "github:EmmanueleVilla/ancestors-engine#v1.4.0"
  }
}
```

Detailed setup instructions are in [_docs/nuovo-archivio.md](_docs/nuovo-archivio.md).

---

## Consistency and Data Integrity Checks

Running `ancestors validate` (or `npm run check`) performs a comprehensive multi-stage audit before every build or Git commit:

### 1. Schema & Syntax Validation (Zod)
- All YAML files in `data/` are validated against strict Zod schemas (`Person`, `Family`, `Event`, `Place`, `Source`, `SourceCitation`, `Media`, `ResearchEntry`, `Relationship`).
- Enforces valid types, enum values (`sex`, `relationship_type`, `event_type`, `precision`, `certainty`, etc.), and required fields.
- Verifies that record IDs match their file basenames exactly (`validData.id === path.basename(filePath)`).

### 2. Referential Integrity (`reference.ts`) — [ERROR, blocking]
- **No dangling or orphaned references**: every referenced person, family, place, event, source, citation, or media ID must exist.
- **No self-references**: a person cannot have a relationship with themselves (`related_person_id !== person_id`); a place cannot be its own parent place (`parent_place_id !== id`).
- **Family role separation**: a person cannot be simultaneously a partner and a child within the same family (`partner_ids` vs `children_ids`).

### 3. Kinship Cycle Detection (`cycle.ts`) — [ERROR, blocking]
- Detects circular ancestor/descendant relationships using a three-color depth-first search (DFS) over directed parent-child graphs. A person cannot be their own ancestor.

### 4. Chronological Sequence & Lifespan (`consistency.ts`) — [WARNING / ERROR in `--strict`]
- **Sequence of vital events**:
  - Death must be after birth (`death >= birth`).
  - Burial must be after death (`burial >= death`).
  - Maximum lifespan threshold: flags records where lifespan exceeds 110 years (`death - birth > 110`).
- **Event type matching**:
  - `birth_event_id` must reference an event of type `birth`, `baptism`, or `christening`.
  - `death_event_id` must reference a `death` event.
  - `burial_event_id` must reference a `burial` event.
  - `start_event_id` on families must reference `marriage`, `civil_union`, or `partnership`.
- **Event participation**: the person must be explicitly listed in the `person_ids` array of their associated birth, death, or burial event.

### 5. Biological & Physiological Plausibility (`consistency.ts`) — [WARNING / ERROR in `--strict`]
- **Minimum marriage age**: partners must be at least 13 years old at the date of marriage. No posthumous marriages.
- **Minimum parental age at childbirth**: both father and mother must be at least 13 years old when their child is born.
- **Maximum parental age at childbirth**:
  - Mother: at most 55 years old at child birth.
  - Father: at most 75 years old at child birth.
- **Posthumous births**: a child can be born up to ~10 months (0.85 years) after the death of the father; no child can be born after the death of the mother.
- **Partner sex check**: heuristic warning if both partners have the same recorded sex, prompting review for transcription or typing typos.

### 6. Evidence & Citation Hygiene (`consistency.ts`) — [WARNING / ERROR in `--strict`]
- **Mandatory source coverage**: every person, family, event, and relationship must be supported by at least one citation (`source_citation_ids`), or by the explicit tag `conoscenza_diretta` (permitted for living/recent generations).
- **Individual parent–child links**: warns if a specific filiation link in `children_ids` lacks a corroborating citation (in `child_citation_ids` or citations with `claim_type: parentage`).
- **Detached persons**: warns if an individual is not connected to any family, unless explicitly tagged with `scollegato` (used for individuals mentioned in records whose exact family link is yet to be established).
- **Orphan records without consumers**:
  - Events not linked to any person or family.
  - Citations not linked to any person, event, family, or relationship.
  - Sources without any citations or media scans.
  - Media files not linked to persons, events, or sources.

### 7. Research Next Steps (`parents_next_step`)
- For all direct ancestors of the root person (`tree.root_id`) whose parents are not yet identified, the validator requires the `parents_next_step` field (which populates the "?" placeholder on the family tree to guide future archival searches).
- Warns if `parents_next_step` is set on individuals who already have both parents documented, or on restricted living persons.

### 8. Privacy & Anti-Leak Protection (`privacy.ts`) — [ERROR, blocking]
- Automatically detects living persons (born less than 100 years ago without a death event).
- In the public profile (`ancestors build --profile public`): masks names, notes, photos, and personal events, replacing IDs with deterministic pseudonyms (`P_LIVING_xxx`).
- Post-build anti-leak audit: scans every generated HTML page and JSON export to abort the build if any restricted name, date, note, or raw ID leaked into the public site.

---

## Working with an AI Agent for Data Entry

In repositories using `ancestors-engine`, researchers do not edit dozens of raw YAML files by hand. Instead, they interact in natural language with an AI assistant (such as through the `genealogy-crud-wizard` skill).

The agent adheres strictly to the **critical genealogical method**: it does not record claims blindly, but systematically asks for source repositories, volume titles, folio numbers, certainty levels, and original digital scans.

### Example Interaction

````text
User:
"I found the baptism record of Maria Rossi at the Parish Archives of Clusone:
she was born on April 14, 1845, daughter of Pietro Rossi and Caterina Bianchi.
Godfather Giuseppe Carrara."

Agent:
"Great find! Before creating and linking the YAML files, let's verify the source details:
1. Source: In which parish register/volume is the record? (e.g. 'Parish of Clusone, Baptisms 1840-1850'). Do we already have an SRC record for this volume or should I create a new one?
2. Citation coordinates: At what page/folio and act number is it recorded?
3. Image: Do you have a photo or scan of the document? If you save it in data/media/ (e.g. 1845_clusone_rossi_maria_batt.jpg), I will immediately link it via a MED record.
4. Transcription: Would you like me to transcribe the full text (Latin/Italian) with reading paradata (transcriber and original verifier)?
5. Disambiguation: Are parents Pietro Rossi and Caterina Bianchi already recorded as FAM002_rossi_pietro__bianchi_caterina?"

User:
"The volume is 'Clusone - Nati e Battezzati 1840-1850', folio 42, act 18.
I saved the photo in data/media/1845_clusone_rossi_maria_batt.jpg.
The parents are indeed FAM002. Please transcribe the text."

Agent:
"All set! Here is what I am recording:
1. Created/verified source SRC004 for the Clusone baptism volume.
2. Created citation CIT015 with:
   - source_id: SRC004
   - page: 'f. 42, act 18'
   - certainty: definitive
   - transcription: [full transcribed text]
3. Created media record MED008 pointing to 1845_clusone_rossi_maria_batt.jpg.
4. Created event EVT019 (type: baptism, date: 1845-04-14, place: PLC003 Clusone).
5. Created person P015_rossi_maria linked to the birth/baptism event and citation CIT015.
6. Updated family FAM002 adding P015_rossi_maria to children_ids and CIT015 to child_citation_ids.
7. Recorded godparent relationship REL005 (godparent: Giuseppe Carrara).
8. Ran `ancestors validate --strict`:
   ✅ Validation passed: 0 errors, 0 warnings. Dataset is fully consistent!"
````

---

## CLI Commands

```sh
# Validate data integrity, references, and schemas
ancestors validate --data-dir ./data --strict

# Build static multi-page website
ancestors build --profile private --out ./dist
ancestors build --profile public --out ./dist-public

# Export sanitized dataset as Open Data (JSON)
ancestors export -o ./export-public

# Initialize a new archive repository
ancestors init ./my-archive --name "Rossi"
```

---

## Documentation

Detailed documentation (in Italian, matching the generated site interface and archive conventions) is available in [_docs/](_docs/README.md):

| Document | Topic |
|---|---|
| [_docs/modello-dati.md](_docs/modello-dati.md) | Entity schemas, ID formats, event types, and certainty levels |
| [_docs/registro-ricerche.md](_docs/registro-ricerche.md) | How to log archival searches, hypotheses, and negative outcomes |
| [_docs/fonti.md](_docs/fonti.md) | Critical method for reading, citing, and transcribing sources |
| [_docs/media.md](_docs/media.md) | Management of document photos and scans |
| [_docs/sito.md](_docs/sito.md) | Site generator architecture and private/public profiles |
| [_docs/configurazione.md](_docs/configurazione.md) | `archivio.config.yml` configuration reference |
| [_docs/privacy.md](_docs/privacy.md) | Living persons masking, pseudonyms, and leak checks |
| [_docs/nuovo-archivio.md](_docs/nuovo-archivio.md) | Step-by-step instructions for starting a new archive |
| [_docs/glossario.md](_docs/glossario.md) | Domain glossary |

---

## License

MIT. See [LICENSE](LICENSE).
