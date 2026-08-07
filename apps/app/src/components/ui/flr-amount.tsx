import Image from "next/image";
import { FLR_LOGO } from "@/config/gitbounty";
import { cn } from "@/lib/utils";

/** An amount rendered with the Flare token mark. */
export function FlrAmount({
  children,
  size = "sm",
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Image
        src={FLR_LOGO}
        alt="FLR"
        width={size === "lg" ? 20 : 14}
        height={size === "lg" ? 20 : 14}
        unoptimized
        className={cn("rounded-full", size === "lg" ? "size-5" : "size-3.5")}
      />
      {children}
    </span>
  );
}
