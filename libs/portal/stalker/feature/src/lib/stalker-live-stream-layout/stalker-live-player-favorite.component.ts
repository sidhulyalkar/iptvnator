import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlaylistsService } from '@iptvnator/services';
import { StalkerStore } from '@iptvnator/portal/stalker/data-access';
import { LivePlayerFavoriteButtonComponent } from '@iptvnator/portal/shared/ui';
import {
    hasStalkerLiveFavorite,
    type StalkerLiveFavoriteTarget,
} from './stalker-live-favorite-target';

const WRITE_ACK_TIMEOUT_MS = 15_000;

@Component({
    selector: 'app-stalker-live-player-favorite',
    templateUrl: './stalker-live-player-favorite.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LivePlayerFavoriteButtonComponent],
})
export class StalkerLivePlayerFavoriteComponent {
    readonly target = input.required<StalkerLiveFavoriteTarget>();
    readonly revision = input(0);
    readonly favoriteConfirmed = output<{
        playlistId: string;
        channelId: string;
        favoriteId: string;
        isFavorite: boolean;
    }>();

    private readonly store = inject(StalkerStore);
    private readonly playlists = inject(PlaylistsService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly persisted = signal<boolean | null>(null);
    readonly retryable = signal(false);
    private readonly pendingTarget = signal<StalkerLiveFavoriteTarget | null>(null);
    private statusGeneration = 0;

    readonly isFavorite = computed(() => this.persisted() === true);
    readonly known = computed(() => this.persisted() !== null);
    readonly pending = computed(() => this.pendingTarget() === this.target());

    constructor() {
        effect(() => {
            const target = this.target();
            this.revision();
            void this.readStatus(target);
        });
    }

    /** A fresh read never changes stored favorites; safe after any failure. */
    async retry(): Promise<void> {
        if (!this.pending()) await this.readStatus(this.target());
    }

    private isCurrent(target: StalkerLiveFavoriteTarget, generation: number) {
        return (
            !this.destroyRef.destroyed &&
            this.target() === target &&
            this.statusGeneration === generation
        );
    }

    private async readStatus(target: StalkerLiveFavoriteTarget): Promise<void> {
        const generation = ++this.statusGeneration;
        this.persisted.set(null);
        this.retryable.set(false);
        try {
            const favorites = await firstValueFrom(
                this.playlists.getPortalFavorites(target.playlistId)
            );
            if (this.isCurrent(target, generation)) {
                this.persisted.set(
                    hasStalkerLiveFavorite(favorites, target.favoriteId)
                );
            }
        } catch {
            if (this.isCurrent(target, generation)) this.retryable.set(true);
        }
    }

    async toggle(): Promise<void> {
        const target = this.target();
        if (
            !this.known() ||
            this.pending() ||
            this.store.currentPlaylist()?._id !== target.playlistId
        ) return;
        const remove = this.isFavorite();
        this.pendingTarget.set(target);
        try {
            await this.persistChange(target, remove);
            if (this.destroyRef.destroyed || this.target() !== target) return;
            const generation = ++this.statusGeneration;
            const saved = await firstValueFrom(
                this.playlists.getPortalFavorites(target.playlistId)
            );
            if (!this.isCurrent(target, generation)) return;
            const isFavorite = hasStalkerLiveFavorite(
                saved,
                target.favoriteId
            );
            this.persisted.set(isFavorite);
            this.retryable.set(false);
            this.favoriteConfirmed.emit({
                playlistId: target.playlistId,
                channelId: target.channelId,
                favoriteId: target.favoriteId,
                isFavorite,
            });
        } catch {
            if (!this.destroyRef.destroyed && this.target() === target) {
                this.statusGeneration++;
                this.persisted.set(null);
                this.retryable.set(true);
            }
        } finally {
            if (!this.destroyRef.destroyed && this.pendingTarget() === target) {
                this.pendingTarget.set(null);
            }
        }
    }

    /** Store callbacks acknowledge a completed portal write, not UI optimism. */
    private persistChange(
        target: StalkerLiveFavoriteTarget,
        remove: boolean
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let settled = false;
            const settle = (success: boolean) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (success) resolve();
                else reject(new Error('favorite-write-unconfirmed'));
            };
            const timeout = setTimeout(
                () => settle(false),
                WRITE_ACK_TIMEOUT_MS
            );
            try {
                if (remove) {
                    this.store.removeFromFavorites(
                        target.favoriteId,
                        () => settle(true),
                        () => settle(false),
                        'itv'
                    );
                } else {
                    this.store.addToFavorites(
                        {
                            ...target.item,
                            category_id: 'itv',
                            title: target.channelName,
                            cover: target.item.logo,
                            added_at: new Date().toISOString(),
                        },
                        () => settle(true),
                        () => settle(false)
                    );
                }
            } catch {
                settle(false);
            }
        });
    }
}
