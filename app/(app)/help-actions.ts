"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { HELP, type HelpTopic } from "@/lib/help-content";

/**
 * Help text lives in code as the default and in the database as an override.
 *
 * The code copy means a fresh deployment is never blank. The override means a
 * wrong line gets fixed by whoever noticed it, in the app, without a deploy -
 * which matters most for another group licensing this, whose rules will differ
 * from NectarPay's.
 */
export async function loadHelp(path: string): Promise<{
  topic: HelpTopic | null;
  edited: boolean;
}> {
  const fallback =
    HELP.filter((h) => path.startsWith(h.path)).sort(
      (a, b) => b.path.length - a.path.length,
    )[0] ?? null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("help_topics")
    .select("path, title, what, steps, gotchas, stuck");

  const rows = data ?? [];
  const override = rows
    .filter((r) => path.startsWith(r.path as string))
    .sort((a, b) => (b.path as string).length - (a.path as string).length)[0];

  if (!override) return { topic: fallback, edited: false };

  return {
    topic: {
      path: override.path as string,
      title: (override.title as string) ?? fallback?.title ?? "This page",
      what: (override.what as string) ?? fallback?.what ?? "",
      steps: (override.steps as string[] | null) ?? undefined,
      gotchas: (override.gotchas as string[] | null) ?? undefined,
      stuck: (override.stuck as string | null) ?? undefined,
    },
    edited: true,
  };
}

const lines = (text: string): string[] =>
  text
    .split("\n")
    .map((l) => l.replace(/^[-*\u2022]\s*/, "").trim())
    .filter(Boolean);

export async function saveHelp(input: {
  path: string;
  title: string;
  what: string;
  steps: string;
  gotchas: string;
  stuck: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false as const, message: "No profile" };
  if (!["super_admin", "admin"].includes(profile.role as string)) {
    return { ok: false as const, message: "Only an admin can edit help" };
  }
  if (!input.what.trim()) {
    return { ok: false as const, message: "Say what the page is for" };
  }

  const { error } = await supabase.from("help_topics").upsert(
    {
      org_id: profile.org_id,
      path: input.path,
      title: input.title.trim() || "This page",
      what: input.what.trim(),
      steps: lines(input.steps),
      gotchas: lines(input.gotchas),
      stuck: input.stuck.trim() || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,path" },
  );
  if (error) return { ok: false as const, message: error.message };

  revalidatePath(input.path);
  return { ok: true as const };
}

/** Drop the override and fall back to what ships in the code. */
export async function resetHelp(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!["super_admin", "admin"].includes((profile?.role as string) ?? "")) {
    return { ok: false as const, message: "Only an admin can edit help" };
  }

  const { error } = await supabase.from("help_topics").delete().eq("path", path);
  if (error) return { ok: false as const, message: error.message };

  revalidatePath(path);
  return { ok: true as const };
}
