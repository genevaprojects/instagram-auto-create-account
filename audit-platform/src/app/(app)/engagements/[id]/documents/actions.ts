"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/session";
import { friendlyDbError } from "@/lib/actions-core";

export async function registerUpload(input: { engagementId: string; kind: string; description: string; filename: string; storagePath: string; mime: string; size: number; sha256: string }) {
  const { supabase } = await requireStaff();
  if (!/^[0-9a-f]{64}$/.test(input.sha256)) return { error: "The file fingerprint is invalid. Upload again." };
  if (!input.storagePath.startsWith(`${input.engagementId}/`)) return { error: "Invalid storage path." };
  const { data, error } = await supabase
    .from("documents")
    .insert({ engagement_id: input.engagementId, kind: input.kind, description: input.description || null, filename: input.filename, storage_path: input.storagePath, mime_type: input.mime, size_bytes: input.size, sha256: input.sha256 })
    .select("id")
    .single();
  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath(`/engagements/${input.engagementId}`, "layout");
  return { id: data.id as string };
}

export async function supersede(fd: FormData) {
  const { supabase } = await requireStaff();
  const id = String(fd.get("id"));
  const eng = String(fd.get("engagement_id"));
  await supabase.from("documents").update({ status: "superseded" }).eq("id", id);
  revalidatePath(`/engagements/${eng}`, "layout");
}
