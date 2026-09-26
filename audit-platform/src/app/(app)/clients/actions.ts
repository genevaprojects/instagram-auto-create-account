"use server";
import { staffAction, must, str, optStr } from "@/lib/actions-core";

export const createClientAction = staffAction(async ({ supabase }, fd) => {
  const name = str(fd, "name");
  if (!name) return { error: "Enter the company name." };
  const directors = str(fd, "directors").split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  must(
    await supabase.from("clients").insert({
      name,
      registration_no: optStr(fd, "registration_no"),
      principal_activity: optStr(fd, "principal_activity"),
      framework: str(fd, "framework") === "MFRS" ? "MFRS" : "MPERS",
      registered_address: optStr(fd, "registered_address"),
      business_address: optStr(fd, "business_address"),
      contact_person: optStr(fd, "contact_person"),
      contact_phone: optStr(fd, "contact_phone"),
      contact_email: optStr(fd, "contact_email"),
      directors,
    }),
  );
  return { ok: `${name} added.` };
}, "/clients");
