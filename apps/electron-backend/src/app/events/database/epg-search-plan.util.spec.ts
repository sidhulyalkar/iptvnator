import { planEpgSearch } from './epg-search-plan.util';

describe('planEpgSearch', () => {
    it('quotes tokenized multiword queries for safe FTS matching', () => {
        expect(planEpgSearch('Packers vs Panthers', 20)).toEqual({
            ftsQuery: '"Packers" AND "vs" AND "Panthers"',
            likePattern: '%Packers vs Panthers%',
            limit: 20,
        });
    });

    it('preserves Unicode words and falls back for short tokens', () => {
        expect(planEpgSearch('Новости', 10)?.ftsQuery).toBe('"Новости"');
        expect(planEpgSearch('C++', 10)?.ftsQuery).toBeNull();
        expect(planEpgSearch('a', 10)?.ftsQuery).toBeNull();
    });

    it('escapes LIKE metacharacters without allowing broad wildcard queries', () => {
        expect(planEpgSearch('news_%\\', 10)?.likePattern)
            .toBe('%news\\_\\%\\\\%');
        expect(planEpgSearch('"NFL" OR *', 10)?.ftsQuery)
            .toBe('"NFL" AND "OR"');
    });

    it('bounds limits and refuses invalid or excessive IPC input', () => {
        expect(planEpgSearch('NFL', 900)?.limit).toBe(100);
        expect(planEpgSearch('NFL', -10)?.limit).toBe(1);
        expect(planEpgSearch('NFL', Infinity)?.limit).toBe(50);
        expect(planEpgSearch('NFL', '200')?.limit).toBe(50);
        expect(planEpgSearch('x'.repeat(201), 10)).toBeNull();
        expect(planEpgSearch(123, 10)).toBeNull();
        expect(planEpgSearch('  ', 10)).toBeNull();
    });
});
