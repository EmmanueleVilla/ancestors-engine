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
  person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\ntags: [decesso_ignoto]\n');
  person('MOM', 'sex: female\nbirth_event_id: E_MOM_B\ntags: [decesso_ignoto]\n');
  person('KID', 'sex: male\nbirth_event_id: E_KID_B\ntags: [decesso_ignoto]\n');
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
    write('sources/citations/C1.yml', 'id: C1\nsource_id: SRC1\nclaim_type: birth\nperson_id: KID\nevent_id: E_KID_B\npage_or_folio: "p. 1"\n');
    let msgs = messages();
    expect(msgs).toContainEqual(expect.stringMatching(/Persona senza fonti/));
    expect(msgs).toContainEqual(expect.stringMatching(/Famiglia senza fonti/));
    expect(msgs).toContainEqual(expect.stringMatching(/Evento senza fonti/));
    // Il figlio e il suo evento hanno una citazione: niente avviso per loro.
    expect(loadAndValidateDataset(dir).warnings.filter((w) => w.filePath.includes('KID'))).toEqual([]);
    // Genitori noti per conoscenza diretta: niente avvisi né per loro, né per gli eventi, né per la famiglia.
    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\ntags: [conoscenza_diretta, decesso_ignoto]\n');
    person('MOM', 'sex: female\nbirth_event_id: E_MOM_B\ntags: [conoscenza_diretta, decesso_ignoto]\n');
    expect(messages()).toEqual([]);
  });

  it('child_citation_ids conta come fonte per il figlio e la famiglia', () => {
    baseFamily();
    write('sources/SRC1.yml', 'id: SRC1\ntitle: Registro\nsource_type: civil_registry\n');
    write('sources/citations/C1.yml', 'id: C1\nsource_id: SRC1\nclaim_type: marriage\nperson_id: DAD\nevent_id: E_DAD_B\npage_or_folio: "p. 1"\n');
    write('sources/citations/C2.yml', 'id: C2\nsource_id: SRC1\nclaim_type: marriage\nperson_id: MOM\nevent_id: E_MOM_B\npage_or_folio: "p. 2"\n');
    write('events/E_KID_B.yml', 'id: E_KID_B\nevent_type: birth\nperson_ids: [KID]\nsource_citation_ids: [C1]\ndate:\n  precision: year_only\n  year: 1880\n');
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID]\nchild_citation_ids:\n  KID: [C1]\n');
    expect(messages()).toEqual([]);
  });

  it('legame genitore-figlio e relazione esplicita senza fonti', () => {
    baseFamily();
    write('sources/SRC1.yml', 'id: SRC1\ntitle: Registro\nsource_type: civil_registry\n');
    write('sources/citations/C1.yml', 'id: C1\nsource_id: SRC1\nclaim_type: birth\nperson_id: DAD\nevent_id: E_DAD_B\nfamily_id: F1\npage_or_folio: "p. 1"\n');
    write('sources/citations/C2.yml', 'id: C2\nsource_id: SRC1\nclaim_type: birth\nperson_id: MOM\nevent_id: E_MOM_B\npage_or_folio: "p. 2"\n');
    write('sources/citations/C3.yml', 'id: C3\nsource_id: SRC1\nclaim_type: birth\nperson_id: KID\nevent_id: E_KID_B\npage_or_folio: "p. 3"\n');
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

});

