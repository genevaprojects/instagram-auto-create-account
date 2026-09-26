"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/session";
import { moduleById, PASS_MARK } from "@/lib/training";
import type { ActionState } from "@/components/action-form";

export async function submitQuiz(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const m = moduleById(String(fd.get("module_id")));
  if (!m) return { error: "Unknown module." };
  const wrong: string[] = [];
  let unanswered = 0;
  m.questions.forEach((q, i) => {
    const v = fd.get(`q${i}`);
    if (v === null) unanswered++;
    else if (Number(v) !== q.answer) wrong.push(`Question ${i + 1}: ${q.explain}`);
  });
  if (unanswered) return { error: `Answer every question (${unanswered} left).` };
  const score = m.questions.length - wrong.length;
  const passed = score / m.questions.length >= PASS_MARK;
  const { error } = await supabase.from("training_records").insert({ module_id: m.id, module_version: m.version, score, total: m.questions.length, passed });
  if (error) return { error: error.message };
  revalidatePath("/training", "layout");
  return passed
    ? { ok: `Passed ${score}/${m.questions.length}. Recorded on your training record.` }
    : { error: `${score}/${m.questions.length}. Review and try again. ${wrong.join(" ")}` };
}
