import "server-only";
import { revalidatePath } from "next/cache";
import { requireStaff, type Staff } from "./session";
import type { ActionState } from "@/components/action-form";

/** Wrap a server action: requires an active staff member, maps DB errors to plain English. */
export function staffAction(fn: (staff: Staff, fd: FormData) => Promise<ActionState | void>, revalidate?: string | ((fd: FormData) => string)) {
  return async (_prev: ActionState, fd: FormData): Promise<ActionState> => {
    const staff = await requireStaff();
    try {
      const res = await fn(staff, fd);
      if (revalidate) revalidatePath(typeof revalidate === "function" ? revalidate(fd) : revalidate, "layout");
      return res ?? { ok: "Saved." };
    } catch (e) {
      const msg = (e as Error).message ?? "Something went wrong.";
      if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
      return { error: friendlyDbError(msg) };
    }
  };
}

export function friendlyDbError(msg: string) {
  if (/row-level security/i.test(msg)) return "You do not have permission to do that.";
  if (/duplicate key.*engagements_client_id_fy_end/i.test(msg)) return "An engagement for this client and year end already exists.";
  if (/duplicate key.*staff_allowlist_pkey/i.test(msg)) return "That email is already on the staff list.";
  if (/duplicate key/i.test(msg)) return "That record already exists.";
  return msg.replace(/^.*?ERROR:\s*/, "");
}

export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
