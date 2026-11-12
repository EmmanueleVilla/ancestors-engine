import { discoverEntityFiles, DiscoveredFile } from '../parser/discover.js';
import { parseYamlFile } from '../parser/yaml.js';
import { PersonSchema, Person } from '../model/person.js';
import { FamilySchema, Family } from '../model/family.js';
import { RelationshipSchema, Relationship } from '../model/relationship.js';
import { EventSchema, Event } from '../model/event.js';
import { PlaceSchema, Place } from '../model/place.js';
import { SourceSchema, Source } from '../model/source.js';
import { SourceCitationSchema, SourceCitation } from '../model/citation.js';
import { MediaSchema, Media } from '../model/media.js';
import { ResearchLogSchema, ResearchEntry } from '../model/research.js';
import { scanDirectoryRecursive } from '../parser/discover.js';
import path from 'node:path';
import fs from 'node:fs';
import { deriveRelationships } from './derive.js';
import { validateReferences, DatasetIndex, ValidationError } from './reference.js';
import { detectKinshipCycles } from './cycle.js';
import { checkConsistency } from './consistency.js';
import { loadArchiveConfig } from '../config/archive.js';

export interface NormalizedDataset {
  people: Map<string, Person>;
  families: Map<string, Family>;
  relationships: Relationship[];
  events: Map<string, Event>;
  places: Map<string, Place>;
  sources: Map<string, Source>;
  citations: Map<string, SourceCitation>;
  media: Map<string, Media>;
  /** Research log entries (data/research/*.yml): where we searched, including negative results. */
  research?: ResearchEntry[];
}

export interface LoadAndValidateResult {
  valid: boolean;
  errors: ValidationError[];
  /** Anomalie da controllare che non bloccano la build (salvo --strict). */
  warnings: ValidationError[];
  cycles: string[];
  dataset?: NormalizedDataset;
  stats: {
    people: number;
    families: number;
    relationships: number;
    derivedRelationships: number;
    events: number;
    places: number;
    sources: number;
    citations: number;
    media: number;
  };
}

