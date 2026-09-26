import { requireStaff, ROLE_LABEL } from "@/lib/session";
import { ActionForm, Submit } from "@/components/action-form";
import { Dl, Field, Input, Notice, PageHeader, Section, when } from "@/components/ui";
import { saveProfile, changePassword } from "./actions";

export const metadata = { title: "Your profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ setup?: string; password?: string }> }) {
  const sp = await searchParams;
  const { profile } = await requireStaff({ allowIncompleteProfile: true });
  return (
    <div className="max-w-[640px]">
      <PageHeader title="Your profile" description="Your name and initials are stamped on every upload attestation, working paper and sign-off." />
      {sp.setup ? <div className="mb-6"><Notice tone="warn" title="Complete your profile to continue">Enter your full name and initials before using the platform.</Notice></div> : null}
      <ActionForm action={saveProfile} className="flex flex-col gap-4">
        <input type="hidden" name="setup" value={sp.setup ? "1" : ""} />
        <Field label="Full name" htmlFor="full_name"><Input id="full_name" name="full_name" defaultValue={profile.full_name} required /></Field>
        <Field label="Initials" htmlFor="initials"><Input id="initials" name="initials" defaultValue={profile.initials} maxLength={6} required className="uppercase" /></Field>
        <div><Submit>Save profile</Submit></div>
      </ActionForm>
      <div className="mt-10">
        <Section title="Account">
          <Dl items={[["Email", profile.email], ["Role", ROLE_LABEL[profile.role]], ["Last sign-in", when(profile.last_login_at) || "-"]]} />
        </Section>
        <Section title="Change password" description="Your password is also your electronic signature for attestations and sign-offs. Never share it.">
          {sp.password === "reset" ? <div className="mb-4"><Notice tone="info">You arrived from a reset link: set a new password below within 15 minutes.</Notice></div> : null}
          <ActionForm action={changePassword} resetOnOk className="flex max-w-[420px] flex-col gap-4">
            {sp.password !== "reset" ? <Field label="Current password" htmlFor="current_password"><Input id="current_password" name="current_password" type="password" autoComplete="current-password" /></Field> : null}
            <Field label="New password" htmlFor="new_password" hint="At least 12 characters."><Input id="new_password" name="new_password" type="password" autoComplete="new-password" minLength={12} required /></Field>
            <Field label="Repeat new password" htmlFor="confirm_password"><Input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" minLength={12} required /></Field>
            <div><Submit variant="secondary">Change password</Submit></div>
          </ActionForm>
        </Section>
      </div>
    </div>
  );
}
