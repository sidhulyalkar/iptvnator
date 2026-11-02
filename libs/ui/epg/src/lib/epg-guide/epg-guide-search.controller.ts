import { computed, signal } from '@angular/core';
import { EpgGuideSearchHit } from './epg-guide-source';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MAX_RESULTS = 20;
/** Shortest query that runs programme search. */
export const EPG_GUIDE_SEARCH_MIN_LENGTH = 2;
export type EpgGuideSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * One request owns the visible state at a time. Clear, replace, scope
 * changes and destruction invalidate its previous timer/response.
 * Search errors stay distinct from valid zero-result searches.
 */
export class EpgGuideSearchController {
    readonly query = signal('');
    readonly results = signal<EpgGuideSearchHit[]>([]);
    readonly status = signal<EpgGuideSearchStatus>('idle');
    readonly enabled: boolean;
    readonly panelVisible = computed(
        () => this.enabled &&
            this.query().trim().length >= EPG_GUIDE_SEARCH_MIN_LENGTH
    );

    private timer?: number;
    private requestGeneration = 0;
    private destroyed = false;

    constructor(
        private readonly search?: (query: string) => Promise<EpgGuideSearchHit[]>
    ) {
        this.enabled = typeof search === 'function';
    }

    setQuery(query: string): void {
        if (this.destroyed) return;
        const generation = ++this.requestGeneration;
        this.query.set(query);
        window.clearTimeout(this.timer);
        this.timer = undefined;
        // Never show stale results under a new query, even during debounce.
        this.results.set([]);
        const term = query.trim();
        if (term.length < EPG_GUIDE_SEARCH_MIN_LENGTH || !this.search) {
            this.status.set('idle');
            return;
        }
        this.status.set('loading');
        this.timer = window.setTimeout(async () => {
            try {
                const hits = (await this.search?.(term)) ?? [];
                if (this.owns(generation)) {
                    this.results.set(hits.slice(0, SEARCH_MAX_RESULTS));
                    this.status.set('ready');
                }
            } catch {
                if (this.owns(generation)) {
                    this.results.set([]);
                    this.status.set('error');
                }
            }
        }, SEARCH_DEBOUNCE_MS);
    }

    destroy(): void {
        this.destroyed = true;
        ++this.requestGeneration;
        window.clearTimeout(this.timer);
        this.timer = undefined;
        this.results.set([]);
        this.status.set('idle');
    }

    private owns(generation: number): boolean {
        return !this.destroyed && generation === this.requestGeneration;
    }
}