export function loadAndValidateDataset(dataDir: string): LoadAndValidateResult {
  const discovered = discoverEntityFiles(dataDir);
  const errors: ValidationError[] = [];

  const index: DatasetIndex = {
    people: new Map(),
    families: new Map(),
    relationships: new Map(),
    events: new Map(),
    places: new Map(),
    sources: new Map(),
    citations: new Map(),
    media: new Map(),
  };

  const schemas: Record<string, any> = {
    people: PersonSchema,
    families: FamilySchema,
    relationships: RelationshipSchema,
    events: EventSchema,
    places: PlaceSchema,
    sources: SourceSchema,
    citations: SourceCitationSchema,
    media: MediaSchema,
  };

  for (const file of discovered) {
    const parseRes = parseYamlFile(file.filePath);
    if (parseRes.error) {
      errors.push({
        filePath: file.filePath,
        field: 'syntax',
        message: `YAML syntax error: ${parseRes.error.message}`,
      });
      continue;
    }

    const data = parseRes.data;
    if (!data || typeof data !== 'object') {
      errors.push({
        filePath: file.filePath,
        field: 'content',
        message: `File content is empty or not a valid YAML mapping.`,
      });
      continue;
    }

    const schema = schemas[file.category];
    if (!schema) continue;

    const validation = schema.safeParse(data);
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        errors.push({
          filePath: file.filePath,
          field: issue.path.join('.') || 'root',
          message: issue.message,
        });
      }
      continue;
    }

    const validData = validation.data;
    const expectedName = path.basename(file.filePath).replace(/\.ya?ml$/i, '');
    if (validData.id !== expectedName) {
      errors.push({
        filePath: file.filePath,
        field: 'id',
        message: `ID '${validData.id}' does not match file name '${expectedName}'.`,
      });
    }
    const targetMap = (index as any)[file.category] as Map<string, { data: any; filePath: string }>;

    if (targetMap.has(validData.id)) {
      errors.push({
        filePath: file.filePath,
        field: 'id',
        message: `Duplicate ID '${validData.id}': already declared in ${targetMap.get(validData.id)!.filePath}`,
      });
    } else {
      targetMap.set(validData.id, { data: validData, filePath: file.filePath });
    }
  }

  // Research log (data/research/*.yml): list of entries under `searches:` (or `ricerche:`)
  const research: ResearchEntry[] = [];
  for (const filePath of scanDirectoryRecursive(path.join(dataDir, 'research'))) {
    const parseRes = parseYamlFile(filePath);
    if (parseRes.error) {
      errors.push({ filePath, field: 'syntax', message: `YAML syntax error: ${parseRes.error.message}` });
      continue;
    }
    const validation = ResearchLogSchema.safeParse(parseRes.data ?? {});
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        errors.push({ filePath, field: issue.path.join('.') || 'root', message: issue.message });
      }
      continue;
    }
    validation.data.searches.forEach((entry, idx) => {
      for (const ref of entry.references) {
        const known =
          index.people.has(ref) || index.families.has(ref) || index.events.has(ref) ||
          index.places.has(ref) || index.sources.has(ref);
        if (!known) {
          errors.push({
            filePath,
            field: `searches[${idx}].references`,
            message: `Unknown reference '${ref}' in research log`,
          });
        }
      }
      for (const medId of entry.media || []) {
        if (!index.media.has(medId)) {
          errors.push({
            filePath,
            field: `searches[${idx}].media`,
            message: `Unknown media '${medId}' in research log`,
          });
        }
      }
      research.push(entry);
    });
  }

  // 1. Validate references
  const refErrors = validateReferences(index);
  errors.push(...refErrors);

  // 2. Derive biological relationships
  const explicitRels = Array.from(index.relationships.values()).map((v) => v.data as Relationship);
  const families = Array.from(index.families.values()).map((v) => v.data as Family);
  const derivedRels = deriveRelationships(families, explicitRels);

  // 3. Cycle detection
  const cycleResult = detectKinshipCycles(derivedRels);
  if (cycleResult.hasCycle) {
    for (const cycle of cycleResult.cycles) {
      errors.push({
        filePath: 'kinship-graph',
        field: 'parent-child',
        message: `Cyclic parentage detected in kinship graph: ${cycle}`,
      });
    }
  }

  // 4. Coerenza (date, età, collegamenti, record orfani)
  let rootId: string | undefined;
  for (const cand of [path.join(path.dirname(dataDir), 'archivio.config.yml'), path.join(dataDir, 'archivio.config.yml')]) {
    if (fs.existsSync(cand)) {
      try {
        const cfg = loadArchiveConfig(cand);
        if (cfg.config.tree?.root_id) {
          rootId = cfg.config.tree.root_id;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  const warnings = errors.length === 0 ? checkConsistency(index, {
    media: research.flatMap((r) => r.media ?? []),
    records: research.flatMap((r) => r.references),
    rootId,
  }) : [];

  const valid = errors.length === 0;

  let dataset: NormalizedDataset | undefined;
  if (valid) {
    dataset = {
      people: new Map(Array.from(index.people.entries()).map(([k, v]) => [k, v.data])),
      families: new Map(Array.from(index.families.entries()).map(([k, v]) => [k, v.data])),
      relationships: derivedRels,
      events: new Map(Array.from(index.events.entries()).map(([k, v]) => [k, v.data])),
      places: new Map(Array.from(index.places.entries()).map(([k, v]) => [k, v.data])),
      sources: new Map(Array.from(index.sources.entries()).map(([k, v]) => [k, v.data])),
      citations: new Map(Array.from(index.citations.entries()).map(([k, v]) => [k, v.data])),
      media: new Map(Array.from(index.media.entries()).map(([k, v]) => [k, v.data])),
      research,
    };
  }

  return {
    valid,
    errors,
    warnings,
    cycles: cycleResult.cycles,
    dataset,
    stats: {
      people: index.people.size,
      families: index.families.size,
      relationships: explicitRels.length,
      derivedRelationships: derivedRels.length - explicitRels.length,
      events: index.events.size,
      places: index.places.size,
      sources: index.sources.size,
      citations: index.citations.size,
      media: index.media.size,
    },
  };
}
