# Notevia — One Space. Endless Learning.

A digital workspace for learning and teaching: handwritten notebooks, PDF annotation, a document library, whiteboards, classrooms, assignments, a calendar and private-by-default sharing. It works for any subject and any level.

Built with React 18, TypeScript, Vite, Tailwind, Konva, PDF.js, pdf-lib, Tiptap and KaTeX. The backend is Supabase (Postgres with row-level security, Auth and private Storage). It is designed to be deployed on Netlify.

---

## 1. Try it locally (demo mode, no backend)

```bash
npm install
npm run dev            # http://localhost:5173
```

If Supabase keys aren't configured, Notevia runs in **demo mode**:

- All data is kept in your browser (IndexedDB).
- The app is preloaded with sample folders, PDFs, a PPTX, notebooks, a whiteboard, classrooms and assignments.
- On the sign-in page you can open the demo as an educator, a student, an individual or an admin.
- **Settings → Privacy → Reset demo data** restores the sample content.

`npm run build:demo` builds a single self-contained `dist-demo/index.html` file that runs the demo.

## 2. Connect Supabase (real accounts and storage)

1. Create a project at supabase.com.
2. Open **SQL Editor** and run all of `supabase/migrations/0001_notevia_schema.sql`. This creates:
   - every table, with row-level security
   - six **private** storage buckets
   - the access-check functions
   - the triggers that create a profile and workspace for each new user
3. Copy `.env.example` to `.env.local` and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   Only the **anon** key goes in the frontend. Never put the service-role key, or any AI key, in a `VITE_` variable.
4. In **Authentication → URL configuration**:
   - Set the Site URL to your domain.
   - Add `https://your-domain/reset-password` and `https://your-domain/app` to the redirect URLs.
5. Under **Authentication → Providers → Email**, keep "Confirm email" switched on. Under **Authentication → SMTP**, add your own SMTP provider so verification and reset emails are delivered reliably.
6. Sign up in the app. Then make yourself the platform administrator:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

### Edge Functions

```bash
supabase functions deploy delete-account      # self-service account deletion (UK GDPR)
supabase functions deploy notevia-ai          # optional AI assistant
supabase secrets set ANTHROPIC_API_KEY=...    # only if you enable AI
supabase secrets set AI_MODEL=claude-sonnet-4-5
```

To enable the AI panel, set `VITE_AI_ENABLED=true`. Before any document is sent, the panel shows users what will be sent and asks for consent.

### Google sign-in (optional)

1. Create OAuth credentials in Google Cloud.
2. Add them under **Authentication → Providers → Google**.
3. Set `VITE_GOOGLE_AUTH=true`.

## 3. Deploy to Netlify

Connect the repository; `netlify.toml` already contains the build command, the publish folder and the SPA redirect. Add the same `VITE_` environment variables in **Site settings → Environment variables**. The app installs as a PWA.

## 4. Privacy model

- Every file, notebook, page and link is private to its owner until it is shared.
- Users can share with a person (view, comment or edit) or with a classroom. Sharing a folder covers everything inside it.
- Students see only the classrooms they belong to and the materials shared with them. Educators see a student's notebook only when it is submitted for an assignment.
- Administrators manage accounts and platform settings. They cannot read user content.
- Storage is private. Files are delivered through short-lived signed URLs that are only issued after the same access checks.
- Users can export all their data (Settings → Privacy) and delete their account. The recycle bin keeps items for a retention period each user chooses.

Before going live, fill in the Privacy and Terms templates (`src/pages/Legal.tsx`) and the company details in `.env` (`VITE_SUPPORT_EMAIL`, `VITE_COMPANY_NAME`, `VITE_COMPANY_ADDRESS`).

## 5. What's in Phase 1

- **Notebooks:** ballpoint, fountain pen, pencil and highlighter with pressure sensitivity and palm rejection; eraser; lasso; text; shapes and arrows; connectors; sticky notes; images; tables; equations; mind maps; audio notes; undo and redo.
- **Page setup:** 18 page templates plus custom uploaded templates; A4, A5 and Letter; portrait and landscape.
- **PDFs:**
  - Highlight and underline text, draw, and comment.
  - Search the text.
  - Insert, reorder and rotate pages.
  - Export an annotated copy: original pages stay as vectors and the original file is never changed.
- **Viewers:** DOCX, PPTX, XLSX and CSV.
- **Workspace:** whiteboards, split screen, presentation mode, Notevia pages (rich text).
- **Classes:** invite by code, single-use link or email; announcements, materials, assignments with seven statuses, submissions, feedback and progress.
- **Calendar:** day, week and month views with a to-do list.
- **Library and collaboration:** learning-resource links with previews, sharing, comments, version history, activity, notifications, favourites, recycle bin.
- **Admin and app:** an admin console, a dark theme and a mobile layout.

## 6. Needs configuration or planned for Phase 2

| Item | Status |
|---|---|
| Notevia AI | Built. Needs the Edge Function and an API key. |
| Google sign-in | Built. Needs OAuth credentials. |
| Automatic invitation emails | Today an invite link is created and the user's own mail app opens. Server-sent email needs an email provider (Phase 2). |
| Live co-editing (several cursors at once) | Phase 2 (Yjs). Today changes sync through Supabase Realtime and the last save wins. |
| Editing Office files in place | Office files are view-only. They can be converted to a Notevia page or annotated as PDF. |
| Scheduled recycle-bin purge | Run `select purge_recycle_bin();` daily with pg_cron. |
| Equations in exports on Safari | Safari may block equation images when exporting; Chrome, Edge and Firefox are fine. |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run build:demo` | Single-file demo build (`dist-demo/`) |
| `npm run typecheck` | TypeScript only |
