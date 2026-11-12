import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAndValidateDataset } from '../../src/validator/index.js';
import { dateBounds } from '../../src/validator/consistency.js';
import { runValidateCommand } from '../../src/cli/validate.js';

let baseDir: string;
let dir: string;

function write(rel: string, content: string) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function person(id: string, extra = '') {
  write(`people/${id}.yml`, `id: ${id}\ngiven_names: ${id}\nsurname: Test\n${extra}`);
}

function event(id: string, type: string, personId: string, year: number, precision = 'year_only') {
  write(`events/${id}.yml`, `id: ${id}\nevent_type: ${type}\nperson_ids: [${personId}]\ndate:\n  precision: ${precision}\n  year: ${year}\n`);
}

/** Famiglia base: padre 1850, madre 1855, figlio 1880. Ogni test la rompe in un punto. */
function baseFamily() {
  person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\n');
  person('MOM', 'sex: female\nbirth_event_id: E_MOM_B\n');
  person('KID', 'sex: male\nbirth_event_id: E_KID_B\n');
  event('E_DAD_B', 'birth', 'DAD', 1850);
  event('E_MOM_B', 'birth', 'MOM', 1855);
  event('E_KID_B', 'birth', 'KID', 1880);
  write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID]\n');
}

const messages = () => loadAndValidateDataset(dir).warnings.map((w) => w.message);

beforeEach(() => {
  baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancestors-consistency-'));
  dir = path.join(baseDir, 'data');
  fs.mkdirSync(dir, { recursive: true });
});
afterEach(() => {
  fs.rmSync(baseDir, { recursive: true, force: true });
});

describe('Errori bloccanti', () => {
  it('rifiuta un campo sconosciuto (refuso)', () => {
    person('P1', 'birht_event_id: E1\n');
    const res = loadAndValidateDataset(dir);
    expect(res.valid).toBe(false);
    expect(res.errors[0].message).toMatch(/birht_event_id/);
  });

  it('rifiuta un id diverso dal nome del file', () => {
    write('people/P1.yml', 'id: P2\n');
    const res = loadAndValidateDataset(dir);
    expect(res.valid).toBe(false);
    expect(res.errors[0].message).toMatch(/does not match file name/);
  });
});

