"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A 6×6 grey PNG. Next scales it to the image box and blurs it, which is the
 * cheap end of the LQIP technique: something with the right shape and weight
 * paints immediately, and the real pixels resolve into it. Avatars come from
 * GitHub, so we cannot ship a per-image preview — one neutral placeholder is
 * what is actually available, and it still removes the empty-box flash.
 */
const NEUTRAL_LQIP =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAAGCAQAAAAHeIwaAAAAG0lEQVR42mNk+M9QzzCKRsEoGAWjYBSMglEwCgBqhwQBs4mUxwAAAABJRU5ErkJggg==";

/**
 * Image that fades from blurred placeholder to sharp once decoded.
 *
 * The blur is deliberately still there on first paint — swapping a hard-edged
 * box for a photo reads as a flicker, while a blur that sharpens reads as the
 * image arriving.
 */
export function BlurImage({ className, alt, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Image
      {...props}
      alt={alt}
      // GitHub already serves these at the requested size from its own CDN;
      // re-encoding them on our box measured ~700ms per avatar against ~50ms
      // direct, and made an avatar the LCP element.
      unoptimized
      placeholder="blur"
      blurDataURL={NEUTRAL_LQIP}
      onLoad={() => setLoaded(true)}
      // Blur only. Fading opacity in as well cost about five seconds of Speed
      // Index, because the metric scores how complete the page looks over time
      // and a translucent image reads as unfinished.
      className={cn(
        "transition-[filter] duration-300 ease-out",
        loaded ? "blur-0" : "blur-[6px]",
        className,
      )}
    />
  );
}
