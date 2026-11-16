import { useChecks, useProfile } from "@/lib/useAppStore";
import { useMemo } from "react";
import { findGuide } from "@/lib/guide/builtin";
import type { Guide } from "@/lib/guide/types";

/** The profile's switched-on guides (missing ids are ignored), plus the profile and ticks. */
export function useActiveGuides() {
  const profile = useProfile();
  const checks = useChecks();
  const guides = useMemo(
    () =>
      profile.activeGuides
        .map((id) => findGuide(id, profile.guides))
        .filter((g): g is Guide => !!g),
    [profile.activeGuides, profile.guides],
  );
  return {
    profile,
    checks,
    guides,
  };
}