describe('Avvisi di coerenza', () => {
  it('nessun avviso su una famiglia plausibile', () => {
    baseFamily();
    expect(messages()).toEqual([]);
  });

  it('morte prima della nascita', () => {
    baseFamily();
    person('KID', 'sex: male\nbirth_event_id: E_KID_B\ndeath_event_id: E_KID_D\n');
    event('E_KID_D', 'death', 'KID', 1870);
    expect(messages()).toContainEqual(expect.stringMatching(/Morte precedente alla nascita/));
  });

  it('genitore troppo giovane', () => {
    baseFamily();
    event('E_KID_B', 'birth', 'KID', 1860);
    expect(messages()).toContainEqual(expect.stringMatching(/meno di 13 anni/));
  });

  it('madre troppo anziana', () => {
    baseFamily();
    event('E_MOM_B', 'birth', 'MOM', 1820);
    expect(messages()).toContainEqual(expect.stringMatching(/più di 55 anni/));
  });

  it('figlio nato dopo la morte della madre', () => {
    baseFamily();
    person('MOM', 'sex: female\nbirth_event_id: E_MOM_B\ndeath_event_id: E_MOM_D\n');
    event('E_MOM_D', 'death', 'MOM', 1875);
    expect(messages()).toContainEqual(expect.stringMatching(/dopo la morte del genitore/));
  });

  it('figlio postumo del padre entro pochi mesi: nessun avviso', () => {
    baseFamily();
    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\ndeath_event_id: E_DAD_D\n');
    write('events/E_DAD_D.yml', 'id: E_DAD_D\nevent_type: death\nperson_ids: [DAD]\ndate:\n  precision: exact\n  year: 1879\n  month: 12\n  day: 1\n');
    write('events/E_KID_B.yml', 'id: E_KID_B\nevent_type: birth\nperson_ids: [KID]\ndate:\n  precision: exact\n  year: 1880\n  month: 6\n  day: 1\n');
    expect(messages()).toEqual([]);
  });

  it('le date approssimate hanno tolleranza', () => {
    baseFamily();
    event('E_KID_B', 'birth', 'KID', 1866, 'approximate'); // padre forse 13enne: ammesso
    expect(messages()).toEqual([]);
  });

  it('matrimonio prima della nascita di uno sposo', () => {
    baseFamily();
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID]\nstart_event_id: E_MAR\n');
    write('events/E_MAR.yml', 'id: E_MAR\nevent_type: marriage\nfamily_id: F1\ndate:\n  precision: year_only\n  year: 1860\n');
    expect(messages()).toContainEqual(expect.stringMatching(/si sposa prima dei 13 anni/));
  });

  it('evento di tipo sbagliato e collegato alla persona sbagliata', () => {
    baseFamily();
    person('KID', 'sex: male\nbirth_event_id: E_DAD_B\n');
    const msgs = messages();
    expect(msgs).toContainEqual(expect.stringMatching(/non elenca questa persona/));
    expect(msgs).toContainEqual(expect.stringMatching(/ma la persona ha birth_event_id: E_DAD_B/));
  });

  it('partner dello stesso sesso', () => {
    baseFamily();
    person('MOM', 'sex: male\nbirth_event_id: E_MOM_B\n');
    expect(messages()).toContainEqual(expect.stringMatching(/Entrambi i partner/));
  });

  it('persona fuori da ogni famiglia, salvo tag scollegato', () => {
    baseFamily();
    person('LONE');
    expect(messages()).toContainEqual(expect.stringMatching(/non collegata a nessuna famiglia/));
    person('LONE', 'tags: [scollegato]\n');
    expect(messages()).toEqual([]);
  });

  it('persona, famiglia ed evento senza fonti, salvo citazione o tag conoscenza_diretta', () => {
    baseFamily();
    write('sources/SRC1.yml', 'id: SRC1\ntitle: Registro\nsource_type: civil_registry\n');
    write('sources/citations/C1.yml', 'id: C1\nsource_id: SRC1\nclaim_type: birth\nperson_id: KID\nevent_id: E_KID_B\n');
    let msgs = messages();
    expect(msgs).toContainEqual(expect.stringMatching(/Persona senza fonti/));
    expect(msgs).toContainEqual(expect.stringMatching(/Famiglia senza fonti/));
    expect(msgs).toContainEqual(expect.stringMatching(/Evento senza fonti/));
    // Il figlio e il suo evento hanno una citazione: niente avviso per loro.
    expect(loadAndValidateDataset(dir).warnings.filter((w) => w.filePath.includes('KID'))).toEqual([]);
    // Genitori noti per conoscenza diretta: niente avvisi né per loro, né per gli eventi, né per la famiglia.
    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\ntags: [conoscenza_diretta]\n');
    person('MOM', 'sex: female\nbirth_event_id: E_MOM_B\ntags: [conoscenza_diretta]\n');
    expect(messages()).toEqual([]);
  });

  it('child_citation_ids conta come fonte per il figlio e la famiglia', () => {
    baseFamily();
    write('sources/SRC1.yml', 'id: SRC1\ntitle: Registro\nsource_type: civil_registry\n');
    write('sources/citations/C1.yml', 'id: C1\nsource_id: SRC1\nclaim_type: marriage\nperson_id: DAD\nevent_id: E_DAD_B\n');
    write('sources/citations/C2.yml', 'id: C2\nsource_id: SRC1\nclaim_type: marriage\nperson_id: MOM\nevent_id: E_MOM_B\n');
    write('events/E_KID_B.yml', 'id: E_KID_B\nevent_type: birth\nperson_ids: [KID]\nsource_citation_ids: [C1]\ndate:\n  precision: year_only\n  year: 1880\n');
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID]\nchild_citation_ids:\n  KID: [C1]\n');
    expect(messages()).toEqual([]);
  });

  it('legame genitore-figlio e relazione esplicita senza fonti', () => {
    baseFamily();
    write('sources/SRC1.yml', 'id: SRC1\ntitle: Registro\nsource_type: civil_registry\n');
    write('sources/citations/C1.yml', 'id: C1\nsource_id: SRC1\nclaim_type: birth\nperson_id: DAD\nevent_id: E_DAD_B\nfamily_id: F1\n');
    write('sources/citations/C2.yml', 'id: C2\nsource_id: SRC1\nclaim_type: birth\nperson_id: MOM\nevent_id: E_MOM_B\n');
    write('sources/citations/C3.yml', 'id: C3\nsource_id: SRC1\nclaim_type: birth\nperson_id: KID\nevent_id: E_KID_B\n');
    // KID e F1 hanno fonti, ma nessuna citazione collega KID a F1: avviso sul legame (ora bloccante in --strict)
    expect(messages()).toContainEqual(expect.stringMatching(/Legame genitore-figlio senza fonti per KID/));
    expect(runValidateCommand({ dataDir: dir, silent: true, strict: true })).toBe(1);
    // Relazione esplicita senza fonti: bloccante in --strict
    write('relationships/R1.yml', 'id: R1\nperson_id: DAD\nrelated_person_id: KID\nrelationship_type: guardian\n');
    expect(messages()).toContainEqual(expect.stringMatching(/Relazione senza fonti/));
    expect(runValidateCommand({ dataDir: dir, silent: true, strict: true })).toBe(1);
  });

  it('il registro ricerche accetta paradati ed esito pianificata (sia chiavi inglesi che italiane)', () => {
    baseFamily();
    write('research/registro.yml', [
      'searches:',
      '  - date: 2026-11-07',
      '    goal: Nascita di KID',
      '    references: [KID]',
      '    outcome: planned',
      '    performed_by: user_and_assistant',
      '    method: targeted_reading',
      '    search_terms: [Test, Testi]',
      '    tools: [scripts/striscia_nomi.py]',
      '    coverage: manca il 1917',
      '',
    ].join('\n'));
    expect(loadAndValidateDataset(dir).valid).toBe(true);
    write('research/registro.yml', [
      'ricerche:',
      '  - data: 2026-11-07',
      '    obiettivo: Nascita di KID',
      '    riferimenti: [KID]',
      '    esito: pianificata',
      '    eseguita_da: utente_e_assistente',
      '    modalita: lettura_mirata',
      '    termini: [Test, Testi]',
      '    strumenti: [scripts/striscia_nomi.py]',
      '    copertura: manca il 1917',
      '',
    ].join('\n'));
    expect(loadAndValidateDataset(dir).valid).toBe(true);
    write('research/registro.yml', 'searches:\n  - date: 2026-11-07\n    goal: x\n    outcome: found\n    method: a_caso\n');
    expect(loadAndValidateDataset(dir).valid).toBe(false);
  });

  it('--strict fa fallire validate se ci sono avvisi', () => {
    baseFamily();
    person('LONE');
    expect(runValidateCommand({ dataDir: dir, silent: true })).toBe(0);
    expect(runValidateCommand({ dataDir: dir, silent: true, strict: true })).toBe(1);
  });

  it('persona con entrambi i genitori che definisce parents_next_step: avviso bloccante', () => {
    baseFamily();
    // KID ha già DAD e MOM come genitori
    person('KID', 'sex: male\nbirth_event_id: E_KID_B\nparents_next_step: "Cercare genitori di KID"\n');
    expect(messages()).toContainEqual(expect.stringMatching(/ha entrambi i genitori documentati/));
    expect(runValidateCommand({ dataDir: dir, silent: true, strict: true })).toBe(1);
  });

  it('antenato diretto privo di genitori e senza parents_next_step: avviso bloccante se rootId configurato', () => {
    baseFamily();
    // Scriviamo archivio.config.yml con root_id: KID
    fs.writeFileSync(
      path.join(path.dirname(dir), 'archivio.config.yml'),
      'tree:\n  root_id: KID\n'
    );
    // DAD e MOM sono antenati diretti di KID e non hanno genitori né parents_next_step
    const msgs = messages();
    expect(msgs).toContainEqual(expect.stringMatching(/Antenato diretto \(DAD Test\) privo di genitori documentati/));
    expect(msgs).toContainEqual(expect.stringMatching(/Antenato diretto \(MOM Test\) privo di genitori documentati/));
    expect(runValidateCommand({ dataDir: dir, silent: true, strict: true })).toBe(1);

    // Se compiliamo parents_next_step per DAD e MOM, l'errore scompare
    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\nparents_next_step: "Cercare genitori DAD"\n');
    person('MOM', 'sex: female\nbirth_event_id: E_MOM_B\nparents_next_step: "Cercare genitori MOM"\n');
    expect(messages().filter((m) => m.includes('parents_next_step'))).toEqual([]);
  });
});

describe('dateBounds', () => {
  it('copre il periodo della precisione', () => {
    expect(dateBounds({ precision: 'year_only', year: 1900 })).toEqual({ min: 1900, max: 1901 });
    expect(dateBounds({ precision: 'before', year: 1900 })!.min).toBe(-Infinity);
    expect(dateBounds({ precision: 'approximate', year: 1900 })).toEqual({ min: 1897, max: 1904 });
    expect(dateBounds({ precision: 'range', year: 1900, end_year: 1905 })).toEqual({ min: 1900, max: 1906 });
    expect(dateBounds({ precision: 'year_only' })).toBeNull();
  });
});
