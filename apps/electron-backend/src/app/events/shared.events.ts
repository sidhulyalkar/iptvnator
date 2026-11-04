import { ipcMain } from 'electron';
import {
    configureRequestHeaderOverride,
    clearScopedRequestHeaderOverride,
    type StreamCredentialHeaders,
} from '../services/request-header-overrides.service';
import {
    ScopedStreamHeaderLeaseController,
    type ScopedHeaderLease,
} from '../services/scoped-stream-header-lease';

export default class SharedEvents {
    static bootstrapSharedEvents(): Electron.IpcMain {
        return ipcMain;
    }
}

function sanitizeCredentials(value: unknown): StreamCredentialHeaders | null {
    if (typeof value !== 'object' || value === null) {
        return null;
    }

    const { cookie, authorization } = value as Record<string, unknown>;
    return {
        authorization:
            typeof authorization === 'string' ? authorization : undefined,
        cookie: typeof cookie === 'string' ? cookie : undefined,
    };
}

const scopedHeaderLease = new ScopedStreamHeaderLeaseController(
    ({ userAgent, referer, scopeUrl, credentials }) =>
        configureRequestHeaderOverride(userAgent, referer, scopeUrl, credentials),
    clearScopedRequestHeaderOverride
);

ipcMain.handle('begin-stream-header-session', (event) => {
    const sender = event.sender;
    if (sender.isDestroyed()) return 0;
    const epoch = scopedHeaderLease.begin(sender.id);
    if (epoch <= 0) return 0;

    // A renderer crash or window destruction must revoke in-memory stream
    // credentials even if the renderer never sends a release IPC. A later
    // renderer session gets a new epoch; its lease cannot be cleared by these
    // earlier callbacks.
    const retire = () => { scopedHeaderLease.retire(sender.id, epoch); };
    sender.once('render-process-gone', retire);
    sender.once('destroyed', retire);
    return epoch;
});

ipcMain.handle(
    'set-user-agent',
    (event, userAgent, referer, scopeUrl, credentials, lease?: ScopedHeaderLease) => {
        if (lease !== undefined) {
            return scopedHeaderLease.apply(event.sender.id, lease, {
                userAgent, referer, scopeUrl,
                credentials: sanitizeCredentials(credentials),
            });
        }
        // Legacy unscoped playlist defaults remain supported. Scoped legacy
        // calls cannot bypass the active generation gate after session start.
        if (scopeUrl != null && scopedHeaderLease.hasSession()) return false;
        setUserAgent(userAgent, referer, scopeUrl, sanitizeCredentials(credentials));
        return true;
    }
);

ipcMain.handle(
    'release-stream-headers',
    (event, lease: ScopedHeaderLease, scopeUrl: string) =>
        scopedHeaderLease.release(event.sender.id, lease, scopeUrl)
);

/**
 * Sets scoped request headers for the currently selected stream.
 * @param userAgent user agent to use
 * @param referer referer to use
 * @param scopeUrl stream URL used to limit the override to the active origin
 * @param credentials portal Cookie/Authorization for auth-gated streams;
 *   applied only to the exact origin of `scopeUrl` and only while the
 *   scoped override is active
 */
export function setUserAgent(
    userAgent?: string | null,
    referer?: string | null,
    scopeUrl?: string | null,
    credentials?: StreamCredentialHeaders | null
): void {
    configureRequestHeaderOverride(userAgent, referer, scopeUrl, credentials);
}
