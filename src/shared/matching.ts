import type { ApplicantProfile } from "./profile";
import type { DetectedField, FieldAssignment } from "./types";
export const normalize = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function sensitive(label: string): boolean {
  return /gender|sex\b|sexual|race\b|racial|ethnic|veteran|disabilit|demographic|signature|certif(y|ication of)|attest|consent|agree|acknowledge|privacy|terms|background check|social security|ssn\b|date of birth|birth date/i.test(
    label,
  );
}
function personalKey(
  label: string,
): keyof ApplicantProfile["personal"] | undefined {
  const rules: [RegExp, keyof ApplicantProfile["personal"]][] = [
    [/^(first|given|legal first) name$/, "firstName"],
    [/^(last|family|surname|legal last)( name)?$/, "lastName"],
    [/^(preferred|chosen)( name)?$/, "preferredName"],
    [/^(e mail|email)( address)?$/, "email"],
    [/^(phone|mobile|telephone)( number)?$/, "phone"],
    [/^linkedin( profile| url)?$/, "linkedin"],
    [/^(website|portfolio|personal website)( url)?$/, "website"],
    [/^(street address|address line 1|address 1|address)$/, "address"],
    [/^(city|town)$/, "city"],
    [/^(state|province|state province)$/, "state"],
    [/^(zip|zip code|postal code|zip postal code)$/, "postalCode"],
    [/^(country|country region)$/, "country"],
  ];
  return rules.find(([rule]) => rule.test(label))?.[1];
}
export function explicitAnswerKey(
  label: string,
): keyof ApplicantProfile["answers"] | undefined {
  const rules: [RegExp, keyof ApplicantProfile["answers"]][] = [
    [
      /^(how did you hear about (this|the) (job|position|role|opportunity)|source|job source|referral source)$/,
      "heardAbout",
    ],
    [/^(gender|gender identity|what is your gender)$/, "gender"],
    [
      /^(are you )?(hispanic( or latino)?|latino( or hispanic)?|hispanic latino)( ethnicity)?$/,
      "hispanicLatino",
    ],
    [
      /^(protected )?veteran( status)?$|^are you a protected veteran$|^veteran self identification$/,
      "veteranStatus",
    ],
    [
      /^disability( status)?$|^do you have a disability$|^voluntary self identification of disability$/,
      "disabilityStatus",
    ],
  ];
  return rules.find(([rule]) => rule.test(label))?.[1];
}
export function matchField(
  field: DetectedField,
  profile: ApplicantProfile,
): FieldAssignment {
  const label = normalize(
    field.label.replace(/\*/g, "").replace(/\b(required|optional)\b/gi, ""),
  );
  const no = (reason: string): FieldAssignment => ({ id: field.id, reason });
  if (field.type === "file") return no("Attach this document yourself.");
  if (field.type === "password") return no("Complete sign-in yourself.");
  let value: string | undefined;
  const section = normalize(field.section);
  const employment = /experience|employment|work history/.test(section);
  const education = /education/.test(section);
  if (employment) {
    const row = profile.employment[field.index];
    if (!row) return no("Add this employment entry to your profile.");
    if (/^(company|employer|organization)( name)?$/.test(label))
      value = row.company;
    else if (/^(job title|title|position)$/.test(label)) value = row.title;
    else if (/^(location|city)$/.test(label)) value = row.location;
    else if (/^(description|role description|responsibilities)$/.test(label))
      value = row.description;
    else if (/^(start date|from)$/.test(label)) value = row.startDate;
    else if (/^(end date|to)$/.test(label))
      value = row.current ? "" : row.endDate;
    else if (/currently work|current job|present employer/.test(label))
      value = row.current ? "Yes" : "No";
  } else if (education) {
    const row = profile.education[field.index];
    if (!row) return no("Add this education entry to your profile.");
    if (/^(school|university|college|institution)( name)?$/.test(label))
      value = row.school;
    else if (/^(degree|degree type)$/.test(label)) value = row.degree;
    else if (/^(field of study|major|discipline)$/.test(label))
      value = row.field;
    else if (/^(gpa|grade point average)$/.test(label)) value = row.gpa;
    else if (/^(start date|from)$/.test(label)) value = row.startDate;
    else if (/^(end date|graduation date|to)$/.test(label)) value = row.endDate;
  } else {
    const key = personalKey(label);
    const answerKey = explicitAnswerKey(label);
    if (key) value = profile.personal[key];
    else if (answerKey) value = profile.answers[answerKey];
    else if (
      /^(full|legal|preferred) name$/.test(label) &&
      !label.startsWith("preferred")
    )
      value = [profile.personal.firstName, profile.personal.lastName]
        .filter(Boolean)
        .join(" ");
    else if (/^(skills|technical skills)$/.test(label)) value = profile.skills;
    else if (
      /authoriz|legally.*work|eligible.*work/.test(label) &&
      /united states|\bus\b|\bu s\b/.test(label) &&
      !/not |unauthorized/.test(label)
    )
      value = profile.answers.authorizedUS;
    else if (
      /(sponsor|visa)/.test(label) &&
      !/not require|no sponsor|without/.test(label)
    )
      value = profile.answers.sponsorship;
  }
  if (value === undefined && sensitive(label))
    return no("Review this declaration yourself.");
  if (value === undefined)
    value = profile.savedAnswers.find(
      (answer) => normalize(answer.question) === label,
    )?.answer;
  if (!value?.trim()) return no("No confident saved answer.");
  return { id: field.id, value };
}
