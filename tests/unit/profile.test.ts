import { describe, expect, it } from "vitest";
import {
  emptyProfile,
  newEmployment,
  parseBackup,
  validateProfile,
} from "../../src/shared/profile";
import { extractResumeText, mergeResume } from "../../src/shared/resume";
describe("profile and resume import", () => {
  it("round trips a versioned profile without losing user information", () => {
    const p = emptyProfile();
    p.personal.firstName = "Ada";
    p.employment = [{ ...newEmployment(), company: "Acme", title: "Engineer" }];
    expect(parseBackup(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it("upgrades older version 1 backups with newly added local fields", () => {
    const p = emptyProfile();
    const legacy = JSON.parse(JSON.stringify(p));
    delete legacy.personal.preferredName;
    delete legacy.answers.heardAbout;
    delete legacy.answers.gender;
    delete legacy.answers.hispanicLatino;
    delete legacy.answers.veteranStatus;
    delete legacy.answers.disabilityStatus;
    const parsed = parseBackup(legacy);
    expect(parsed.personal.preferredName).toBe("");
    expect(parsed.answers.heardAbout).toBe("");
    expect(parsed.answers.gender).toBe("");
    expect(parsed.answers.hispanicLatino).toBe("");
    expect(parsed.answers.veteranStatus).toBe("");
    expect(parsed.answers.disabilityStatus).toBe("");
  });
  it("rejects incompatible backups and invalid shapes", () => {
    expect(() => parseBackup({ schemaVersion: 2 })).toThrow("version");
    expect(() =>
      parseBackup({ schemaVersion: 1, personal: { firstName: 123 } }),
    ).toThrow();
  });
  it("validates email, links and chronological dates", () => {
    const p = emptyProfile();
    p.personal.email = "bad";
    p.personal.website = "javascript:alert(1)";
    p.employment = [
      { ...newEmployment(), startDate: "2025-02", endDate: "2024-01" },
    ];
    expect(validateProfile(p)).toHaveLength(3);
  });
  it("extracts a simple resume and leaves uncertain dates empty", () => {
    const draft = extractResumeText(
      "Ada Lovelace\nada@example.com\n(415) 555-0100\nExperience\nEngineer | Acme\nEducation\nExample University\nBachelor of Science\nSkills\nTypeScript, SQL",
    );
    expect(draft.personal.firstName).toBe("Ada");
    expect(draft.personal.email).toBe("ada@example.com");
    expect(draft.employment[0].company).toBe("Acme");
    expect(draft.employment[0].startDate).toBe("");
    expect(draft.education[0].school).toBe("Example University");
  });
  it("preserves existing fields and histories unless replacement is chosen", () => {
    const p = emptyProfile();
    p.personal.firstName = "Manual";
    p.employment = [{ ...newEmployment(), company: "Original" }];
    const draft = extractResumeText(
      "Ada Lovelace\nada@example.com\nExperience\nEngineer | Acme",
    );
    expect(mergeResume(p, draft, false).personal.firstName).toBe("Manual");
    expect(mergeResume(p, draft, false).employment[0].company).toBe("Original");
    expect(mergeResume(p, draft, true).personal.firstName).toBe("Ada");
    expect(p.personal.firstName).toBe("Manual");
  });
  it("rejects scanned or empty text", () =>
    expect(() => extractResumeText("  ")).toThrow("No readable"));
});
