import { describe, it, expect } from 'vitest';
import { SourceSchema } from '../../src/model/source.js';
import { SourceCitationSchema } from '../../src/model/citation.js';

describe('Source & SourceCitation Schemas', () => {
  it('validates a valid archival source', () => {
    const src = SourceSchema.parse({
      id: 'SRC001',
      title: 'Parish Register of St. Mary, Warwick',
      source_type: 'parish_register',
      repository: 'Warwickshire County Record Office',
      call_number: 'DR 45/1',
      transcription: 'Baptized: Thomas, son of William and Mary Doe, 15 April 1875.',
      reliability: 'high',
    });
    expect(src.id).toBe('SRC001');
    expect(src.source_type).toBe('parish_register');
    expect(src.call_number).toBe('DR 45/1');
  });

  it('validates a citation linked to an event and source', () => {
    const cit = SourceCitationSchema.parse({
      id: 'CIT001',
      source_id: 'SRC001',
      claim_type: 'birth_date',
      event_id: 'EVT001',
      page_or_folio: 'p. 14, entry 5',
      quoted_text: 'Thomas, son of William and Mary Doe',
      evidence_type: 'primary',
      assessment: 'supports',
    });
    expect(cit.id).toBe('CIT001');
    expect(cit.source_id).toBe('SRC001');
    expect(cit.evidence_type).toBe('primary');
  });

  it('rejects source with missing required title', () => {
    expect(() =>
      SourceSchema.parse({
        id: 'SRC002',
        source_type: 'census',
      })
    ).toThrow();
  });
});
