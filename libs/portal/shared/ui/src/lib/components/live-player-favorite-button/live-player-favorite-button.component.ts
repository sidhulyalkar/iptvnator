import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { playlistDisplayLabel } from '@iptvnator/shared/interfaces';

/** Presentation only. The owning source controls persistence and confirmation. */
@Component({
    selector: 'app-live-player-favorite-button',
    templateUrl: './live-player-favorite-button.component.html',
    styleUrl: './live-player-favorite-button.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIconModule, TranslatePipe],
})
export class LivePlayerFavoriteButtonComponent {
    readonly channelName = input.required<string>();
    readonly sourceName = input('');
    readonly isFavorite = input(false);
    readonly known = input(true);
    readonly pending = input(false);
    /** An unknown saved state may offer a read-only Retry, never a toggle. */
    readonly retryable = input(false);
    readonly testId = input('live-player-favorite');
    readonly toggleRequested = output<void>();
    readonly retryRequested = output<void>();

    readonly sourceLabel = computed(() =>
        playlistDisplayLabel(this.sourceName())
    );

    activate(): void {
        if (this.pending()) return;
        if (this.retryable()) {
            this.retryRequested.emit();
        } else if (this.known()) {
            this.toggleRequested.emit();
        }
    }
}
