import { newEducation, newEmployment, type ApplicantProfile } from "./profile";
export interface ResumeImportDraft {
  personal: Partial<ApplicantProfile["personal"]>;
  skills?: string;
  employment: ApplicantProfile["employment"];
  education: ApplicantProfile["education"];
  warnings: string[];
}
export function extractResumeText(raw: string): ResumeImportDraft {
  const lines = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const text = lines.join("\n");
  if (text.replace(/\s/g, "").length < 30)
    throw new Error(
      "No readable resume text found. Scanned PDFs need OCR; please enter your profile manually.",
    );
  const draft: ResumeImportDraft = {
    personal: {},
    employment: [],
    education: [],
    warnings: [
      "Review every suggestion. Dates and complex layouts may need correction.",
    ],
  };
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = text.match(
    /(?:\+1[ .-]?)?(?:\(\d{3}\)|\b\d{3})[ .-]\d{3}[ .-]\d{4}\b/,
  )?.[0];
  if (email) draft.personal.email = email;
  if (phone) draft.personal.phone = phone;
  const linkedin = text.match(
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i,
  )?.[0];
  if (linkedin)
    draft.personal.linkedin = linkedin.startsWith("http")
      ? linkedin
      : `https://${linkedin}`;
  const name = lines
    .slice(0, 3)
    .find(
      (l) =>
        /^[A-Za-z][A-Za-z.'-]+(?: [A-Za-z][A-Za-z.'-]+){1,3}$/.test(l) &&
        !/resume|curriculum|engineer|developer|designer|manager/i.test(l),
    );
  if (name) {
    const parts = name.split(" ");
    draft.personal.firstName = parts.shift();
    draft.personal.lastName = parts.join(" ");
  }
  let section = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(?:technical )?skills\s*:?$/i.test(line)) {
      section = "skills";
      continue;
    }
    if (/^(?:work |professional )?experience\s*:?$/i.test(line)) {
      section = "employment";
      continue;
    }
    if (/^education\s*:?$/i.test(line)) {
      section = "education";
      continue;
    }
    if (
      /^(projects|certifications|awards|summary|publications)\s*:?$/i.test(line)
    ) {
      section = "";
      continue;
    }
    if (section === "skills")
      draft.skills = [draft.skills, line].filter(Boolean).join(", ");
    if (section === "employment" && /\s(?:at|\||@)\s/.test(line)) {
      const [title, company] = line.split(/\s(?:at|\||@)\s/, 2);
      const row = newEmployment();
      row.title = title;
      row.company = company;
      draft.employment.push(row);
    }
    if (
      section === "education" &&
      /university|college|institute|school/i.test(line)
    ) {
      const row = newEducation();
      row.school = line;
      const next = lines[i + 1] || "";
      if (/bachelor|master|ph\.?d|associate|b\.s|m\.s/i.test(next))
        row.degree = next;
      draft.education.push(row);
    }
  }
  return draft;
}
export function mergeResume(
  profile: ApplicantProfile,
  draft: ResumeImportDraft,
  replace: boolean,
): ApplicantProfile {
  const result = structuredClone(profile);
  for (const [key, value] of Object.entries(draft.personal))
    if (
      value?.trim() &&
      (replace || !result.personal[key as keyof typeof result.personal])
    )
      result.personal[key as keyof typeof result.personal] = value.trim();
  if (draft.skills?.trim() && (replace || !result.skills))
    result.skills = draft.skills.trim();
  if (draft.employment.length && (replace || !result.employment.length))
    result.employment = draft.employment;
  if (draft.education.length && (replace || !result.education.length))
    result.education = draft.education;
  return result;
}
export async function readResume(file: File): Promise<ResumeImportDraft> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a resume smaller than 10 MB.");
  const buffer = await file.arrayBuffer();
  let text = "";
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = (
      await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ).default;
    const task = pdfjs.getDocument({ data: buffer });
    const document = await task.promise;
    try {
      if (document.numPages > 30)
        throw new Error("Choose a resume with 30 pages or fewer.");
      for (let i = 1; i <= document.numPages; i++) {
        const page = await document.getPage(i);
        const content = await page.getTextContent();
        text +=
          content.items
            .map((item) =>
              "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
            )
            .join("") + "\n";
      }
    } finally {
      await task.destroy();
    }
  } else if (/\.docx$/i.test(file.name)) {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
  } else throw new Error("Choose a PDF or DOCX resume.");
  return extractResumeText(text);
}
