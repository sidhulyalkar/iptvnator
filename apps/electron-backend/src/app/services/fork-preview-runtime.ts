import { join } from 'node:path';

/** Release-candidate installers must never read or migrate stable user data. */
export const FORK_PREVIEW_PRODUCT_NAME = 'IPTVnator Preview';
export const FORK_PREVIEW_PROFILE_NAME = 'iptvnator-preview';
export const FORK_PREVIEW_RELEASES_URL =
    'https://github.com/sidhulyalkar/iptvnator/releases';

export function isForkPreviewRuntime(
    packaged: boolean,
    originalProductName: string
): boolean {
    return packaged && originalProductName === FORK_PREVIEW_PRODUCT_NAME;
}

export function getForkPreviewUserDataPath(appDataPath: string): string {
    return join(appDataPath, FORK_PREVIEW_PROFILE_NAME);
}
