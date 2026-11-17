import Database from 'better-sqlite3';
import {
    EPG_FTS_INTEGRITY_KEY,
    EPG_FTS_INTEGRITY_VALUE,
    ensureEpgFtsIndex,
} from './epg-fts-integrity';

function fixture(): Database.Database {
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE app_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT
        );
        CREATE TABLE epg_programs (
            id INTEGER PRIMARY KEY,
            title TEXT,
            description TEXT,
            category TEXT
        );
        CREATE VIRTUAL TABLE epg_programs_fts USING fts5(
            title, description, category,
            content='epg_programs', content_rowid='id'
        );
        CREATE TRIGGER epg_programs_ai AFTER INSERT ON epg_programs BEGIN
            INSERT INTO epg_programs_fts(rowid, title, description, category)
            VALUES(new.id, new.title, new.description, new.category);
        END;
        CREATE TRIGGER epg_programs_ad AFTER DELETE ON epg_programs BEGIN
            INSERT INTO epg_programs_fts(
                epg_programs_fts,rowid,title,description,category
            ) VALUES('delete',old.id,old.title,old.description,old.category);
        END;
        CREATE TRIGGER epg_programs_au AFTER UPDATE ON epg_programs BEGIN
            INSERT INTO epg_programs_fts(
                epg_programs_fts,rowid,title,description,category
            ) VALUES('delete',old.id,old.title,old.description,old.category);
            INSERT INTO epg_programs_fts(rowid,title,description,category)
            VALUES(new.id,new.title,new.description,new.category);
        END;
    `);
    return db;
}

function hits(db: Database.Database, term: string): number[] {
    return (db.prepare(
        'SELECT rowid FROM epg_programs_fts ' +
        'WHERE epg_programs_fts MATCH ?'
    ).all(term) as Array<{ rowid: number }>).map((x) => x.rowid);
}

describe('EPG FTS external-content integrity', () => {
    let db: Database.Database;
    beforeEach(() => { db = fixture(); });
    afterEach(() => db.close());

    it('repairs pre-FTS historical rows, then verifies and durably stamps', () => {
        db.exec(`
            DROP TRIGGER epg_programs_ai;
            INSERT INTO epg_programs (id,title,category)
            VALUES(1,'Packers earlier','sports');
            CREATE TRIGGER epg_programs_ai AFTER INSERT ON epg_programs BEGIN
                INSERT INTO epg_programs_fts(rowid,title,description,category)
                VALUES(new.id,new.title,new.description,new.category);
            END;
            INSERT INTO epg_programs (id,title,category)
            VALUES(2,'Packers later','sports');
        `);
        expect(hits(db, 'Packers')).toEqual([2]);
        expect(ensureEpgFtsIndex(db)).toBe('rebuilt');
        expect(hits(db, 'Packers')).toEqual([1, 2]);
        expect(db.prepare('SELECT value FROM app_state WHERE key = ?')
            .get(EPG_FTS_INTEGRITY_KEY)).toEqual({
                value: EPG_FTS_INTEGRITY_VALUE,
            });
        expect(ensureEpgFtsIndex(db)).toBe('already-verified');
    });

    it('stamps an already complete index without rebuilding', () => {
        db.prepare(
            "INSERT INTO epg_programs (id,title) VALUES (1,'NHL game')"
        ).run();
        expect(ensureEpgFtsIndex(db)).toBe('verified');
        expect(hits(db, 'NHL')).toEqual([1]);
    });

    it('does not create the trusted marker when FTS repair cannot succeed', () => {
        db.exec('DROP TABLE epg_programs_fts;');
        expect(() => ensureEpgFtsIndex(db)).toThrow();
        expect(db.prepare('SELECT value FROM app_state WHERE key = ?')
            .get(EPG_FTS_INTEGRITY_KEY)).toBeUndefined();
    });

    it('refuses to mark the index trusted if a maintenance trigger is missing', () => {
        db.exec('DROP TRIGGER epg_programs_au;');
        expect(() => ensureEpgFtsIndex(db))
            .toThrow('EPG FTS change triggers are incomplete');
        expect(db.prepare('SELECT value FROM app_state WHERE key = ?')
            .get(EPG_FTS_INTEGRITY_KEY)).toBeUndefined();
    });

    it('preserves the trusted index across trigger-managed inserts', () => {
        db.prepare(
            "INSERT INTO epg_programs (id,title) VALUES (1,'NBA one')"
        ).run();
        expect(ensureEpgFtsIndex(db)).toBe('verified');
        db.prepare(
            "INSERT INTO epg_programs (id,title) VALUES (2,'NBA two')"
        ).run();
        expect(hits(db, 'NBA')).toEqual([1,2]);
    });
});
