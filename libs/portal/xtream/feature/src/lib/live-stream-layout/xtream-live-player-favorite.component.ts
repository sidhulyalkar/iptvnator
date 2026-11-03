import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
    FavoritesService,
    XtreamStore,
} from '@iptvnator/portal/xtream/data-access';
import { LivePlayerFavoriteButtonComponent } from '@iptvnator/portal/shared/ui';
import { XtreamFavoriteMarksService } from '../portal-channels-list/xtream-favorite-marks.service';
import type { XtreamLiveFavoriteTarget } from './xtream-live-favorite-target';

/**
 * Xtream persistence adapter. The button shows only stored favorite state,
 * and uses the existing cross-list relay after a read-back confirms a write.
 */
@Component({
    selector: 'app-xtream-live-player-favorite',
    templateUrl: './xtream-live-player-favorite.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LivePlayerFavoriteButtonComponent],
})
export class XtreamLivePlayerFavoriteComponent {
    readonly target = input.required<XtreamLiveFavoriteTarget>();
    private readonly favorites = inject(FavoritesService);
    private readonly store = inject(XtreamStore);
    private readonly marks = inject(XtreamFavoriteMarksService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly storedFavorite = signal<boolean | null>(null);
    private readonly pendingTarget = signal<XtreamLiveFavoriteTarget | null>(null);
    readonly isFavorite = computed(() => this.storedFavorite() === true);
    readonly known = computed(() => this.storedFavorite() !== null);
    readonly pending = computed(() => this.pendingTarget() === this.target());

    constructor() {
        effect((onCleanup) => {
            const target = this.target();
            let current = true;
            let markSeen = false;
            this.storedFavorite.set(null);
            const markSubscription = this.marks.changes$.subscribe((change) => {
                if (
                    !current ||
                    change.playlistId !== target.playlistId ||
                    change.key !== `live:${target.xtreamId}`
                ) {
                    return;
                }
                markSeen = true;
                this.storedFavorite.set(change.isFavorite);
            });
            const initialSubscription = this.favorites
                .getFavorites(target.playlistId)
                .subscribe({
                    next: (saved) => {
                        if (current && !markSeen) {
                            this.storedFavorite.set(
                                saved.some(
                                    (row) =>
                                        row.type === 'live' &&
                                        row.xtream_id === target.xtreamId
                                )
                            );
                        }
                    },
                    error: () => {
                        if (current && !markSeen) {
                            this.storedFavorite.set(null);
                        }
                    },
                });
            onCleanup(() => {
                current = false;
                markSubscription.unsubscribe();
                initialSubscription.unsubscribe();
            });
        });
    }

    async toggle(): Promise<void> {
        const target = this.target();
        if (!this.known() || this.pending()) return;
        this.pendingTarget.set(target);
        try {
            // A false toggle result can mean removal OR a failed save.
            await this.store.toggleFavorite(
                target.xtreamId,
                target.playlistId,
                'live'
            );
            const saved = await firstValueFrom(
                this.favorites.getFavorites(target.playlistId)
            );
            if (this.destroyRef.destroyed || this.target() !== target) return;
            const isFavorite = saved.some(
                (row) =>
                    row.type === 'live' && row.xtream_id === target.xtreamId
            );
            this.storedFavorite.set(isFavorite);
            this.marks.notify({
                playlistId: target.playlistId,
                key: `live:${target.xtreamId}`,
                isFavorite,
            });
        } catch {
            // A rejected read/write cannot authorize a new favorite state.
            if (!this.destroyRef.destroyed && this.target() === target) {
                this.storedFavorite.set(null);
            }
        } finally {
            if (!this.destroyRef.destroyed && this.pendingTarget() === target) {
                this.pendingTarget.set(null);
            }
        }
    }
}
