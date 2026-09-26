import Link from "next/link";
import { ActionForm, Submit } from "@/components/action-form";
import { Field, Input } from "@/components/ui";
import { requestReset } from "../actions";

export const metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-base text-ink-2">We will email a link that lets you set a new password.</p>
      </div>
      <ActionForm action={requestReset} className="flex flex-col gap-4">
        <Field label="Firm email" htmlFor="email"><Input id="email" name="email" type="email" required autoFocus /></Field>
        <Submit className="w-full" pendingText="Sending…">Send reset link</Submit>
      </ActionForm>
      <p className="text-sm text-ink-2"><Link href="/login" className="font-medium text-accent underline">Back to sign in</Link></p>
    </div>
  );
}
