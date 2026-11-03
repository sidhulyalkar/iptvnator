import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import {
    FavoritesService,
    XtreamStore,
} from '@iptvnator/portal/xtream/data-access';
import { XtreamFavoriteMarksService } from '../portal-channels-list/xtream-favorite-marks.service';
import { XtreamLivePlayerFavoriteComponent } from './xtream-live-player-favorite.component';
import type { XtreamLiveFavoriteTarget } from './xtream-live-favorite-target';

const news: XtreamLiveFavoriteTarget = {
    playlistId: 'source-1',
    xtreamId: 41,
    channelName: 'News',
    sourceName: 'https://user:secret@provider.test/list?password=secret',
};

describe('XtreamLivePlayerFavoriteComponent', () => {
    let fixture: ComponentFixture<XtreamLivePlayerFavoriteComponent>;
    let favorites: { getFavorites: jest.Mock };
    let store: { toggleFavorite: jest.Mock };
    let marks: XtreamFavoriteMarksService;
    let saved: number[];

    beforeEach(async () => {
        saved = [];
        favorites = {
            getFavorites: jest.fn(() =>
                of(
                    saved.map((xtream_id) => ({
                        xtream_id,
                        type: 'live' as const,
                    }))
                )
            ),
        };
        store = {
            toggleFavorite: jest.fn(async (id: number) => {
                saved = saved.includes(id)
                    ? saved.filter((entry) => entry !== id)
                    : [...saved, id];
                return saved.includes(id);
            }),
        };
        marks = new XtreamFavoriteMarksService();
        await TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot(), XtreamLivePlayerFavoriteComponent],
            providers: [
                { provide: FavoritesService, useValue: favorites },
                { provide: XtreamStore, useValue: store },
                { provide: XtreamFavoriteMarksService, useValue: marks },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(XtreamLivePlayerFavoriteComponent);
        fixture.componentRef.setInput('target', news);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    function star(): HTMLButtonElement {
        const element = fixture.nativeElement.querySelector(
            '[data-test-id="xtream-live-player-favorite"]'
        );
        expect(element).toBeInstanceOf(HTMLButtonElement);
        return element as HTMLButtonElement;
    }

    it('labels its source safely and confirms add/remove from saved favorites', async () => {
        expect(star().getAttribute('aria-pressed')).toBe('false');
        expect(star().getAttribute('aria-label')).toContain('provider.test');
        expect(star().getAttribute('aria-label')).not.toContain('secret');
        const notified: boolean[] = [];
        const subscription = marks.changes$.subscribe((value) =>
            notified.push(value.isFavorite)
        );

        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(store.toggleFavorite).toHaveBeenCalledWith(41, 'source-1', 'live');
        expect(star().getAttribute('aria-pressed')).toBe('true');
        expect(notified).toEqual([true]);

        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().getAttribute('aria-pressed')).toBe('false');
        expect(notified).toEqual([true, false]);
        subscription.unsubscribe();
    });

    it('disables actions during an unresolved write and ignores stale completion', async () => {
        const pending = new Subject<boolean>();
        store.toggleFavorite.mockReturnValueOnce(
            new Promise<boolean>((resolve) => {
                pending.subscribe(resolve);
            })
        );
        const notified: string[] = [];
        const subscription = marks.changes$.subscribe((change) =>
            notified.push(change.key)
        );

        star().click();
        fixture.detectChanges();
        expect(star().disabled).toBe(true);
        star().click();
        expect(store.toggleFavorite).toHaveBeenCalledTimes(1);

        fixture.componentRef.setInput('target', {
            ...news,
            xtreamId: 99,
            channelName: 'Another Channel',
        });
        fixture.detectChanges();
        pending.next(true);
        pending.complete();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().getAttribute('aria-label')).toContain('Another Channel');
        expect(notified).toEqual([]);
        subscription.unsubscribe();
    });

    it('never publishes an unverified state after a rejected save', async () => {
        store.toggleFavorite.mockRejectedValueOnce(new Error('secret'));
        const notified: unknown[] = [];
        const subscription = marks.changes$.subscribe((change) =>
            notified.push(change)
        );

        star().click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(star().disabled).toBe(true);
        expect(star().getAttribute('aria-pressed')).toBeNull();
        expect(notified).toEqual([]);
        subscription.unsubscribe();
    });

    it('tracks a favorite toggled in another sidebar panel', () => {
        marks.notify({
            playlistId: 'source-1',
            key: 'live:41',
            isFavorite: true,
        });
        fixture.detectChanges();
        expect(star().getAttribute('aria-pressed')).toBe('true');
        marks.notify({
            playlistId: 'another-source',
            key: 'live:41',
            isFavorite: false,
        });
        fixture.detectChanges();
        expect(star().getAttribute('aria-pressed')).toBe('true');
    });
});
