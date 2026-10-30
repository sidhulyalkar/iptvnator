import { InjectionToken } from '@angular/core';
import type { SportsScheduleSnapshot } from './sports-event-match.util';

/**
 * Optional authorized schedule source. No production provider is registered
 * by default, and this token never implies that IPTV playback is available.
 * Implementations must enforce consent, attribution, rate limits and freshness.
 */
export interface SportsScheduleSource {
    loadSchedule(): Promise<SportsScheduleSnapshot | null>;
}

export const SPORTS_SCHEDULE_SOURCE =
    new InjectionToken<SportsScheduleSource>('SPORTS_SCHEDULE_SOURCE');
