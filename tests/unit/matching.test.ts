import { describe, expect, it } from "vitest";
import { emptyProfile, newEmployment } from "../../src/shared/profile";
import { matchField } from "../../src/shared/matching";
import { detectPlatform } from "../../src/extension/adapters";
import type { DetectedField } from "../../src/shared/types";
const field = (
  label: string,
  extra: Partial<DetectedField> = {},
): DetectedField => ({
  id: "f",
  label,
  section: "",
  index: 0,
  type: "text",
  required: false,
  filled: false,
  options: [],
  ...extra,
});
describe("field matching", () => {
  it("uses exact known contact labels and refuses unrelated questions", () => {
    const p = emptyProfile();
    p.personal.firstName = "Ada";
    expect(matchField(field("First name *"), p).value).toBe("Ada");
    expect(
      matchField(field("First name of your manager"), p).value,
    ).toBeUndefined();
  });
  it("matches repeated employment by section and position", () => {
    const p = emptyProfile();
    p.employment = [
      { ...newEmployment(), company: "First" },
      { ...newEmployment(), company: "Second" },
    ];
    expect(
      matchField(field("Company", { section: "employment", index: 1 }), p)
        .value,
    ).toBe("Second");
  });
  it("never infers sensitive declarations, even from saved answers", () => {
    const p = emptyProfile();
    p.savedAnswers = [
      { id: "1", question: "I consent to the terms", answer: "Yes" },
    ];
    expect(
      matchField(field("I consent to the terms"), p).value,
    ).toBeUndefined();
    p.savedAnswers = [
      {
        id: "2",
        question: "What is your sexual orientation?",
        answer: "Prefer not to say",
      },
    ];
    expect(
      matchField(field("What is your sexual orientation?"), p).value,
    ).toBeUndefined();
  });
  it("requires explicit authorization and exact saved custom answers", () => {
    const p = emptyProfile();
    expect(
      matchField(field("Are you authorized to work in the United States?"), p)
        .value,
    ).toBeUndefined();
    p.answers.authorizedUS = "Yes";
    expect(
      matchField(field("Are you authorized to work in the United States?"), p)
        .value,
    ).toBe("Yes");
    expect(
      matchField(field("Are you authorized to work in Canada?"), p).value,
    ).toBeUndefined();
    p.savedAnswers = [
      {
        id: "1",
        question: "Why this company?",
        answer: "I value your research.",
      },
    ];
    expect(matchField(field("Why this company?"), p).value).toBe(
      "I value your research.",
    );
    expect(matchField(field("Why this role?"), p).value).toBeUndefined();
  });
  it("matches explicit profile answers for source and voluntary identification", () => {
    const p = emptyProfile();
    p.personal.preferredName = "Ada";
    p.answers.heardAbout = "LinkedIn";
    p.answers.gender = "Prefer not to answer";
    p.answers.hispanicLatino = "No";
    p.answers.veteranStatus = "I am not a protected veteran";
    p.answers.disabilityStatus = "No, I do not have a disability";
    expect(matchField(field("Preferred name"), p).value).toBe("Ada");
    expect(matchField(field("How did you hear about this job?"), p).value).toBe(
      "LinkedIn",
    );
    expect(matchField(field("Gender"), p).value).toBe("Prefer not to answer");
    expect(matchField(field("Hispanic / Latino"), p).value).toBe("No");
    expect(matchField(field("Veteran status"), p).value).toBe(
      "I am not a protected veteran",
    );
    expect(matchField(field("Disability status"), p).value).toBe(
      "No, I do not have a disability",
    );
  });
  it("detects platform hosts without matching spoofed suffixes", () => {
    expect(detectPlatform("boards.greenhouse.io")).toBe("greenhouse");
    expect(detectPlatform("acme.wd5.myworkdayjobs.com")).toBe("workday");
    expect(detectPlatform("jobs.smartrecruiters.com")).toBe("smartrecruiters");
    expect(detectPlatform("greenhouse.io.example.com")).toBe("generic");
  });
});
