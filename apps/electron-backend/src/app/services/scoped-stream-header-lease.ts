/**
 * Main-process authority for the one active inline-stream header slot.
 * A timed-out renderer promise cannot revoke or supersede this authority.
 * Epochs retire previous renderer sessions; generations order requests within
 * a session. Never log credentials or persist this state.
 */
export interface ScopedHeaderLease {
    epoch: number;
    generation: number;
}

export interface ScopedHeaderConfiguration {
    userAgent?: string | null;
    referer?: string | null;
    scopeUrl: string;
    credentials?: {
        authorization?: string | null;
        cookie?: string | null;
    } | null;
}

export class ScopedStreamHeaderLeaseController {
    private epoch = 0;
    private ownerSenderId: number | null = null;
    private latestGeneration = 0;
    private activeScopeUrl: string | null = null;

    constructor(
        private readonly configure: (request: ScopedHeaderConfiguration) => void,
        private readonly clearScoped: () => void
    ) {}

    begin(senderId: number): number {
        if (!Number.isSafeInteger(senderId) || senderId < 0) return 0;
        this.epoch += 1;
        this.ownerSenderId = senderId;
        this.latestGeneration = 0;
        this.activeScopeUrl = null;
        this.clearScoped();
        return this.epoch;
    }

    hasSession(): boolean {
        return this.ownerSenderId !== null;
    }

    /**
     * Retire secrets when the owning renderer exits or crashes.
     * An older renderer's destroy event cannot retire a replacement epoch.
     */
    retire(senderId: number, epoch: number): boolean {
        if (senderId !== this.ownerSenderId || epoch !== this.epoch) {
            return false;
        }
        this.ownerSenderId = null;
        this.activeScopeUrl = null;
        this.latestGeneration = 0;
        this.epoch += 1;
        this.clearScoped();
        return true;
    }

    private accepts(senderId: number, lease: ScopedHeaderLease): boolean {
        return (
            senderId === this.ownerSenderId &&
            lease != null &&
            Number.isSafeInteger(lease.epoch) &&
            lease.epoch === this.epoch &&
            Number.isSafeInteger(lease.generation) &&
            lease.generation > this.latestGeneration
        );
    }

    /**
     * A newer generation can replace or clear the slot. Stale operations
     * cannot commit even when their IPC message is delivered out of order.
     */
    apply(
        senderId: number,
        lease: ScopedHeaderLease,
        request: ScopedHeaderConfiguration
    ): boolean {
        if (!this.accepts(senderId, lease)) return false;
        // Even a newer but invalid stream retires the previous credentials.
        this.latestGeneration = lease.generation;
        this.activeScopeUrl = null;
        this.clearScoped();
        try {
            const url = new URL(request.scopeUrl);
            if (!['http:', 'https:'].includes(url.protocol)) return false;
            this.configure(request);
            this.activeScopeUrl = request.scopeUrl;
            return true;
        } catch {
            this.clearScoped();
            return false;
        }
    }

    /**
     * Only the active scope can be cleared. A clear has its own higher
     * generation, so a delayed setup for the old scope cannot reinstall it.
     */
    release(
        senderId: number,
        lease: ScopedHeaderLease,
        scopeUrl: string
    ): boolean {
        if (!this.accepts(senderId, lease) || !scopeUrl) return false;
        // A release may fence a pending setup while no scope is installed.
        // Once another stream owns the slot, a mismatched URL must never
        // acknowledge the clear or supersede the newer generation.
        if (this.activeScopeUrl !== null &&
            this.activeScopeUrl !== scopeUrl) {
            return false;
        }
        this.latestGeneration = lease.generation;
        if (this.activeScopeUrl === scopeUrl) {
            this.activeScopeUrl = null;
            this.clearScoped();
        }
        return true;
    }
}
