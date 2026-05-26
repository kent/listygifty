"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { captureWebEvent, type AnalyticsProperties } from "@/lib/analytics";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  analyticsEvent: string;
  analyticsProperties?: AnalyticsProperties;
};

export function TrackedLink({
  analyticsEvent,
  analyticsProperties,
  onClick,
  ...props
}: TrackedLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    captureWebEvent(analyticsEvent, analyticsProperties);
    onClick?.(event);
  };

  return <Link {...props} onClick={handleClick} />;
}
