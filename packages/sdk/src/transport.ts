import type { IngestItem } from "@sentry-clone/db";
import { parseDsn } from "./utils";

const FLUSH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 20;

export class Transport {
  private queue: IngestItem[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private publicKey: string;
  private ingestUrl: string;
  private isBrowser: boolean;

  private beaconUrl: string;

  constructor(dsn: string) {
    const parsed = parseDsn(dsn);
    this.publicKey = parsed.publicKey;
    this.ingestUrl = parsed.ingestUrl;
    const separator = this.ingestUrl.includes("?") ? "&" : "?";
    this.beaconUrl = `${this.ingestUrl}${separator}key=${encodeURIComponent(this.publicKey)}`;
    this.isBrowser = typeof window !== "undefined" && typeof navigator !== "undefined";
    this.startFlushTimer();
    this.setupUnloadHandler();
  }

  enqueue(item: IngestItem): void {
    this.queue.push(item);
    if (this.queue.length >= MAX_BATCH_SIZE) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, MAX_BATCH_SIZE);
    const payload: IngestItem | IngestItem[] = batch.length === 1 ? batch[0]! : batch;
    await this.send(payload);
  }

  private async send(payload: IngestItem | IngestItem[]): Promise<void> {
    const body = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      "X-Sentry-Clone-Key": this.publicKey,
    };

    if (this.isBrowser && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(this.beaconUrl, blob);
      if (sent) return;
    }

    try {
      await fetch(this.ingestUrl, {
        method: "POST",
        headers,
        body,
        keepalive: true,
      });
    } catch {
      // silently drop on network failure
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    if (this.flushTimer && typeof this.flushTimer === "object" && "unref" in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  private setupUnloadHandler(): void {
    if (!this.isBrowser) return;
    const handler = (): void => {
      if (this.queue.length === 0) return;
      const batch = this.queue.splice(0, MAX_BATCH_SIZE);
      const payload: IngestItem | IngestItem[] =
        batch.length === 1 ? batch[0]! : batch;
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(this.beaconUrl, blob);
    };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
