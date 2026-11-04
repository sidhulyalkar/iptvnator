import { filterPortalFavoritesForRemoval } from './stalker-favorite-scoped-remove';

const records = [
    { id: '42', stream_id: '42', category_id: 'itv', name: 'News' },
    { id: '42', movie_id: '42', category_id: 'vod', name: 'Movie' },
    { id: '42', category_id: 'radio', name: 'Radio' },
    { id: '42', category_id: '17', name: 'Legacy ambiguous' },
    { id: '77', category_id: 'itv', name: 'Another channel' },
];

describe('filterPortalFavoritesForRemoval', () => {
    it('removes only a typed ITV favorite despite provider ID collisions', () => {
        const result = filterPortalFavoritesForRemoval(records, '42', 'itv');
        expect(result.removed).toBe(true);
        expect(result.retained.map((item) => item.name)).toEqual([
            'Movie',
            'Radio',
            'Legacy ambiguous',
            'Another channel',
        ]);
    });

    it('removes a radio entry without touching ITV or VOD copies', () => {
        const result = filterPortalFavoritesForRemoval(records, '42', 'radio');
        expect(result.removed).toBe(true);
        expect(result.retained.map((item) => item.name)).toContain('News');
        expect(result.retained.map((item) => item.name)).toContain('Movie');
    });

    it('preserves an untyped favorite when identity is not established', () => {
        const result = filterPortalFavoritesForRemoval(
            [{ id: '42', category_id: '17' }],
            '42',
            'itv'
        );
        expect(result.removed).toBe(false);
        expect(result.retained).toEqual([{ id: '42', category_id: '17' }]);
    });

    it('refuses unscoped deletion when IDs collide across content types', () => {
        const result = filterPortalFavoritesForRemoval(records, '42');
        expect(result.removed).toBe(false);
        expect(result.retained).toEqual(records);
    });

    it('allows a uniquely identifiable legacy deletion', () => {
        const result = filterPortalFavoritesForRemoval(records, '77');
        expect(result.removed).toBe(true);
        expect(result.retained).toEqual(records.slice(0, 4));
    });

    it('does not remove a second ITV favorite with a colliding canonical ID', () => {
        const collision = [
            { id: 'row-A', stream_id: '42', category_id: 'itv' },
            { id: 'row-B', stream_id: '42', category_id: 'itv' },
        ];
        const result = filterPortalFavoritesForRemoval(collision, '42', 'itv');
        expect(result.removed).toBe(false);
        expect(result.retained).toEqual(collision);
    });

    it('prefers canonical stream_id over an alternate catalog row ID', () => {
        const item = { id: '42', stream_id: '99', category_id: 'itv' };
        const wrong = filterPortalFavoritesForRemoval([item], '42', 'itv');
        expect(wrong.removed).toBe(false);
        expect(wrong.retained).toEqual([item]);
        const correct = filterPortalFavoritesForRemoval([item], '99', 'itv');
        expect(correct.removed).toBe(true);
        expect(correct.retained).toEqual([]);
    });

    it('preserves a shared numeric ID in VOD while removing a unique live favorite', () => {
        const collision = [
            { id: '42', movie_id: '42', category_id: 'vod' },
            { id: '42', stream_id: '42', category_id: 'itv' },
        ];
        const result = filterPortalFavoritesForRemoval(collision, '42', 'itv');
        expect(result.removed).toBe(true);
        expect(result.retained).toEqual([collision[0]]);
    });

    it('does not mutate source arrays or remove favorites for a blank ID', () => {
        const result = filterPortalFavoritesForRemoval(records, '   ', 'itv');
        expect(result.retained).toEqual(records);
        expect(result.removed).toBe(false);
        expect(records).toHaveLength(5);
    });
});
