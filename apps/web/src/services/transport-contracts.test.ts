import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient } from "@/lib/api-client";
import { exportsService } from "./exports.service";
import { notificationPreferencesService } from "./notification-preferences.service";

afterEach(() => {
  apiClient.setTokenGetter(async () => null);
  apiClient.setWorkspaceId(null);
  vi.unstubAllGlobals();
});

describe("service transport contracts", () => {
  it("downloads CSV with its server filename and releases its temporary URL", async () => {
    const revoke = vi.fn();
    const create = vi.fn(() => "blob:download");
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = create;
      static revokeObjectURL = revoke;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("name\nGift", {
      headers: { "Content-Disposition": 'attachment; filename="Christmas.csv"' },
    })));
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    await exportsService.downloadGiftsCsv(12);
    expect(downloads).toEqual(["Christmas.csv"]);
    expect(revoke).toHaveBeenCalledWith("blob:download");
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it("preserves API authorization errors for failed downloads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Access denied" }), { status: 403 })));
    await expect(exportsService.downloadPeopleCsv()).rejects.toBeInstanceOf(ApiError);
  });

  it("encodes unsubscribe tokens and sends false preferences without account credentials", async () => {
    apiClient.setTokenGetter(async () => "private-account-token");
    apiClient.setWorkspaceId(12);
    const fetch = vi.fn().mockImplementation(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    await notificationPreferencesService.getByToken("token/with?delimiters");
    await notificationPreferencesService.updateByToken("token", { pending_gifts_reminder_enabled: false });
    expect(fetch.mock.calls[0][0]).toContain("/email_preferences/token%2Fwith%3Fdelimiters");
    for (const [, options] of fetch.mock.calls) {
      expect(options.headers.Authorization).toBeUndefined();
      expect(options.headers["X-Workspace-ID"]).toBeUndefined();
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ pending_gifts_reminder_enabled: false });
  });
});
