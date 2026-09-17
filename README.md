# ApplyMate

A local-first Chrome extension for saved job profiles, PDF/DOCX resume import, and assisted application filling. Built with React, TypeScript, Vite, and Manifest V3. This is an early-access implementation, not a claim of universal ATS compatibility.

## Install in Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `C:\Users\Seojin Park\Desktop\Coding\ApplyMate\dist`.
3. Open ApplyMate's **Extension options** to create a profile, or use the settings icon in its side panel. Save your changes.
4. Open an application and click the ApplyMate toolbar icon. Use **Fill this page** or **Start assisted apply**.
5. Review paused fields. Complete unsupported uploads, verification, declarations, and the final submission yourself.

For an embedded application, use the panel's **Embedded form access** control to grant that specific origin, then select the application frame. After a full page reload, reconnect and explicitly resume. The extension does not resume automatically.

The ZIP in `release/` contains the same unpacked extension. Extract it before using Load unpacked. It is not published in the Chrome Web Store.

## Develop

Requires Node.js 22.13+ (tested with Node 24) and current desktop Chrome.

```powershell
npm ci
npm run build
npm test
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.cache\browsers"
npx playwright install chromium
npm run test:e2e
npm run package
```

`npm run dev` opens the profile UI through Vite (visit `/options.html`). Browser-preview data uses localStorage and is separate from the installed extension's data. Application filling requires the installed extension. Reload the extension in Chrome after rebuilding.

## Behavior

- One local profile, with repeatable employment/education and exact-question saved answers.
- PDF and DOCX text extraction stays on the device. Users can save one resume file locally for supported application upload fields and choose separately whether that file should update the profile. Import creates editable suggestions. Merging preserves existing fields and histories unless replacement is explicitly selected. Save after reviewing the merged profile.
- Basic resume heuristics suggest names, email, US-format phone numbers, LinkedIn, skills, simple `Title | Company` entries, and education. Complex layouts and dates require manual correction. Scanned PDFs, OCR, legacy DOC files, and AI extraction are not supported.
- Dedicated platform configuration covers Greenhouse, SmartRecruiters, and Workday. Common form semantics provide a manual-trigger fallback on other sites. See [SUPPORT.md](SUPPORT.md) for evidence and limitations.
- Only exact, confident values are filled. Existing answers stay intact. Dates with insufficient precision and options without an exact match remain unresolved.
- Assisted runs are scoped to a tab/frame/document. Pause and Stop cancel remaining actions. Unknown questions, native validation errors, login, CAPTCHA, unsupported uploads, and declarations pause a run. Ambiguous transitions are never clicked.
- The run stops at recognizable review/submission controls, repeated steps, an eight-second transition timeout, or a 20-step limit. The user always submits.
- Work eligibility, sponsorship, application source, and voluntary self-identification answers come only from explicitly saved profile values. Consent, signatures, attestations, and unrelated sensitive declarations are manual. No generated qualifications or essays.

## Architecture

`src/shared` defines versioned profiles, storage, resume drafts/merging, and deterministic field matching. `src/extension` holds the background broker, platform adapters, and document-scoped run controller. `src/ui` contains the editor and side panel.

The service worker owns profile access. Content scripts send field descriptors and receive only matched values plus history counts. Storage is restricted to trusted extension contexts. Test fixtures grant host access only in a temporary test manifest; the production manifest uses `activeTab` and optional, per-origin grants.

No account, backend, analytics, cloud sync, or Web Store publication is included.

## Tests

Vitest covers profile validation/version compatibility, backup round trips, resume extraction/merging, host matching, and conservative answer matching. Playwright loads the built extension into isolated Chromium and exercises controlled fixtures, real PDF/DOCX imports, responsive screenshots, interruption, reloads, and embedded forms.

`node scripts/live-inspect.mjs` performs read-only inspection of documented public examples and writes a local report. It does not fill fields, create accounts, submit applications, or prove end-to-end compatibility.
