import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, Input, Notice } from "@/components/ui";
import { signIn } from "../actions";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  suspended: "Your access has been suspended. Speak to a partner.",
  no_profile: "Your staff profile could not be found. Speak to a partner.",
  confirm: "The confirmation link is invalid or has expired. Sign in to request a new one.",
  idle: "You were signed out after 30 minutes without activity.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-base text-ink-2">Use your firm email address.</p>
      </div>
      {sp.error && ERRORS[sp.error] ? <Notice tone={sp.error === "idle" ? "info" : "danger"}>{ERRORS[sp.error]}</Notice> : null}
      <ActionForm action={signIn} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </Field>
        <Field label="Password" htmlFor="password" hint={<Link href="/reset" className="text-accent hover:underline">Forgot your password?</Link>}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Submit className="mt-2 w-full" pendingText="Signing in…">
          Sign in
        </Submit>
      </ActionForm>
      <p className="text-sm text-ink-2">
        First time here?{" "}
        <Link href="/signup" className="font-medium text-accent underline">
          Create your staff account
        </Link>
        . A partner must add your email to the staff list first.
      </p>
    </div>
  );
}
