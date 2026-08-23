# Family Website Setup

## Programs required

Install these programs before opening the project:

1. Visual Studio Code
2. Node.js 22 or newer
3. Git

## Recommended VS Code extensions

- ESLint
- Tailwind CSS IntelliSense
- Prettier - Code formatter
- GitLens
- SQLite Viewer

TypeScript, JavaScript, HTML, and CSS support are already built into Visual Studio Code.

## Open the project

1. Extract the project ZIP file.
2. Open Visual Studio Code.
3. Select **File > Open Folder**.
4. Select the extracted `family-website` folder.
5. Accept the recommended extensions when Visual Studio Code displays the notification.

## Install the project packages

Open **Terminal > New Terminal** in Visual Studio Code and run:

```bash
npm install
```

## Run the development website

Run:

```bash
npm run dev
```

The terminal will display the local address used to open the website in your browser.

## Important folders

- `app/` contains the pages, interface, and server routes.
- `app/family-portal.tsx` contains most of the visible website interface.
- `app/globals.css` contains the design and responsive layout.
- `app/api/` contains the backend routes and permission checks.
- `db/` contains the database structure.
- `drizzle/` contains database migrations.

## Before putting the code on GitHub

Do not upload passwords, secret keys, `.env` files, private family photographs, or real member data. The `node_modules` and `dist` folders should also stay out of the repository.

## Learning order

Read the files in this order:

1. `LEARNING_GUIDE.md`
2. `app/page.tsx`
3. `app/family-portal.tsx`
4. `app/globals.css`
5. `app/api/dashboard/route.ts`
6. `app/api/posts/route.ts`
7. `app/api/admin/route.ts`
8. `db/schema.ts`
