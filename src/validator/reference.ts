export interface ValidationError {
  filePath: string;
  field: string;
  message: string;
}

export interface DatasetIndex {
  people: Map<string, { data: any; filePath: string }>;
  families: Map<string, { data: any; filePath: string }>;
  relationships: Map<string, { data: any; filePath: string }>;
  events: Map<string, { data: any; filePath: string }>;
  places: Map<string, { data: any; filePath: string }>;
  sources: Map<string, { data: any; filePath: string }>;
  citations: Map<string, { data: any; filePath: string }>;
  media: Map<string, { data: any; filePath: string }>;
}

export function validateReferences(dataset: DatasetIndex): ValidationError[] {
  const errors: ValidationError[] = [];

  const checkExists = (
    targetMap: Map<string, any>,
    targetCategory: string,
    id: string | undefined | null,
    sourceFile: string,
    field: string
  ) => {
    if (!id) return;
    if (!targetMap.has(id)) {
      errors.push({
        filePath: sourceFile,
        field,
        message: `Referenced ${targetCategory} '${id}' does not exist.`,
      });
    }
  };

  // 1. Validate People
  for (const [id, item] of dataset.people.entries()) {
    const p = item.data;
    const file = item.filePath;
    checkExists(dataset.events, 'event', p.birth_event_id, file, 'birth_event_id');
    checkExists(dataset.events, 'event', p.death_event_id, file, 'death_event_id');
    checkExists(dataset.events, 'event', p.burial_event_id, file, 'burial_event_id');

    if (Array.isArray(p.media_ids)) {
      p.media_ids.forEach((mId: string, idx: number) => {
        checkExists(dataset.media, 'media', mId, file, `media_ids[${idx}]`);
      });
    }
    if (Array.isArray(p.source_citation_ids)) {
      p.source_citation_ids.forEach((cId: string, idx: number) => {
        checkExists(dataset.citations, 'source_citation', cId, file, `source_citation_ids[${idx}]`);
      });
    }
  }

  // 2. Validate Families
  for (const [id, item] of dataset.families.entries()) {
    const fam = item.data;
    const file = item.filePath;

    if (Array.isArray(fam.partner_ids)) {
      fam.partner_ids.forEach((pId: string, idx: number) => {
        checkExists(dataset.people, 'person', pId, file, `partner_ids[${idx}]`);
      });
    }

    if (Array.isArray(fam.children_ids)) {
      fam.children_ids.forEach((cId: string, idx: number) => {
        checkExists(dataset.people, 'person', cId, file, `children_ids[${idx}]`);
        if (fam.partner_ids?.includes(cId)) {
          errors.push({
            filePath: file,
            field: `children_ids[${idx}]`,
            message: `Person '${cId}' cannot be both partner and child in family '${id}'.`,
          });
        }
      });
    }

    checkExists(dataset.events, 'event', fam.start_event_id, file, 'start_event_id');
    checkExists(dataset.events, 'event', fam.end_event_id, file, 'end_event_id');
  }

  // 3. Validate Relationships
  for (const [id, item] of dataset.relationships.entries()) {
    const rel = item.data;
    const file = item.filePath;

    checkExists(dataset.people, 'person', rel.person_id, file, 'person_id');
    checkExists(dataset.people, 'person', rel.related_person_id, file, 'related_person_id');

    if (rel.person_id && rel.person_id === rel.related_person_id) {
      errors.push({
        filePath: file,
        field: 'related_person_id',
        message: `Self-reference: Person '${rel.person_id}' cannot have a relationship with themselves.`,
      });
    }

    checkExists(dataset.families, 'family', rel.family_id, file, 'family_id');
    checkExists(dataset.events, 'event', rel.start_event_id, file, 'start_event_id');
    checkExists(dataset.events, 'event', rel.end_event_id, file, 'end_event_id');
  }

  // 4. Validate Events
  for (const [id, item] of dataset.events.entries()) {
    const evt = item.data;
    const file = item.filePath;

    if (Array.isArray(evt.person_ids)) {
      evt.person_ids.forEach((pId: string, idx: number) => {
        checkExists(dataset.people, 'person', pId, file, `person_ids[${idx}]`);
      });
    }

    checkExists(dataset.families, 'family', evt.family_id, file, 'family_id');
    checkExists(dataset.places, 'place', evt.place_id, file, 'place_id');
  }

  // 5. Validate Places
  for (const [id, item] of dataset.places.entries()) {
    const plc = item.data;
    const file = item.filePath;

    if (plc.parent_place_id === id) {
      errors.push({
        filePath: file,
        field: 'parent_place_id',
        message: `Self-reference: Place '${id}' cannot be its own parent place.`,
      });
    }

    checkExists(dataset.places, 'place', plc.parent_place_id, file, 'parent_place_id');
  }

  // 6. Validate Citations
  for (const [id, item] of dataset.citations.entries()) {
    const cit = item.data;
    const file = item.filePath;

    checkExists(dataset.sources, 'source', cit.source_id, file, 'source_id');
    checkExists(dataset.people, 'person', cit.person_id, file, 'person_id');
    checkExists(dataset.events, 'event', cit.event_id, file, 'event_id');
    checkExists(dataset.relationships, 'relationship', cit.relationship_id, file, 'relationship_id');
    checkExists(dataset.families, 'family', cit.family_id, file, 'family_id');

    if (cit.family_id && cit.event_id && dataset.events.has(cit.event_id)) {
      const evt = dataset.events.get(cit.event_id)!.data;
      if (evt.family_id && evt.family_id !== cit.family_id) {
        errors.push({
          filePath: file,
          field: 'family_id',
          message: `Citazione '${id}' riferisce family_id '${cit.family_id}' ed event_id '${cit.event_id}', ma l'evento appartiene alla famiglia '${evt.family_id}'.`,
        });
      }
    }
  }

  // 7. Validate Media
  for (const [id, item] of dataset.media.entries()) {
    const med = item.data;
    const file = item.filePath;

    checkExists(dataset.sources, 'source', med.source_id, file, 'source_id');
    if (Array.isArray(med.person_ids)) {
      med.person_ids.forEach((pId: string, idx: number) => {
        checkExists(dataset.people, 'person', pId, file, `person_ids[${idx}]`);
      });
    }
    if (Array.isArray(med.event_ids)) {
      med.event_ids.forEach((eId: string, idx: number) => {
        checkExists(dataset.events, 'event', eId, file, `event_ids[${idx}]`);
      });
    }
  }

  return errors;
}
