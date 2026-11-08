import { NormalizedDataset } from '../../validator/index.js';
import { getPersonDisplayName } from '../../model/person.js';

export interface SearchIndexRecord {
  id: string;
  display_name: string;
  given_names: string;
  surname: string;
  maiden_name?: string;
  alternative_names?: string[];
  birth_year?: number | null;
  death_year?: number | null;
  places?: string[];
  url: string;
}

export function compileSearchIndex(dataset: NormalizedDataset): SearchIndexRecord[] {
  const records: SearchIndexRecord[] = [];

  for (const person of dataset.people.values()) {
    const isLiving = person.privacy === 'living-person restricted';

    if (isLiving) {
      records.push({
        id: person.id,
        display_name: '[Living]',
        given_names: '',
        surname: '[Living]',
        alternative_names: [],
        birth_year: null,
        death_year: null,
        places: [],
        url: `people/${person.id}.html`,
      });
      continue;
    }

    const birthEvt = person.birth_event_id ? dataset.events.get(person.birth_event_id) : undefined;
    const deathEvt = person.death_event_id ? dataset.events.get(person.death_event_id) : undefined;

    // Find all places associated with this person
    const personPlaces = new Set<string>();
    for (const evt of dataset.events.values()) {
      if (evt.person_ids?.includes(person.id) && evt.place_id) {
        const place = dataset.places.get(evt.place_id);
        if (place) {
          personPlaces.add(place.name);
          if (place.country) personPlaces.add(place.country);
          if (place.administrative_area) personPlaces.add(place.administrative_area);
        }
      }
    }

    records.push({
      id: person.id,
      display_name: getPersonDisplayName(person),
      given_names: person.given_names,
      surname: person.surname,
      maiden_name: person.maiden_name,
      alternative_names: person.alternative_names,
      birth_year: birthEvt?.date?.year || null,
      death_year: deathEvt?.date?.year || null,
      places: Array.from(personPlaces),
      url: `people/${person.id}.html`,
    });
  }

  return records;
}
