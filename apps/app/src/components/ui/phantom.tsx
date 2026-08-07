"use client";

import { type ReactNode, useEffect, useState } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "phantom-ui": {
        children?: ReactNode;
        loading?: boolean;
        animation?: "shimmer" | "pulse" | "breathe" | "solid";
        count?: number;
        "count-gap"?: number;
        reveal?: number;
      };
    }
  }
}

/**
 * Skeleton loader that measures the real markup it wraps and shimmers over the
 * boxes it finds, so the placeholder cannot drift from the component the way a
 * hand-drawn one does.
 *
 * The custom element registers against `window`, so it is imported on the
 * client only; until it upgrades, the children render as they are.
 */
export function Phantom({
  loading,
  count = 1,
  children,
}: {
  loading: boolean;
  count?: number;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@aejkatappaja/phantom-ui").then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Before the element upgrades, a plain wrapper keeps the layout identical —
  // no height jump when the shimmer takes over.
  if (!ready) {
    return <div aria-busy={loading}>{children}</div>;
  }

  return (
    <phantom-ui loading={loading} animation="shimmer" count={count} count-gap={16} reveal={0.3}>
      {children}
    </phantom-ui>
  );
}
