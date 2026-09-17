# ApplyMate Privacy

Version 0.1.0. Updated September 16, 2026.

ApplyMate does not operate a server, collect analytics, or send resumes to an AI provider. It processes imported PDF and DOCX files locally. It stores the saved profile in Chrome extension local storage and can store one saved resume file locally on the current device for application uploads.

When you request filling, the extension reads the active application's field labels and controls, then inserts matching saved information. When a supported resume upload field is detected and a saved resume is available, ApplyMate can attach that local file to the form. Information placed into a third-party form is available to that website and is subject to the website's own data handling, even before final submission.

## Permissions

- **Storage:** save the profile and saved resume locally and keep temporary tab/frame references during this browser session.
- **activeTab and scripting:** inspect and fill the tab after you activate the extension.
- **Side panel:** display application progress and controls beside the website.
- **Optional site access:** access embedded application frames only after you grant their origin. Granted site access can be revoked in Chrome's extension settings.

Local profile storage, saved resume storage, and exported JSON backups are not encrypted by ApplyMate. Protect access to your browser and backups. There is no cloud backup, and removing the extension or clearing its data may erase the profile and saved resume. Exported profile backups do not include the resume file.

You can export a backup, import a versioned backup, or delete all ApplyMate data from **Data & settings**. Deletion stops tracked application runs and removes local profile data and temporary references. It cannot retract information already filled into a website or delete backups you exported.

The browser-only development preview uses a separate localStorage profile. Deleting extension data does not delete preview data, and vice versa.

This project has not been submitted to the Chrome Web Store. Before public publication, the publisher must provide a public privacy-policy URL, a contact channel, and accurate store disclosures matching this implementation.
