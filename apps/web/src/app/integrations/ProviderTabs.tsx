"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { captureWebEvent } from "@/lib/analytics";

const providers = [
  { id: "chatgpt", label: "OpenAI" },
  { id: "claude", label: "Claude" },
  { id: "runner", label: "Runner" },
  { id: "grok-bot", label: "GrokBot" },
] as const;

function selectedProvider() {
  const hash = window.location.hash.slice(1);
  return providers.find(provider => provider.id === hash)?.id ?? "chatgpt";
}

function subscribeToNavigation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function selectProvider(value: string) {
  const oldURL = window.location.href;
  if (window.location.hash === `#${value}`) return;
  // Update the shareable URL without scrolling a tab that is already in view.
  window.history.pushState(null, "", `#${value}`);
  window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL, newURL: window.location.href }));
}

export function SetupInstructionsLink({ className }: { className: string }) {
  return (
    <a href="#connect" className={className}
      onClick={() => captureWebEvent("integration_how_to_connect_clicked", { location: "hero", destination: "connect_section" })}>
      Setup instructions <ArrowDown size={16} aria-hidden="true" />
    </a>
  );
}

export function ProviderTabs({ children }: { children: ReactNode }) {
  const selected = useSyncExternalStore(subscribeToNavigation, selectedProvider, () => "chatgpt");
  return (
    <Tabs value={selected} onValueChange={selectProvider} activationMode="manual" className="gap-3">
      <TabsList aria-label="AI assistant" className="grid h-auto w-full grid-cols-4 gap-1 p-1 sm:gap-2 sm:p-1.5">
        {providers.map(({ id, label }) => (
          <TabsTrigger key={id} id={id} value={id}
            className="h-auto min-h-16 min-w-0 scroll-mt-4 flex-col gap-1 px-1 py-2 text-xs sm:min-h-14 sm:flex-row sm:gap-2.5 sm:text-base">
            <Image src={`/integrations/logos/${id}.png`} alt="" width={32} height={32} className="size-7 shrink-0 rounded-lg sm:size-8" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
      <noscript><a className="text-sm underline" href="/integrations/index.html.md">Read setup instructions for all four assistants</a></noscript>
    </Tabs>
  );
}
