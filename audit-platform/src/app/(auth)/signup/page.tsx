import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { signUp } from "../actions";

export const metadata = { title: "Create staff account" };

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create your staff account</h1>
        <p className="mt-1 text-base text-ink-2">Only emails a partner has added to the staff list can register.</p>
      </div>
      <ActionForm action={signUp} className="flex flex-col gap-4" resetOnOk>
        <Field label="Full name" htmlFor="full_name" hint="Exactly as it should appear on sign-offs.">
          <Input id="full_name" name="full_name" autoComplete="name" required />
        </Field>
        <Field label="Initials" htmlFor="initials" hint="As you initial working papers, e.g. AL or KCT.">
          <Input id="initials" name="initials" required maxLength={6} className="uppercase" />
        </Field>
        <Field label="Firm email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 12 characters. It is also your signing password.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
        </Field>
        <Submit className="mt-2 w-full" pendingText="Creating account…">
          Create account
        </Submit>
      </ActionForm>
      <p className="text-sm text-ink-2">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-accent underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
