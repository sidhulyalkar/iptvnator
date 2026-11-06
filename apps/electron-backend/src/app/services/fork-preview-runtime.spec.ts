import { join } from 'node:path';
import {
    FORK_PREVIEW_PRODUCT_NAME,
    FORK_PREVIEW_PROFILE_NAME,
    getForkPreviewUserDataPath,
    isForkPreviewRuntime,
} from './fork-preview-runtime';

describe('fork preview installer runtime isolation', () => {
    it('recognizes only the packaged fork preview identity', () => {
        expect(isForkPreviewRuntime(true, FORK_PREVIEW_PRODUCT_NAME)).toBe(true);
        expect(isForkPreviewRuntime(false, FORK_PREVIEW_PRODUCT_NAME)).toBe(false);
        expect(isForkPreviewRuntime(true, 'IPTVnator')).toBe(false);
        expect(isForkPreviewRuntime(true, 'IPTVnator Nightly')).toBe(false);
    });
    it('uses a distinct profile directory without inspecting stable data', () => {
        const stableRoot = '/home/example/.config';
        expect(getForkPreviewUserDataPath(stableRoot)).toBe(
            join(stableRoot, FORK_PREVIEW_PROFILE_NAME)
        );
    });
});
