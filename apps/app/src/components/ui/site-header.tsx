"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHAIN, FLR_LOGO } from "@/config/gitbounty";
import { cn } from "@/lib/utils";

// Client-only: wagmi hooks must never run during SSR.
const ConnectButton = dynamic(
  () => import("@/components/ui/connect-button").then((m) => m.ConnectButton),
  {
    ssr: false,
    loading: () => <div className="h-8 w-28 animate-pulse rounded-full bg-foreground/5" />,
  },
);

const navLinks = [
  { label: "Bounties", href: "/bounties" },
  { label: "Create", href: "/create" },
  { label: "Agent", href: "/agent" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-foreground/10 bg-background/95 backdrop-blur-lg">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/bounties" className="flex shrink-0 cursor-pointer items-center gap-2">
          <Image
            src="/logo-black.png"
            alt="GitBounty"
            width={36}
            height={36}
            className="size-9 select-none"
            priority
          />
          <span className="text-lg font-medium tracking-[-0.04em] text-foreground">GitBounty</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-2.5 py-1 text-[10px] uppercase tracking-wide text-foreground/60">
            <Image
              src={FLR_LOGO}
              alt="Flare"
              width={14}
              height={14}
              unoptimized
              className="size-3.5 rounded-full"
            />
            {CHAIN.name}
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-2 text-sm transition-colors",
                pathname.startsWith(link.href)
                  ? "font-medium text-foreground"
                  : "text-foreground/50 hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <ConnectButton />
      </nav>

      <div className="flex gap-1 overflow-x-auto border-t border-foreground/5 px-3 py-2 md:hidden">
        {navLinks.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={cn(
              "shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-colors",
              pathname.startsWith(link.href)
                ? "bg-foreground/5 font-medium text-foreground"
                : "text-foreground/50",
            )}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}
