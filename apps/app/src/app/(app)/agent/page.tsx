"use client";

import { BotIcon, CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { LLM_PROVIDERS } from "@/config/gitbounty";
import { cn } from "@/lib/utils";

const BYOK_STORAGE_KEY = "gitbounty.byok";

interface ByokConfig {
  provider: string;
  model: string;
  apiKey: string;
}

function loadByok(): ByokConfig | null {
  try {
    const raw = localStorage.getItem(BYOK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ByokConfig) : null;
  } catch {
    return null;
  }
}

const STEPS = [
  "Watches repos for bounty-labeled issues",
  "Generates a fix with the model you pick below",
  "Opens a PR quoting the reward in FLR at the live FTSOv2 price",
  "Gets paid to its own wallet when the maintainer merges",
];

export default function AgentPage() {
  const [provider, setProvider] = useState(LLM_PROVIDERS[0].name);
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = loadByok();
    if (existing) {
      setProvider(existing.provider);
      setModel(existing.model);
      setApiKey(existing.apiKey);
    }
  }, []);

  const selected = LLM_PROVIDERS.find((p) => p.name === provider);

  function save() {
    localStorage.setItem(
      BYOK_STORAGE_KEY,
      JSON.stringify({
        provider,
        model: model || selected?.defaultModel || "",
        apiKey,
      }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <PageShell title="Agent">
      <div className="mx-auto max-w-2xl space-y-8 p-6">
        <section className="rounded-xl border border-foreground/10 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BotIcon className="size-4" /> The autonomous bounty hunter
          </h2>
          <ol className="mt-3 space-y-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-foreground/70">
                <span className="font-mono text-xs text-foreground/65">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-foreground">Bring your own key</h2>
          <p className="mt-1 text-xs leading-relaxed text-foreground/65">
            Pick the model your agent runs on. The key is stored only in this browser (localStorage)
            and passed to your own agent process — it never touches our servers.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {LLM_PROVIDERS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setProvider(p.name);
                  setModel("");
                }}
                className={cn(
                  "cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors",
                  provider === p.name
                    ? "border-foreground/60 bg-foreground/5"
                    : "border-foreground/10 hover:border-foreground/30",
                )}
              >
                <div className="text-sm font-medium capitalize text-foreground">{p.name}</div>
                <div className="truncate text-[10px] text-foreground/65">{p.defaultModel}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={model}
              onChange={(e) => setModel(e.target.value.trim())}
              placeholder={`Model (default: ${selected?.defaultModel ?? ""})`}
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground/40"
            />
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value.trim())}
              type="password"
              placeholder="API key"
              className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground/40"
            />
            <button
              type="button"
              disabled={!apiKey}
              onClick={save}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saved ? (
                <>
                  <CheckIcon className="size-4" /> Saved locally
                </>
              ) : (
                "Save configuration"
              )}
            </button>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
