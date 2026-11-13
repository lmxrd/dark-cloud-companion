import { useStore } from "@nanostores/react";
import { cn } from "cn";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRightIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { ViewToggles } from "@/components/dashboard/ViewToggles";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/i18n";
import { withBase } from "@/lib/base";
import { chapterById } from "@/lib/data";
import { allGuides } from "@/lib/guide/builtin";
import { firstIncompleteChapter, unionProgress } from "@/lib/guide/dashboard";
import type { Profile } from "@/lib/profiles";
import {
  $ready,
  $state,
  addProfile,
  buildExport,
  deleteProfile,
  importFromJson,
  renameProfile,
  switchProfile,
} from "@/lib/store";
import { readThemePref, setThemePref, type ThemePref } from "@/lib/theme";

function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

/** Current chapter and overall progress of a profile's switched-on guides. */
function summaryOf(p: Profile) {
  const guides = allGuides(p.guides).filter((g) => p.activeGuides.includes(g.id));
  const progress = unionProgress(guides, (g) => g.steps, p.checks);
  const chapter = chapterById.get(
    p.dashboard.currentChapter ?? firstIncompleteChapter(guides, p.checks),
  );
  return {
    chapter,
    pct: progress.total ? Math.round((progress.done / progress.total) * 100) : 0,
  };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-heading text-base font-extrabold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProfileCard({
  profile,
  active,
  canDelete,
}: {
  profile: Profile;
  active: boolean;
  canDelete: boolean;
}) {
  const t = useTranslations();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { chapter, pct } = summaryOf(profile);

  return (
    <li
      className={cn(
        "bg-card flex flex-col gap-2 rounded-lg border-2 p-3",
        active ? "shadow-sticker" : "border-border/50",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => switchProfile(profile.id)}
          aria-pressed={active}
          aria-label={t("settings.switchTo", { name: profile.name })}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-md border-2 text-sm font-bold",
              active ? "bg-secondary text-secondary-foreground" : "bg-muted",
            )}
          >
            {initials(profile.name)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{profile.name}</span>
            <span className="text-muted-foreground truncate text-xs tabular-nums">
              {[
                chapter &&
                  (chapter.phase === "main"
                    ? t("dash.chapterNumber", { n: chapter.number })
                    : chapter.title),
                `${pct}%`,
                active && t("settings.activeProfile"),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" />}
            aria-label={t("settings.profileActions", { name: profile.name })}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => setRenaming(profile.name)}>
              {t("profiles.rename")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => download(`dcc-${profile.name}.json`, buildExport([profile.id]))}
            >
              {t("profiles.exportOne")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={!canDelete}
              onClick={() => setConfirming(true)}
            >
              {t("profiles.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {renaming !== null && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (renaming.trim()) renameProfile(profile.id, renaming.trim());
            setRenaming(null);
          }}
        >
          <Input
            autoFocus
            aria-label={t("profiles.namePlaceholder")}
            value={renaming}
            onChange={(e) => setRenaming(e.target.value)}
          />
          <Button type="submit">{t("profiles.rename")}</Button>
          <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
            {t("settings.cancel")}
          </Button>
        </form>
      )}

      {confirming && (
        <div className="border-destructive bg-destructive/5 flex flex-wrap items-center gap-2 rounded-md border-2 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">{t("profiles.deleteConfirm")}</span>
          <Button variant="destructive" size="sm" onClick={() => deleteProfile(profile.id)}>
            {t("settings.deleteForGood")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            {t("settings.cancel")}
          </Button>
        </div>
      )}
    </li>
  );
}

/** A full-width row that leads somewhere (a link or an action). */
const rowClass =
  "hover:bg-muted/50 flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium";

export function SettingsPage() {
  const t = useTranslations();
  const state = useStore($state);
  const ready = useStore($ready);
  // Profiles and the theme come from localStorage: render them after mounting (matches the server).
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemePref>("system");
  useEffect(() => {
    setTheme(readThemePref());
    setMounted(true);
  }, []);
  const [newName, setNewName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const profiles = Object.values(state.profiles);
  const active = state.profiles[state.activeProfile];
  const [dangerConfirm, setDangerConfirm] = useState(false);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const err = await importFromJson(await file.text());
    setMessage(err ?? t("profiles.importOk"));
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-6">
      <Section id="settings-profiles" title={t("profiles.title")}>
        {mounted && ready && (
          <ul className="flex flex-col gap-2">
            {profiles.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                active={p.id === state.activeProfile}
                canDelete={profiles.length > 1}
              />
            ))}
          </ul>
        )}
        {newName === null ? (
          <Button variant="outline" className="w-fit" onClick={() => setNewName("")}>
            <PlusIcon />
            {t("profiles.add")}
          </Button>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              addProfile(newName.trim());
              setNewName(null);
            }}
          >
            <Input
              autoFocus
              placeholder={t("profiles.namePlaceholder")}
              aria-label={t("profiles.namePlaceholder")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit">{t("settings.create")}</Button>
            <Button type="button" variant="ghost" onClick={() => setNewName(null)}>
              {t("settings.cancel")}
            </Button>
          </form>
        )}
      </Section>

      <Section id="settings-appearance" title={t("settings.appearance")}>
        <div
          role="radiogroup"
          aria-label={t("settings.appearance")}
          className="bg-muted/60 flex w-full rounded-lg border-2 p-0.5 sm:w-fit"
        >
          {(["light", "dark", "system"] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={mounted && theme === x}
              onClick={() => {
                setThemePref(x);
                setTheme(x);
              }}
              className={cn(
                "flex-1 rounded-md border-2 px-4 py-1.5 text-sm font-semibold sm:flex-none",
                mounted && theme === x
                  ? "bg-card shadow-sticker-sm"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {t(`settings.theme.${x}` as const)}
            </button>
          ))}
        </div>
      </Section>

      <Section id="settings-dashboard" title={t("settings.dashboard")}>
        <ViewToggles className="bg-card rounded-lg border-2 px-3" />
      </Section>

      <Section id="settings-data" title={t("settings.data")}>
        <div className="bg-card divide-y-2 overflow-hidden rounded-lg border-2">
          <button
            type="button"
            className={rowClass}
            onClick={() => download("dcc-all-profiles.json", buildExport())}
          >
            {t("settings.exportAll")}
            <ChevronRightIcon className="text-muted-foreground size-4" aria-hidden />
          </button>
          <button type="button" className={rowClass} onClick={() => fileRef.current?.click()}>
            {t("profiles.import")}
            <ChevronRightIcon className="text-muted-foreground size-4" aria-hidden />
          </button>
          <a className={rowClass} href={withBase("/about")}>
            {t("nav.about")}
            <ChevronRightIcon className="text-muted-foreground size-4" aria-hidden />
          </a>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => onImport(e.target.files?.[0])}
        />
        {message && (
          <p className="text-sm" role="status">
            {message}
          </p>
        )}
        <p className="text-muted-foreground text-xs">{t("profiles.hint")}</p>
      </Section>

      {mounted && ready && active && (
        <Section id="settings-danger" title={t("settings.danger")}>
          <div className="border-destructive flex flex-col gap-2 rounded-lg border-2 p-3">
            <p className="text-sm">{t("settings.deleteActive", { name: active.name })}</p>
            {profiles.length <= 1 ? (
              <p className="text-muted-foreground text-xs">{t("settings.lastProfile")}</p>
            ) : dangerConfirm ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{t("profiles.deleteConfirm")}</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteProfile(active.id);
                    setDangerConfirm(false);
                  }}
                >
                  {t("settings.deleteForGood")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDangerConfirm(false)}>
                  {t("settings.cancel")}
                </Button>
              </div>
            ) : (
              <Button
                variant="destructive"
                className="w-fit"
                onClick={() => setDangerConfirm(true)}
              >
                {t("settings.deleteProfile")}
              </Button>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
