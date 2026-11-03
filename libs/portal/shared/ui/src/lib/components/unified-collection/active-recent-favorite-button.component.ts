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
import type { UnifiedCollectionItem } from '@iptvnator/portal/shared/util';
import { resolveActiveRecentFavorite } from './active-recent-favorite';

@Component({
    selector: 'app-active-recent-favorite-button',
    templateUrl: './active-recent-favorite-button.component.html',
    styleUrl: './active-recent-favorite-button.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIconModule, TranslatePipe],
})
export class ActiveRecentFavoriteButtonComponent {
    readonly mode = input<'favorites' | 'recent'>('recent');
    readonly items = input.required<readonly UnifiedCollectionItem[]>();
    readonly activeItem = input<UnifiedCollectionItem | null>(null);
    readonly hasActiveDetail = input(false);
    readonly selectionPending = input(false);
    readonly favoriteUids = input<ReadonlySet<string>>(new Set<string>());
    readonly favoriteToggled = output<UnifiedCollectionItem>();

    readonly actionable = computed(() =>
        resolveActiveRecentFavorite({
            mode: this.mode(),
            items: this.items(),
            activeItem: this.activeItem(),
            hasActiveDetail: this.hasActiveDetail(),
            selectionPending: this.selectionPending(),
        })
    );
    readonly sourceLabel = computed(() =>
        playlistDisplayLabel(this.actionable()?.playlistName)
    );

    toggle(): void {
        const channel = this.actionable();
        if (channel) this.favoriteToggled.emit(channel);
    }
}