describe('parents_next_step', () => {
  const nextStepMsgs = (rootId?: string) =>
    loadAndValidateDataset(dir, { rootId }).warnings.filter((w) => w.field === 'parents_next_step');
  const filesOf = (ws: { filePath: string }[]) => ws.map((w) => path.basename(w.filePath)).sort();

  it('con padre e madre già collegati il testo non compare da nessuna parte: avviso', () => {
    baseFamily();
    person('KID', 'sex: male\nbirth_event_id: E_KID_B\nparents_next_step: "Cercare i genitori"\n');
    const ws = nextStepMsgs();
    expect(ws.map((w) => w.message)).toEqual([expect.stringMatching(/ha già i genitori documentati \(DAD Test e MOM Test\)/)]);
    expect(runValidateCommand({ dataDir: dir, silent: true, strict: true })).toBe(1);
  });

  it('con un solo genitore il testo compare nella scheda persona: nessun avviso', () => {
    baseFamily();
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD]\nchildren_ids: [KID]\n');
    person('KID', 'sex: male\nbirth_event_id: E_KID_B\nparents_next_step: "Cercare la madre"\n');
    expect(nextStepMsgs()).toEqual([]);
  });

  it('due genitori senza sesso su un antenato diretto: l\'albero mostra il "?", nessun avviso sul testo', () => {
    baseFamily();
    person('DAD', 'birth_event_id: E_DAD_B\nparents_next_step: "x"\n');
    person('MOM', 'birth_event_id: E_MOM_B\nparents_next_step: "x"\n');
    person('KID', 'sex: male\nbirth_event_id: E_KID_B\nparents_next_step: "Capire chi è il padre"\n');
    person('ROOT', 'sex: male\n');
    write('families/F2.yml', 'id: F2\npartner_ids: [KID]\nchildren_ids: [ROOT]\n');
    expect(nextStepMsgs('ROOT')).toEqual([]);
    // Fuori dalla linea diretta lo stesso testo non compare: avviso
    expect(filesOf(nextStepMsgs())).toEqual(['KID.yml']);
  });

  it('antenati diretti senza genitori e senza testo: avviso, che sparisce compilando il testo', () => {
    baseFamily();
    const ws = nextStepMsgs('KID');
    expect(filesOf(ws)).toEqual(['DAD.yml', 'MOM.yml']);
    expect(ws[0].message).toMatch(/senza padre e madre e senza parents_next_step/);

    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\nparents_next_step: "Cercare i genitori"\n');
    person('MOM', 'sex: female\nbirth_event_id: E_MOM_B\nparents_next_step: "Cercare i genitori"\n');
    expect(nextStepMsgs('KID')).toEqual([]);
  });

  it('antenato a cui manca solo un genitore: lo dice nel messaggio', () => {
    baseFamily();
    person('GPA', 'sex: male\nparents_next_step: "x"\n');
    write('families/F0.yml', 'id: F0\npartner_ids: [GPA]\nchildren_ids: [DAD]\n');
    const dad = nextStepMsgs('KID').find((w) => w.filePath.endsWith('DAD.yml'));
    expect(dad?.message).toMatch(/senza la madre/);
  });

  it('la radice non ha il segnaposto "?": nessun avviso se le mancano i genitori', () => {
    person('ROOT', 'sex: male\n');
    expect(nextStepMsgs('ROOT')).toEqual([]);
  });

  it('il coniuge con cui la radice ha figli è linea diretta, come nell\'albero', () => {
    person('ROOT', 'sex: male\nparents_next_step: "x"\n');
    person('SPOUSE', 'sex: female\n');
    person('CHILD', 'sex: female\n');
    write('families/F1.yml', 'id: F1\npartner_ids: [ROOT, SPOUSE]\nchildren_ids: [CHILD]\n');
    expect(filesOf(nextStepMsgs('ROOT'))).toEqual(['SPOUSE.yml']);
  });

  it('persona vivente riservata: niente richiesta di testo, e avviso se lo ha (non viene mostrato)', () => {
    baseFamily();
    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\nprivacy: living-person restricted\n');
    expect(filesOf(nextStepMsgs('KID'))).toEqual(['MOM.yml']);

    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\nprivacy: living-person restricted\nparents_next_step: "x"\n');
    const dad = nextStepMsgs('KID').find((w) => w.filePath.endsWith('DAD.yml'));
    expect(dad?.message).toMatch(/Persona riservata/);
  });

  it('validate legge tree.root_id dal file indicato con --config', () => {
    baseFamily();
    const cfg = path.join(baseDir, 'altrove.yml');
    fs.writeFileSync(cfg, 'tree:\n  root_id: KID\n');
    const strictOk = (configPath?: string) =>
      runValidateCommand({ dataDir: dir, configPath, silent: true, strict: true });
    // Senza configurazione i controlli sugli antenati sono spenti: restano solo gli altri avvisi
    const others = loadAndValidateDataset(dir).warnings.length;
    expect(loadAndValidateDataset(dir, { rootId: 'KID' }).warnings.length).toBe(others + 2);
    expect(strictOk(cfg)).toBe(1);
    // Radice inesistente nel dataset: i controlli sugli antenati restano spenti
    fs.writeFileSync(cfg, 'tree:\n  root_id: NESSUNO\n');
    expect(loadAndValidateDataset(dir, { rootId: 'NESSUNO' }).warnings.length).toBe(others);
  });

  it('configurazione non valida o mancante (se indicata): validate fallisce', () => {
    baseFamily();
    const cfg = path.join(baseDir, 'rotta.yml');
    fs.writeFileSync(cfg, 'tree: [non, valido\n');
    expect(runValidateCommand({ dataDir: dir, configPath: cfg, silent: true })).toBe(1);
    expect(runValidateCommand({ dataDir: dir, configPath: path.join(baseDir, 'manca.yml'), silent: true })).toBe(1);
  });
});

