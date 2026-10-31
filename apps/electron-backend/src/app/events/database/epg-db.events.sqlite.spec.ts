import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const getDatabase = jest.fn();

jest.mock('electron', () => ({
    ipcMain: { handle: jest.fn() },
}));
jest.mock('../../database/connection', () => ({
    getDatabase: (...args: unknown[]) => getDatabase(...args),
}));

type SearchHandler = (
    event: unknown,
    query: unknown,
    limit?: unknown
) => Promise<Array<{ title: string; channel: string; channelName: string | null }>>;

function searchHandler(): SearchHandler {
    const { ipcMain } = jest.requireMock('electron') as {
        ipcMain: { handle: jest.Mock };
    };
    const registration = (ipcMain.handle.mock.calls as Array<
        [string, SearchHandler]
    >).find(([channel]) => channel === 'EPG_DB_SEARCH_PROGRAMS');
    if (!registration) throw new Error('EPG search handler not registered');
    return registration[1];
}

function populateFixture(db: Database.Database): void {
    db.exec(`
        CREATE TABLE epg_channels (id TEXT PRIMARY KEY, display_name TEXT);
        CREATE TABLE epg_programs (
            id INTEGER PRIMARY KEY,
            channel_id TEXT,
            start TEXT,
            stop TEXT,
            title TEXT,
            description TEXT,
            category TEXT,
            icon_url TEXT,
            rating TEXT,
            episode_num TEXT
        );
        CREATE VIRTUAL TABLE epg_programs_fts USING fts5(
            title, description, category,
            content='epg_programs', content_rowid='id'
        );
        CREATE TRIGGER epg_programs_ai AFTER INSERT ON epg_programs BEGIN
            INSERT INTO epg_programs_fts(rowid,title,description,category)
            VALUES(new.id,new.title,new.description,new.category);
        END;
        INSERT INTO epg_channels(id,display_name)
            VALUES ('gridiron.example','Gridiron One'), ('archive.example','Archive One');
    `);
}

function add(
    db: Database.Database,
    title: string,
    start: string,
    stop: string,
    channel = 'gridiron.example',
    description = 'Synthetic sports programme'
): void {
    db.prepare(
        `INSERT INTO epg_programs
         (channel_id,start,stop,title,description,category)
         VALUES(?,?,?,?,?,?)`
    ).run(channel,start,stop,title,description,'Sports');
}

describe('EPG ranked search using real SQLite/FTS5', () => {
    let db: Database.Database;
    let search: SearchHandler;

    beforeEach(async () => {
        jest.resetModules();
        jest.useFakeTimers().setSystemTime(new Date('2026-10-31T18:30:00Z'));
        getDatabase.mockReset();
        const { ipcMain } = jest.requireMock('electron') as {
            ipcMain: { handle: jest.Mock };
        };
        ipcMain.handle.mockClear();

        db = new Database(':memory:');
        populateFixture(db);
        getDatabase.mockResolvedValue(drizzle(db));
        await import('./epg-db.events');
        search = searchHandler();
    });

    afterEach(() => {
        db.close();
        jest.useRealTimers();
    });

    it('places currently airing before imminent future and recent archive entries', async () => {
        add(db,'NFL Archive','2026-10-20T18:00:00Z','2026-10-20T21:00:00Z','archive.example');
        add(db,'NFL Tomorrow','2026-11-01T18:00:00Z','2026-11-01T21:00:00Z');
        add(db,'NFL Live','2026-10-31T18:00:00Z','2026-10-31T21:00:00Z');

        const hits = await search({},'NFL',20);
        expect(hits.map((h) => h.title)).toEqual([
            'NFL Live','NFL Tomorrow','NFL Archive',
        ]);
        expect(hits[0]).toMatchObject({
            channel: 'gridiron.example',
            channelName: 'Gridiron One',
        });
    });

    it('normalizes ISO offsets when deciding what is airing', async () => {
        add(db,'NFL UTC','2026-10-31T18:00:00Z','2026-10-31T21:00:00Z');
        add(db,'NFL Offset','2026-10-31T11:00:00-07:00','2026-10-31T14:00:00-07:00');

        const hits = await search({},'NFL',20);
        expect(hits).toHaveLength(2);
        expect(hits.map((hit) => hit.title).sort()).toEqual(['NFL Offset','NFL UTC']);
    });

    it('finds partial titles using literal LIKE when FTS has no matching token', async () => {
        add(db,'Panthers Live','2026-10-31T18:00:00Z','2026-10-31T21:00:00Z');
        expect((await search({},'anther',20)).map((h) => h.title))
            .toEqual(['Panthers Live']);
    });

    it('does not let LIKE wildcards broaden a literal search', async () => {
        add(db,'Test_100%','2026-10-31T18:00:00Z','2026-10-31T21:00:00Z');
        add(db,'TestX1000','2026-10-31T18:00:00Z','2026-10-31T21:00:00Z');
        expect((await search({},'Test_100%',20)).map((h) => h.title))
            .toEqual(['Test_100%']);
    });

    it('keeps search available when an older database lacks the FTS table', async () => {
        add(db,'NFL Record','2026-10-31T18:00:00Z','2026-10-31T21:00:00Z');
        db.exec('DROP TRIGGER epg_programs_ai; DROP TABLE epg_programs_fts;');
        expect((await search({},'NFL',20)).map((h) => h.title))
            .toEqual(['NFL Record']);
    });

    it('does not expose results from unrelated searches or return unbounded rows', async () => {
        for (let i=0;i<130;i++) {
            add(db,'NFL '+i,'2026-11-01T18:00:00Z','2026-11-01T21:00:00Z');
        }
        expect(await search({},'NFL',5)).toHaveLength(5);
        expect(await search({},'NFL',100000)).toHaveLength(100);
        expect(await search({},'')).toEqual([]);
        expect(await search({},'NFL'.repeat(1000))).toEqual([]);
    });
});
