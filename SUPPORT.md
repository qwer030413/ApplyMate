# Support and Verification

This is an early-access build. Platform detection and controlled-fixture tests are not a guarantee that every employer configuration works.

| Platform        | Controlled fixtures                                                                                              | Public-site inspection                                                                                | Release status                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Greenhouse      | Contact fields, existing answers, repeated entries, interruptions, sensitive fields, embedded forms, final stop  | Two public application pages exposed fields; no live filling/submission performed                     | Preview; employer-specific validation still needed |
| SmartRecruiters | Contact fields, exact custom dropdowns, intermediate navigation, final stop                                      | Two public job descriptions loaded, but exposed no usable application forms in the inspection session | Preview; live application flow unverified          |
| Workday         | Contact fields, repeated work history, intermediate navigation, stalled transitions, document reload, final stop | Two sampled pages exposed no usable application forms in the inspection session                       | Preview; live authenticated flow unverified        |
| Other websites  | User-triggered basic filling; automatic navigation refused                                                       | Not validated                                                                                         | Best effort                                        |

## Public Pages Inspected

Read-only browser inspection on September 16, 2026:

- Greenhouse: [CLEAR](https://job-boards.greenhouse.io/clear/jobs/8043865), [Job Corp sandbox](https://job-boards.greenhouse.io/jobcorpsandbox/jobs/5829867002).
- SmartRecruiters: [ServiceNow](https://jobs.smartrecruiters.com/ServiceNow/744000149338366-software-engineer), [Experian](https://jobs.smartrecruiters.com/Experian/744000143860629-software-engineer-i).
- Workday: [KBR](https://kbr.wd5.myworkdayjobs.com/en-US/KBR_Careers/job/Software-Engineer_R2114022), [Finastra](https://finastra.wd3.myworkdayjobs.com/en-US/FINC/job/Software-Engineer_REQ0326_0036639).

Postings can expire or change. These observations are not live end-to-end acceptance tests.

## Known Limits

- English form labels, US-focused work eligibility, one saved local profile.
- Unknown questions, ambiguous dates, virtualized dropdowns, closed shadow roots, and unmatched options require manual entry. No fuzzy guesses.
- Repeated entries are filled by displayed order. Recognizable Add Experience/Add Education controls can create missing rows; ambiguous Add buttons require manual use. Do not reorder application entries independently of the saved profile without reviewing the result.
- Saved resume upload is supported for clear resume/CV file inputs that accept PDF or DOCX. Cover letters, portfolios, transcripts, unsupported uploaders, and ambiguous file fields remain manual.
- Account creation/login, CAPTCHA, consent, signatures, attestations, and submission remain manual. Voluntary demographic/profile answers fill only from explicit saved values and still require user review before submission.
- All unresolved fields, including optional ones, pause assisted navigation. You may leave optional fields blank and advance manually, then resume.
- Full document navigation loses the run by design. Reconnect after navigation and explicitly start/resume.
- Permission is required for cross-origin application frames. Nested/inaccessible frames may need to be opened directly.
- No claim of universal ATS compatibility, Web Store approval, or completed live employer acceptance testing.

## Before Public Release

Use tester-owned accounts and profiles to validate at least two current employer configurations per platform, including Workday authenticated multi-step flows and SmartRecruiters' application form. Check validation behavior, custom dropdowns, dates, history entry order, iframe permissions, and final review without submitting. Record browser version, URL, date, matched/missed fields, and outcome. Fix failures and extend controlled regression fixtures before upgrading a platform from Preview.
