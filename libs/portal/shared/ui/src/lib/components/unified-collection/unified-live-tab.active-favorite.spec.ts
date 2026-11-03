import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AudioPlayerComponent, WebPlayerViewComponent } from '@iptvnator/ui/playback';
import { EpgListViewComponent, EpgTimelineComponent } from '@iptvnator/ui/epg';
import { ResizableDirective } from '@iptvnator/ui/components';
import { GlobalFavoritesListComponent } from '../global-favorites-list/global-favorites-list.component';
import { PORTAL_PLAYER, UnifiedCollectionItem } from '@iptvnator/portal/shared/util';
import {
    StreamResolverService,
    UnifiedRecentDataService,
} from '@iptvnator/portal/shared/data-access';
import { RuntimeCapabilitiesService, SettingsStore } from '@iptvnator/services';
import { VideoPlayer } from '@iptvnator/shared/interfaces';
import { buildLiveItem } from './unified-live-tab.spec-data';
import { UnifiedLiveTabComponent } from './unified-live-tab.component';
import {
    StubAudioPlayerComponent,
    StubEpgTimelineComponent,
    StubGlobalFavoritesListComponent,
    StubResizableDirective,
    StubWebPlayerViewComponent,
} from './unified-live-tab.spec-stubs';

describe('UnifiedLiveTab active-player favorite action', () => {
    let fixture: ComponentFixture<UnifiedLiveTabComponent>;
    let component: UnifiedLiveTabComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TranslateModule.forRoot(), UnifiedLiveTabComponent],
            providers: [
                {
                    provide: StreamResolverService,
                    useValue: {
                        resolveLiveDetail: jest.fn(),
                        resolveM3uPlaybackDetail: jest.fn(),
                        loadM3uProgramsForItem: jest.fn().mockResolvedValue([]),
                        loadEpgItems: jest.fn().mockResolvedValue([]),
                        loadEpgForItems: jest.fn().mockResolvedValue(new Map()),
                    },
                },
                {
                    provide: UnifiedRecentDataService,
                    useValue: { recordLivePlayback: jest.fn() },
                },
                {
                    provide: RuntimeCapabilitiesService,
                    useValue: {
                        supportsProviderEpg: false,
                        supportsProviderCatchUp: false,
                        supportsEpg: false,
                    },
                },
                {
                    provide: SettingsStore,
                    useValue: {
                        openStreamOnDoubleClick: signal(false),
                        player: signal(VideoPlayer.VideoJs),
                        stripCountryPrefix: signal(false),
                        resolvedEpgViewMode: signal('timeline'),
                        resolvedEpgOffsetMinutes: signal(0),
                    },
                },
                {
                    provide: PORTAL_PLAYER,
                    useValue: {
                        isEmbeddedPlayer: () => true,
                        openResolvedPlayback: jest.fn(),
                        openExternalPlayback: jest.fn(),
                    },
                },
                { provide: MatSnackBar, useValue: { open: jest.fn() } },
            ],
        })
            .overrideComponent(UnifiedLiveTabComponent, {
                remove: {
                    imports: [
                        AudioPlayerComponent,
                        EpgListViewComponent,
                        EpgTimelineComponent,
                        GlobalFavoritesListComponent,
                        ResizableDirective,
                        WebPlayerViewComponent,
                    ],
                },
                add: {
                    imports: [
                        StubAudioPlayerComponent,
                        StubEpgTimelineComponent,
                        StubGlobalFavoritesListComponent,
                        StubResizableDirective,
                        StubWebPlayerViewComponent,
                    ],
                },
            })
            .compileComponents();

        fixture = TestBed.createComponent(UnifiedLiveTabComponent);
        component = fixture.componentInstance;
    });

    afterEach(() => fixture.destroy());

    it('emits only the committed recent channel and follows confirmed favorite state', () => {
        const item = buildLiveItem('xtream');
        const emitted: UnifiedCollectionItem[] = [];
        component.favoriteToggled.subscribe((value) => emitted.push(value));
        fixture.componentRef.setInput('items', [item]);
        fixture.componentRef.setInput('mode', 'recent');
        component.activeItem.set(item);
        component.activeDetail.set({
            playback: { streamUrl: 'https://example.test/live.ts', title: item.name },
            epgMode: 'portal',
        });
        fixture.detectChanges();

        const button = fixture.nativeElement.querySelector(
            '[data-test-id="active-recent-favorite"]'
        ) as HTMLButtonElement;
        expect(button).not.toBeNull();
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.getAttribute('aria-label')).toContain(item.name);
        button.click();
        expect(emitted).toEqual([item]);
        // A click alone does not claim persistence succeeded.
        expect(button.getAttribute('aria-pressed')).toBe('false');

        fixture.componentRef.setInput('favoriteUids', new Set([item.uid]));
        fixture.detectChanges();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        button.click();
        expect(emitted).toEqual([item, item]);

        component.isSelecting.set(true);
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelector(
                '[data-test-id="active-recent-favorite"]'
            )
        ).toBeNull();
    });

    it('does not put a favorite button on the Favorites-only player', () => {
        const item = buildLiveItem('stalker');
        fixture.componentRef.setInput('items', [item]);
        fixture.componentRef.setInput('mode', 'favorites');
        component.activeItem.set(item);
        component.activeDetail.set({
            playback: { streamUrl: 'https://example.test/live.ts', title: item.name },
            epgMode: 'portal',
        });
        fixture.detectChanges();
        expect(
            fixture.nativeElement.querySelector(
                '[data-test-id="active-recent-favorite"]'
            )
        ).toBeNull();
    });
});
