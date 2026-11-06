import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Store } from '@ngrx/store';
import { TranslateModule } from '@ngx-translate/core';
import {
    FavoritesActions,
    selectActive,
    selectActivePlaylistId,
} from '@iptvnator/m3u-state';
import type { Channel } from '@iptvnator/shared/interfaces';
import { M3uLivePlayerFavoriteComponent } from './m3u-live-player-favorite.component';

const channel = {
    id: 'channel-1',
    name: 'Live Channel',
    url: 'https://provider.test/live.m3u8',
    tvg: { name: 'Live Channel' },
} as Channel;

describe('M3uLivePlayerFavoriteComponent', () => {
    let fixture: ComponentFixture<M3uLivePlayerFavoriteComponent>;
    let component: M3uLivePlayerFavoriteComponent;
    let dispatch: jest.Mock;
    const active = signal<Channel | null>(channel);
    const selectedPlaylist = signal('playlist-1');

    beforeEach(async () => {
        active.set(channel);
        selectedPlaylist.set('playlist-1');
        dispatch = jest.fn();
        await TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot(), M3uLivePlayerFavoriteComponent],
            providers: [
                {
                    provide: Store,
                    useValue: {
                        dispatch,
                        selectSignal: (selector: unknown) =>
                            selector === selectActive
                                ? active
                                : selector === selectActivePlaylistId
                                  ? selectedPlaylist
                                  : signal(null),
                    },
                },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(M3uLivePlayerFavoriteComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('channel', channel);
        fixture.componentRef.setInput('playlistId', 'playlist-1');
        fixture.componentRef.setInput(
            'sourceName',
            'https://user:secret@provider.test/list?password=SECRET'
        );
        fixture.componentRef.setInput('favoriteUrls', []);
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    const button = (): HTMLButtonElement =>
        fixture.nativeElement.querySelector(
            '[data-test-id="m3u-live-player-favorite"]'
        );

    it('uses the existing channel-list action and playlist-scoped URL state', () => {
        expect(button().getAttribute('aria-pressed')).toBe('false');
        expect(button().getAttribute('aria-label')).toContain('provider.test');
        expect(button().getAttribute('aria-label')).not.toContain('secret');
        button().click();
        expect(dispatch).toHaveBeenCalledWith(
            FavoritesActions.updateFavorites({ channel })
        );
        // M3U state is optimistic: the owning store updates the selector.
        expect(button().getAttribute('aria-pressed')).toBe('false');
        fixture.componentRef.setInput('favoriteUrls', [channel.url]);
        fixture.detectChanges();
        expect(button().getAttribute('aria-pressed')).toBe('true');
        button().click();
        expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it('fails closed when the route and selected playlist differ', () => {
        selectedPlaylist.set('playlist-2');
        fixture.detectChanges();
        expect(button().disabled).toBe(true);
        button().click();
        component.toggle();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('refuses to mutate a stale channel or missing source identity', () => {
        const next = { ...channel, id: 'channel-2', url: 'https://provider.test/2' };
        active.set(next);
        fixture.detectChanges();
        expect(button().disabled).toBe(true);
        component.toggle();
        expect(dispatch).not.toHaveBeenCalled();
        active.set(channel);
        fixture.componentRef.setInput('playlistId', null);
        fixture.detectChanges();
        component.toggle();
        expect(dispatch).not.toHaveBeenCalled();
    });
});