describe('Nuovi controlli di qualità e coerenza genealogica', () => {
  it('battesimo antecedente alla nascita', () => {
    baseFamily();
    write('events/E_KID_BAPT.yml', 'id: E_KID_BAPT\nevent_type: baptism\nperson_ids: [KID]\ndate:\n  precision: exact\n  year: 1879\n  month: 5\n  day: 1\n');
    write('events/E_KID_B.yml', 'id: E_KID_B\nevent_type: birth\nperson_ids: [KID]\ndate:\n  precision: exact\n  year: 1880\n  month: 5\n  day: 1\n');
    expect(messages()).toContainEqual(expect.stringMatching(/Battesimo antecedente alla nascita/));
  });

  it('eventi vitali attivi dopo la morte', () => {
    baseFamily();
    person('KID', 'sex: male\nbirth_event_id: E_KID_B\ndeath_event_id: E_KID_D\n');
    event('E_KID_D', 'death', 'KID', 1900);
    event('E_KID_RES', 'residence', 'KID', 1910);
    expect(messages()).toContainEqual(expect.stringMatching(/si svolge dopo la morte/));
  });

  it('eventi vitali prima della nascita', () => {
    baseFamily();
    event('E_KID_MIL', 'military_service', 'KID', 1870);
    expect(messages()).toContainEqual(expect.stringMatching(/si svolge prima della nascita/));
  });

  it('inversione fine e inizio unione', () => {
    baseFamily();
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID]\nstart_event_id: E_MAR\nend_event_id: E_DIV\n');
    write('events/E_MAR.yml', 'id: E_MAR\nevent_type: marriage\nfamily_id: F1\ndate:\n  precision: year_only\n  year: 1875\n');
    write('events/E_DIV.yml', 'id: E_DIV\nevent_type: divorce\nfamily_id: F1\ndate:\n  precision: year_only\n  year: 1870\n');
    expect(messages()).toContainEqual(expect.stringMatching(/fine unione.*precedente.*inizio/));
  });

  it('intervallo intergenesico anomalo tra figli della stessa madre', () => {
    baseFamily();
    person('KID2', 'sex: female\nbirth_event_id: E_KID2_B\n');
    write('events/E_KID_B.yml', 'id: E_KID_B\nevent_type: birth\nperson_ids: [KID]\ndate:\n  precision: exact\n  year: 1880\n  month: 1\n  day: 1\n');
    write('events/E_KID2_B.yml', 'id: E_KID2_B\nevent_type: birth\nperson_ids: [KID2]\ndate:\n  precision: exact\n  year: 1880\n  month: 5\n  day: 1\n');
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID, KID2]\n');
    expect(messages()).toContainEqual(expect.stringMatching(/Intervallo intergenesico anomalo/));
  });

  it('gemelli nati lo stesso giorno: nessun avviso di intervallo anomalo', () => {
    baseFamily();
    person('KID2', 'sex: female\nbirth_event_id: E_KID2_B\n');
    write('events/E_KID_B.yml', 'id: E_KID_B\nevent_type: birth\nperson_ids: [KID]\ndate:\n  precision: exact\n  year: 1880\n  month: 5\n  day: 1\n');
    write('events/E_KID2_B.yml', 'id: E_KID2_B\nevent_type: birth\nperson_ids: [KID2]\ndate:\n  precision: exact\n  year: 1880\n  month: 5\n  day: 1\n');
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID, KID2]\n');
    expect(messages().filter((m) => m.includes('Intervallo intergenesico'))).toEqual([]);
  });

  it('seconde nozze senza data di morte del primo coniuge non generano avviso di bigamia', () => {
    baseFamily();
    person('WIFE2', 'sex: female\n');
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID]\nstart_event_id: E_MAR1\n');
    write('families/F2.yml', 'id: F2\npartner_ids: [DAD, WIFE2]\nstart_event_id: E_MAR2\n');
    write('events/E_MAR1.yml', 'id: E_MAR1\nevent_type: marriage\nfamily_id: F1\ndate:\n  precision: year_only\n  year: 1870\n');
    write('events/E_MAR2.yml', 'id: E_MAR2\nevent_type: marriage\nfamily_id: F2\ndate:\n  precision: year_only\n  year: 1885\n');
    expect(messages().filter((m) => m.includes('bigamia') || m.includes('sovrapposta'))).toEqual([]);
  });

  it('seconde nozze con primo coniuge deceduto dopo il secondo matrimonio generano avviso di bigamia', () => {
    baseFamily();
    person('WIFE2', 'sex: female\n');
    person('MOM', 'sex: female\ndeath_event_id: E_MOM_D\n');
    event('E_MOM_D', 'death', 'MOM', 1890); // MOM muore nel 1890
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nchildren_ids: [KID]\nstart_event_id: E_MAR1\n');
    write('families/F2.yml', 'id: F2\npartner_ids: [DAD, WIFE2]\nstart_event_id: E_MAR2\n');
    write('events/E_MAR1.yml', 'id: E_MAR1\nevent_type: marriage\nfamily_id: F1\ndate:\n  precision: year_only\n  year: 1870\n');
    write('events/E_MAR2.yml', 'id: E_MAR2\nevent_type: marriage\nfamily_id: F2\ndate:\n  precision: year_only\n  year: 1885\n'); // DAD si risposa nel 1885
    expect(messages()).toContainEqual(expect.stringMatching(/Possibile unione sovrapposta o bigamia/));
  });

  it('eventi postumi fisiologici (will, probate, burial) non generano avviso dopo la morte', () => {
    baseFamily();
    person('KID', 'sex: male\nbirth_event_id: E_KID_B\ndeath_event_id: E_KID_D\n');
    event('E_KID_D', 'death', 'KID', 1900);
    write('events/E_KID_WILL.yml', 'id: E_KID_WILL\nevent_type: will\nperson_ids: [KID]\ndate:\n  precision: year_only\n  year: 1901\n');
    expect(messages().filter((m) => m.includes('si svolge dopo la morte'))).toEqual([]);
  });

  it('paternità in età avanzata tra 65 e 75 anni', () => {
    baseFamily();
    event('E_DAD_B', 'birth', 'DAD', 1810); // padre 70enne alla nascita di KID nel 1880
    expect(messages()).toContainEqual(expect.stringMatching(/paternità in età avanzata/));
  });

  it('persona centenaria marcata living-person restricted genera avviso di incoerenza privacy', () => {
    baseFamily();
    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\nprivacy: living-person restricted\n');
    event('E_DAD_B', 'birth', 'DAD', 1850);
    const res = loadAndValidateDataset(dir);
    expect(res.warnings).toContainEqual(expect.objectContaining({
      message: expect.stringMatching(/non può essere considerata vivente/),
    }));
  });

  it('persona con evento di morte ma marcata living-person restricted genera avviso', () => {
    baseFamily();
    person('DAD', 'sex: male\nbirth_event_id: E_DAD_B\ndeath_event_id: E_DAD_D\nprivacy: living-person restricted\n');
    event('E_DAD_B', 'birth', 'DAD', 1950);
    event('E_DAD_D', 'death', 'DAD', 2020);
    expect(messages()).toContainEqual(expect.stringMatching(/con evento di morte\/sepoltura.*marcata 'living-person restricted'/));
  });

  it('persona storica nata oltre 110 anni fa senza evento di morte non genera avviso se non marcata vivente', () => {
    baseFamily();
    person('ANC', 'sex: male\nbirth_event_id: E_ANC_B\n');
    event('E_ANC_B', 'birth', 'ANC', 1880);
    expect(messages().filter((m) => m.includes('vivente') || m.includes('presunzione'))).toEqual([]);
  });

  it('end_event_id con tipo evento inatteso genera avviso', () => {
    baseFamily();
    write('families/F1.yml', 'id: F1\npartner_ids: [DAD, MOM]\nstart_event_id: E_MAR\nend_event_id: E_WRONG\n');
    write('events/E_MAR.yml', 'id: E_MAR\nevent_type: marriage\nfamily_id: F1\ndate:\n  precision: year_only\n  year: 1870\n');
    write('events/E_WRONG.yml', 'id: E_WRONG\nevent_type: birth\nfamily_id: F1\ndate:\n  precision: year_only\n  year: 1875\n');
    expect(messages()).toContainEqual(expect.stringMatching(/L'evento 'E_WRONG' è di tipo 'birth', atteso divorce\/annulment\/separation/));
  });

  it('spostamento a velocità impossibile prima del 1920 genera avviso', () => {
    baseFamily();
    write('places/PLC_ROMA.yml', 'id: PLC_ROMA\nname: Roma\nlatitude: 41.9028\nlongitude: 12.4964\n');
    write('places/PLC_MILANO.yml', 'id: PLC_MILANO\nname: Milano\nlatitude: 45.4642\nlongitude: 9.1900\n');
    write('events/E_ROMA.yml', 'id: E_ROMA\nevent_type: residence\nperson_ids: [DAD]\nplace_id: PLC_ROMA\ndate:\n  precision: exact\n  year: 1900\n  month: 5\n  day: 1\n');
    write('events/E_MILANO.yml', 'id: E_MILANO\nevent_type: residence\nperson_ids: [DAD]\nplace_id: PLC_MILANO\ndate:\n  precision: exact\n  year: 1900\n  month: 5\n  day: 2\n');
    expect(messages()).toContainEqual(expect.stringMatching(/Spostamento apparentemente impossibile.*verificare possibile omonimia/));
  });

  it('citazione con person_id di un genitore collegata a un evento di nascita del figlio è valida', () => {
    baseFamily();
    write('sources/SRC1.yml', 'id: SRC1\ntitle: Registro\nsource_type: civil_registry\n');
    write('sources/citations/C1.yml', 'id: C1\nsource_id: SRC1\nclaim_type: father_residence\nperson_id: DAD\nevent_id: E_KID_B\npage_or_folio: "p. 1"\n');
    const res = loadAndValidateDataset(dir);
    expect(res.valid).toBe(true);
  });

  it('ciclo nella gerarchia dei luoghi genera errore bloccante', () => {
    baseFamily();
    write('places/PLC1.yml', 'id: PLC1\nname: Luogo 1\nparent_place_id: PLC2\n');
    write('places/PLC2.yml', 'id: PLC2\nname: Luogo 2\nparent_place_id: PLC1\n');
    const res = loadAndValidateDataset(dir);
    expect(res.valid).toBe(false);
    expect(res.errors[0].message).toMatch(/Ciclo rilevato nella gerarchia dei luoghi/);
  });

  it('riferimenti sconosciuti nel registro ricerche generano errore bloccante', () => {
    baseFamily();
    write('research/registro_ricerche.yml', 'searches:\n  - date: "2026-01-01"\n    goal: "Test"\n    outcome: not_found\n    references: [NON_ESISTE]\n');
    const res = loadAndValidateDataset(dir);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.message.includes("Unknown reference 'NON_ESISTE' in research log"))).toBe(true);
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
