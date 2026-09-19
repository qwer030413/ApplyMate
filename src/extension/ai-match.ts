import type { ApplicantProfile } from "../shared/profile";
import type { DetectedField, FieldAssignment } from "../shared/types";
import { normalize, sensitive } from "../shared/matching";

type AiMatchResponse = {
  value: string | null;
  source: string | null;
  confidence: "low" | "medium" | "high";
  reason: string;
};

const AI_MODEL = "your-light-model-name";
function profileSummary(profile: ApplicantProfile) {
  return {
    personal: profile.personal,
    answers: profile.answers,
    skills: profile.skills,
    employment: profile.employment.map((row) => ({
      company: row.company,
      title: row.title,
      location: row.location,
      startDate: row.startDate,
      endDate: row.current ? "Present" : row.endDate,
    })),
    education: profile.education.map((row) => ({
      school: row.school,
      degree: row.degree,
      field: row.field,
      gpa: row.gpa,
    })),
    savedAnswers: profile.savedAnswers,
  };
}



function aiAllowedForField(field: DetectedField, profile: ApplicantProfile) {
  if (!profile.aiMode.enabled || !profile.aiMode.APIkey.trim()) return false;
  if (field.type === "file" || field.type === "password") return false;

  const label = normalize(field.label);

  if (
    /signature|attest|certif|consent|agree|acknowledge|privacy|terms|ssn|social security|birth/.test(
      label,
    )
  ) {
    return false;
  }

  if (/authoriz|sponsor|visa/.test(label)) {
    return profile.aiMode.workAuthorization;
  }

  if (/salary|compensation|pay expectation/.test(label)) {
    return profile.aiMode.salaryExpectations;
  }

  if (sensitive(label)) {
    return profile.aiMode.sensitiveQuestions;
  }

  return true;
}

export async function aiMatchField(
  field: DetectedField,
  profile: ApplicantProfile,
): Promise<FieldAssignment | null> {
  if (!aiAllowedForField(field, profile)) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${profile.aiMode.APIkey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: "Match this job application field to saved profile data.",
                rules: [
                  "Use only the provided profile data.",
                  "Do not invent answers.",
                  "Do not infer demographics from name, school, location, or work history.",
                  "Do not answer consent, signature, certification, legal attestation, SSN, or birth-date fields.",
                  "If the profile does not contain the answer, return value null.",
                  "For dropdowns/radios, return exactly one provided option.",
                  "Return JSON only.",
                ],
                field,
                profile: profileSummary(profile),
              }),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const data = await response.json();
  const text = data.output_text || "";
  const parsed = JSON.parse(text) as AiMatchResponse;

  return validateAiMatch(field, parsed);
}

function validateAiMatch(
  field: DetectedField,
  ai: AiMatchResponse,
): FieldAssignment | null {
  if (!ai.value?.trim()) return null;
  if (ai.confidence !== "high") return null;

  if (field.options.length) {
    const exact = field.options.find(
      (option) => normalize(option) === normalize(ai.value!),
    );

    if (!exact) return null;

    return {
      id: field.id,
      value: exact,
      reason: `AI matched from ${ai.source}: ${ai.reason}`,
    };
  }

  return {
    id: field.id,
    value: ai.value,
    reason: `AI matched from ${ai.source}: ${ai.reason}`,
  };
}