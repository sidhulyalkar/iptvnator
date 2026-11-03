import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { Store } from '@ngrx/store';
import {
    FavoritesActions,
    selectActive,
    selectActivePlaylistId,
} from '@iptvnator/m3u-state';
import type { Channel } from '@iptvnator/shared/interfaces';
import { LivePlayerFavoriteButtonComponent } from '@iptvnator/portal/shared/ui';

/**
 * M3U adapter. Delegates to the same playlist-scoped favorite action as the
 * channel list. This store action is optimistic; UI state is not proof of
 * persistence until its existing async effect completes.
 */
@Component({
    selector: 'app-m3u-live-player-favorite',
    templateUrl: './m3u-live-player-favorite.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LivePlayerFavoriteButtonComponent],
})
export class M3uLivePlayerFavoriteComponent {
    private readonly store = inject(Store);
    private readonly storePlaylistId =
        this.store.selectSignal(selectActivePlaylistId);
    private readonly storeChannel = this.store.selectSignal(selectActive);

    readonly channel = input.required<Channel>();
    readonly playlistId = input<string | null | undefined>(null);
    readonly sourceName = input('');
    readonly favoriteUrls = input<readonly string[]>([]);

    /** Fail closed while the route and the playback store disagree on owner. */
    readonly actionable = computed(() => {
        const channel = this.channel();
        const selected = this.storeChannel();
        return Boolean(
            this.playlistId() &&
                this.playlistId() === this.storePlaylistId() &&
                channel.url &&
                selected?.url === channel.url &&
                selected?.id === channel.id
        );
    });
    readonly isFavorite = computed(() =>
        this.favoriteUrls().includes(this.channel().url)
    );

    toggle(): void {
        if (!this.actionable()) return;
        this.store.dispatch(
            FavoritesActions.updateFavorites({ channel: this.channel() })
        );
    }
}
