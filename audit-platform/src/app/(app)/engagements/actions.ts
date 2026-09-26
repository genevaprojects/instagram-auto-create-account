"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { friendlyDbError, optStr, str } from "@/lib/actions-core";
import type { ActionState } from "@/components/action-form";

export async function createEngagement(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await requireStaff();
  const clientId = str(fd, "client_id");
  const fyEnd = str(fd, "fy_end");
  const fyStart = str(fd, "fy_start");
  if (!clientId || !fyEnd || !fyStart) return { error: "Choose the client and the financial year dates." };
  if (fyEnd <= fyStart) return { error: "The year end must be after the start date." };
  const fee = optStr(fd, "audit_fee");
  const { data, error } = await supabase
    .from("engagements")
    .insert({
      client_id: clientId,
      fy_start: fyStart,
      fy_end: fyEnd,
      audit_fee: fee ? Number(fee.replace(/,/g, "")) : null,
      reporting_deadline: optStr(fd, "reporting_deadline"),
      preparer_id: optStr(fd, "preparer_id") ?? profile.id,
      reviewer_id: optStr(fd, "reviewer_id"),
      partner_id: optStr(fd, "partner_id"),
    })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };
  redirect(`/engagements/${data.id}/documents`);
}
