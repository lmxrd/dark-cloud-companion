import { useStore } from "@nanostores/react";
import { useTranslations } from "@/i18n";
import { $draft } from "@/lib/guide/draft";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { clearPlannerInputs } from "@/lib/store";
import { stripBase, withBase } from "@/lib/base";
import { navigate, useHref } from "@/lib/url";
import { EditorSection } from "./EditorSection";
import { GeneratorSection } from "./GeneratorSection";

type Tab = "generate" | "create";

const PATHS: Record<Tab, string> = { generate: "/tools/planner", create: "/tools/planner/editor" };

/** Planner tab: one section generates a weapon build, the other hand-crafts guides (generated builds prefill it). */
export function PlannerPage() {
  const t = useTranslations();
  // The tab is the path: /planner generates, /planner/editor edits guides.
  const href = useHref();
  const tab: Tab = stripBase(href.split("?")[0]).startsWith(PATHS.create) ? "create" : "generate";
  const setTab = (next: Tab) => navigate(withBase(PATHS[next]));
  const draft = useStore($draft);

  const tabs: { id: Tab; label: string }[] = [
    { id: "generate", label: t("planner.tab.generate") },
    { id: "create", label: `${t("planner.tab.create")}${draft ? " •" : ""}` },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" className="flex flex-wrap gap-1 border-b">
        {tabs.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === x.id ? "border-primary font-medium" : "text-muted-foreground border-transparent"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {/* Both sections stay mounted so a generated result and an open draft survive switching tabs. */}
      <div hidden={tab !== "generate"}>
        <ErrorBoundary
          label="the planner"
          recover={{ label: "Reset remembered planner inputs", run: clearPlannerInputs }}
        >
          <GeneratorSection onOpenEditor={() => setTab("create")} />
        </ErrorBoundary>
      </div>
      <div hidden={tab !== "create"}>
        <ErrorBoundary label="the guide editor">
          <EditorSection />
        </ErrorBoundary>
      </div>
    </div>
  );
}
