// Plain constants and types for terminal inventory.
//
// These live here rather than in actions.ts because a "use server" file may
// only export async functions - exporting an object from one fails the build
// with "A use server file can only export async functions, found object".
export type TerminalStatus =
  | "in_stock"
  | "with_rep"
  | "deployed"
  | "returned"
  | "damaged"
  | "lost";

export const TERMINAL_STATUS_LABEL: Record<TerminalStatus, string> = {
  in_stock: "In stock",
  with_rep: "With a rep",
  deployed: "In a shop",
  returned: "Came back",
  damaged: "Damaged",
  lost: "Lost",
};

export type ActionResult = { ok: true; message?: string } | { ok: false; message: string };
