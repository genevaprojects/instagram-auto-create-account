export function uploadDeclaration(o: { name: string; initials: string; client: string; filename: string; sha256: string }) {
  return `I, ${o.name} (${o.initials}), confirm that I obtained "${o.filename}" from ${o.client} or its authorised representative, that it is complete and has not been altered by me, and that I am responsible for this upload. I understand that this attestation, my identity, the time, my IP address, my device and the file's SHA-256 fingerprint ${o.sha256} are permanently recorded in the firm's audit trail.`;
}

export function signoffStatement(stage: "preparer" | "reviewer" | "partner", o: { name: string; initials: string; client: string; yearEnd: string }) {
  const what = {
    preparer: "I prepared these working papers, the work described was performed and evidenced, and the conclusions are supported by the evidence on file",
    reviewer: "I have reviewed these working papers, all review points I raised are addressed, and the work supports the conclusions reached",
    partner: "I have reviewed the engagement, I am satisfied that sufficient appropriate audit evidence has been obtained in accordance with the ISAs as adopted by the MIA, and I approve the audit file for finalisation. The file will be locked",
  }[stage];
  return `I, ${o.name} (${o.initials}), confirm for ${o.client}, year ended ${o.yearEnd}: ${what}.`;
}
