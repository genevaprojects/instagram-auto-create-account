import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { moduleById, publicQuestions } from "@/lib/training";
import { ActionForm, Submit } from "@/components/action-form";
import { Badge, Section, day } from "@/components/ui";
import { submitQuiz } from "../actions";

export default async function ModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = moduleById(id);
  if (!m) notFound();
  const { supabase, profile } = await requireStaff();
  const { data } = await supabase.from("training_records").select("passed, score, total, module_version, completed_at").eq("staff_id", profile.id).eq("module_id", m.id).order("completed_at", { ascending: false }).limit(5);
  const attempts = (data ?? []) as { passed: boolean; score: number; total: number; module_version: number; completed_at: string }[];
  const passed = attempts.find((a) => a.passed && a.module_version === m.version);
  const list = (items: string[]) => <ul className="flex list-disc flex-col gap-2 pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>;

  return (
    <div className="max-w-[760px]">
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-ink-3"><Link href="/training" className="hover:text-ink hover:underline">Training centre</Link></nav>
      <header className="pb-6">
        <h1 className="text-xl font-semibold tracking-tight">{m.title}</h1>
        <p className="mt-1 text-sm text-ink-3">{m.standards} · about {m.minutes} minutes {passed ? <span className="ml-2"><Badge tone="accent">Passed {day(passed.completed_at)}</Badge></span> : null}</p>
      </header>
      <div className="flex flex-col text-base leading-relaxed">
        <Section title="Why this matters"><p className="max-w-[70ch]">{m.why}</p></Section>
        <Section title="What the standards require">{list(m.rules)}</Section>
        <Section title="Errors inspectors keep finding">{list(m.commonErrors)}</Section>
        <Section title="What good looks like">{list(m.good)}</Section>
        <Section title="Knowledge check" description="Every answer must be correct to pass. You can retry; each attempt is recorded.">
          <ActionForm action={submitQuiz} className="flex flex-col gap-6">
            <input type="hidden" name="module_id" value={m.id} />
            {publicQuestions(m).map((q) => (
              <fieldset key={q.i} className="flex flex-col gap-2">
                <legend className="mb-2 font-medium">{q.i + 1}. {q.q}</legend>
                {q.options.map((o, j) => (
                  <label key={j} className="flex cursor-pointer items-start gap-3 rounded-md border border-rule bg-surface px-3 py-2 text-sm hover:border-rule-strong has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                    <input type="radio" name={`q${q.i}`} value={j} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
                    {o}
                  </label>
                ))}
              </fieldset>
            ))}
            <div><Submit pendingText="Marking…">Submit answers</Submit></div>
          </ActionForm>
        </Section>
        <Section title="Sources">
          <ul className="flex flex-col gap-1 text-sm">
            {m.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{s.label}</a></li>)}
          </ul>
        </Section>
      </div>
    </div>
  );
}
