import { SiteHeader } from "@/components/ui/site-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <SiteHeader />
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
