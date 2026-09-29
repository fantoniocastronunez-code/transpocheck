# User Preferences & App Rules

1. **Version Bumps on Changes:** Every time significant changes are made or before a git commit/deploy, ALWAYS increment the app version number located in `App.jsx`.
2. **Native UI Only:** ALL alerts, confirms, and dialogs must use the app's native UI (e.g., custom modals, `showAlert()`, `showConfirmDialog()`). NEVER use native browser `window.alert`, `window.confirm`, or `window.prompt`.
3. **Traceable Errors:** EVERY time an error is handled or shown to the user (e.g., photo upload failure, database save error, validation error), it MUST include a unique identifying code (e.g., `[ERR-SAVE-01]`, `[ERR-PHOTO-UPLOAD]`, `[ERR-DB-02]`) so the issue can be easily traced back to the exact line of code.
