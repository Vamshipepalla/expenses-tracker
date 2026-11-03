# Spendwise — Obsidian Aurora

A static personal finance tracker built with plain HTML, CSS and JavaScript.

## Files
- `index.html` — page structure and UI.
- `styles.css` — Obsidian Aurora glass theme.
- `app.js` — transaction logic, dashboard, analytics and backups.

## Deploy to GitHub Pages
1. Download and extract the ZIP.
2. In your `expenses-tracker` repository, replace/add these three files at the repository root.
3. Keep the filenames exactly as shown.
4. Commit to the branch and folder configured in GitHub Pages (currently expected to be `main` / root).
5. Wait for the Pages deployment to finish, then hard refresh the site.

## Existing data compatibility
The app continues to use the existing localStorage key `daily-expenses-v1`.
Existing records with no `type` field are treated as expenses. New income records use `type: "income"`.

**Before replacing the live app:** open the existing site on the device containing your expenses and download a JSON backup. Do not clear browser data. Local storage is scoped to the website origin and browser profile; the same public URL does not synchronize data between devices.

## Important
- Currency selection changes the displayed symbol only; it does not convert amounts.
- Data is stored locally in the browser. There is no cloud sync or account system.
- JSON import merges records by ID and skips duplicates.
