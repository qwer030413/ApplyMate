import { z } from "zod";
const text = z.string().max(20000);
const id = z.string().min(1).max(100);
export const employmentSchema = z.object({
  id,
  company: text,
  title: text,
  location: text,
  startDate: text,
  endDate: text,
  current: z.boolean(),
  description: text,
});
export const educationSchema = z.object({
  id,
  school: text,
  degree: text,
  field: text,
  startDate: text,
  endDate: text,
  gpa: text,
});
const aiModeDefault = {
  enabled: false,
  APIkey: "",
  workAuthorization: true,
  salaryExpectations: false,
  sensitiveQuestions: false,
};
export const profileSchema = z.object({
  schemaVersion: z.literal(1),
  personal: z.object({
    firstName: text,
    lastName: text,
    preferredName: text.default(""),
    email: text,
    phone: text,
    address: text,
    city: text,
    state: text,
    postalCode: text,
    country: text,
    linkedin: text,
    website: text,
  }),
  employment: z.array(employmentSchema).max(100),
  education: z.array(educationSchema).max(100),
  skills: text,
  answers: z.object({
    authorizedUS: z.enum(["", "Yes", "No"]),
    sponsorship: z.enum(["", "Yes", "No"]),
    heardAbout: text.default(""),
    gender: text.default(""),
    hispanicLatino: text.default(""),
    race: text.default(""),
    veteranStatus: text.default(""),
    disabilityStatus: text.default(""),
  }),
  aiMode: z.object({
    enabled: z.boolean(),
    APIkey: text.default(""),
    workAuthorization: z.boolean(),
    salaryExpectations: z.boolean(),
    sensitiveQuestions: z.boolean(),
  }).default(aiModeDefault),
  savedAnswers: z
    .array(z.object({ id, question: text, answer: text }))
    .max(100),
});
export type ApplicantProfile = z.infer<typeof profileSchema>;
export type Employment = z.infer<typeof employmentSchema>;
export type Education = z.infer<typeof educationSchema>;
export function emptyProfile(): ApplicantProfile {
  return {
    schemaVersion: 1,
    personal: {
      firstName: "",
      lastName: "",
      preferredName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      postalCode: "",
      country: "United States",
      linkedin: "",
      website: "",
    },
    employment: [],
    education: [],
    skills: "",
    answers: {
      authorizedUS: "",
      sponsorship: "",
      heardAbout: "",
      gender: "",
      hispanicLatino: "",
      race: "",
      veteranStatus: "",
      disabilityStatus: "",
    },
    aiMode: {
      enabled: false,
      APIkey : "",
      workAuthorization: true,
      salaryExpectations: false,
      sensitiveQuestions: false,
    },
    savedAnswers: [],
  };
}
export function newEmployment(): Employment {
  return {
    id: crypto.randomUUID(),
    company: "",
    title: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
  };
}
export function newEducation(): Education {
  return {
    id: crypto.randomUUID(),
    school: "",
    degree: "",
    field: "",
    startDate: "",
    endDate: "",
    gpa: "",
  };
}
export function parseBackup(value: unknown): ApplicantProfile {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1
  )
    throw new Error(
      "This backup version is not supported. Choose an ApplyMate version 1 backup.",
    );
  return profileSchema.parse(value);
}
export function readiness(profile: ApplicantProfile) {
  const missing = ["firstName", "lastName", "email", "phone"].filter(
    (k) => !profile.personal[k as keyof typeof profile.personal].trim(),
  );
  return { complete: 4 - missing.length, total: 4, missing };
}
export function validateProfile(profile: ApplicantProfile): string[] {
  const errors: string[] = [];
  if (
    profile.personal.email &&
    !z.string().email().safeParse(profile.personal.email).success
  )
    errors.push("Enter a valid email address.");
  for (const key of ["linkedin", "website"] as const)
    if (
      profile.personal[key] &&
      !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(profile.personal[key])
    )
      errors.push(
        `${key === "linkedin" ? "LinkedIn" : "Website"} must be a full http or https URL.`,
      );
  for (const row of [...profile.employment, ...profile.education])
    if (
      row.startDate &&
      row.endDate &&
      !("current" in row && row.current) &&
      row.endDate < row.startDate
    )
      errors.push("An end date cannot precede its start date.");
  return errors;
}
