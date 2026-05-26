"use client";

import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import { captureWebEvent, type AnalyticsProperties } from "@/lib/analytics";

type TrackedLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  analyticsEvent: string;
  analyticsProperties?: AnalyticsProperties;
};

export const TrackedLink = forwardRef<HTMLAnchorElement, TrackedLinkProps>(function TrackedLink(
  { analyticsEvent, analyticsProperties, onClick, ...props },
  ref
) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    captureWebEvent(analyticsEvent, analyticsProperties);
    onClick?.(event);
  };

  return <Link ref={ref} {...props} onClick={handleClick} />;
});
