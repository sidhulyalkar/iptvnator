import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { PlaylistsService } from '@iptvnator/services';
import { StalkerStore } from '@iptvnator/portal/stalker/data-access';
import { StalkerLivePlayerFavoriteComponent } from './stalker-live-player-favorite.component';
import type { StalkerLiveFavoriteTarget } from './stalker-live-favorite-target';

const target: StalkerLiveFavoriteTarget = {
    playlistId: 'source-1',
    channelId: '42',
    favoriteId: '42',
    channelName: 'News HD',
    sourceName: 'https://user:secret@portal.example.com/list?password=SECRET',
    item: {
        id: '42',
        cmd: 'ffmpeg https://portal.example.com/live',
        name: 'News HD',
    },
};

describe('StalkerLivePlayerFavoriteComponent', () => {
    let fixture: ComponentFixture<StalkerLivePlayerFavoriteComponent>;
    let store: {
        currentPlaylist: jest.Mock;
        addToFavorites: jest.Mock;
        removeFromFavorites: jest.Mock;
    };
    let playlists: { getPortalFavorites: jest.Mock };
    let saved: string[];
    let confirmed: Array<{ playlistId: string; channelId: string; isFavorite: boolean }>;

    beforeEach(async () => {
        saved = [];
        confirmed = [];
        store = {
            currentPlaylist: jest.fn(() => ({ _id: 'source-1' })),
            addToFavorites: jest.fn((item, done) => {
                saved = [...saved, String(item.id)];
                done();
            }),
            removeFromFavorites: jest.fn((id, done) => {
                saved = saved.filter((entry) => entry !== id);
                done();
            }),
        };
        playlists = {
            getPortalFavorites: jest.fn(() =>
                of(saved.map((id) => ({ id, category_id: 'itv' })))
            ),
        };
        await TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot(), StalkerLivePlayerFavoriteComponent],
            providers: [
                { provide: StalkerStore, useValue: store },
                { provide: PlaylistsService, useValue: playlists },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(StalkerLivePlayerFavoriteComponent);
        fixture.componentInstance.favoriteConfirmed.subscribe((value) =>
            confirmed.push(value)
        );
        fixture.componentRef.setInput('target', target);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    const star = (): HTMLButtonElement =>
        fixture.nativeElement.querySelector(
            '[data-test-id="stalker-live-player-favorite"]'
        );

    it('reads the saved state and publishes only verified add/remove results', async () => {
        expect(star().getAttribute('aria-pressed')).toBe('false');
        expect(star().getAttribute('aria-label')).toContain('portal.example.com');
        expect(star().getAttribute('aria-label')).not.toContain('secret');

        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(store.addToFavorites).toHaveBeenCalledWith(
            expect.objectContaining({ id: '42', category_id: 'itv' }),
            expect.any(Function),
            expect.any(Function)
        );
        expect(star().getAttribute('aria-pressed')).toBe('true');
        expect(confirmed).toEqual([
            {
                playlistId: 'source-1',
                channelId: '42',
                favoriteId: '42',
                isFavorite: true,
            },
        ]);

        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(store.removeFromFavorites).toHaveBeenCalledWith(
            '42',
            expect.any(Function),
            expect.any(Function)
        );
        expect(star().getAttribute('aria-pressed')).toBe('false');
        expect(confirmed.at(-1)?.isFavorite).toBe(false);
    });

    it('removes the durable stream_id when it differs from the playing channel id', async () => {
        saved = ['canonical-99'];
        fixture.componentRef.setInput('target', {
            ...target,
            favoriteId: 'canonical-99',
            item: { ...target.item, stream_id: 'canonical-99' },
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().getAttribute('aria-pressed')).toBe('true');

        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(store.removeFromFavorites).toHaveBeenCalledWith(
            'canonical-99',
            expect.any(Function),
            expect.any(Function)
        );
        expect(star().getAttribute('aria-pressed')).toBe('false');
    });

    it('blocks duplicate writes and discards late responses for a new channel', async () => {
        let acknowledge!: () => void;
        store.addToFavorites.mockImplementationOnce((_item, done) => {
            acknowledge = done;
        });
        star().click();
        fixture.detectChanges();
        expect(star().disabled).toBe(true);
        star().click();
        expect(store.addToFavorites).toHaveBeenCalledTimes(1);

        fixture.componentRef.setInput('target', {
            ...target,
            channelId: '43',
            channelName: 'Next Channel',
            item: { ...target.item, id: '43' },
        });
        fixture.detectChanges();
        acknowledge();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().getAttribute('aria-label')).toContain('Next Channel');
        expect(confirmed).toEqual([]);
    });

    it('offers read-only Retry when a portal write rejects', async () => {
        store.addToFavorites.mockImplementationOnce((_item, _done, fail) => {
            fail();
        });
        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().getAttribute('aria-pressed')).toBeNull();
        expect(star().querySelector('mat-icon')?.textContent).toContain(
            'refresh'
        );
        expect(star().disabled).toBe(false);
        expect(confirmed).toEqual([]);

        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(store.addToFavorites).toHaveBeenCalledTimes(1);
        expect(star().getAttribute('aria-pressed')).toBe('false');
    });

    it('recovers an unavailable initial status through a read-only Retry', async () => {
        playlists.getPortalFavorites.mockReturnValueOnce(
            throwError(() => new Error('status unavailable'))
        );
        fixture.componentRef.setInput('target', {
            ...target,
            channelId: '99',
            item: { ...target.item, id: '99' },
        });
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().getAttribute('aria-pressed')).toBeNull();
        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().getAttribute('aria-pressed')).toBe('false');
        expect(store.addToFavorites).not.toHaveBeenCalled();
    });

    it('does not mutate another playlist when the store owner changes', () => {
        store.currentPlaylist.mockReturnValueOnce({ _id: 'other' });
        star().click();
        expect(store.addToFavorites).not.toHaveBeenCalled();
        expect(store.removeFromFavorites).not.toHaveBeenCalled();
    });
});
