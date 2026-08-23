# Family Website Learning Guide

This guide explains how the application matches the requirements and how the main pieces connect.

## 1. The application flow

1. A visitor signs in securely.
2. The server finds or creates that person's family account.
3. The first account becomes the initial administrator; later accounts remain pending.
4. An administrator approves a pending family account.
5. An approved member can view family content and submit a post.
6. A submitted post stays pending and hidden.
7. An administrator approves or rejects the post.
8. Only approved posts appear on family pages.

## 2. Important files

- `app/page.tsx` protects the website and passes the signed-in person to the interface.
- `app/family-portal.tsx` contains the member dashboard, navigation, forms, and administrator controls.
- `app/globals.css` controls the visual design and responsive phone layout.
- `app/api/dashboard/route.ts` loads the correct content for the current member.
- `app/api/posts/route.ts` validates and saves new posts.
- `app/api/admin/route.ts` handles administrator approvals, rejections, removals, and roles.
- `app/api/_lib.ts` contains shared permission checks.
- `db/schema.ts` defines the members and posts stored in the database.
- `drizzle/` contains the database migration used during deployment.

## 3. Frontend and backend

The frontend is what the family sees and clicks. It is mainly in `app/family-portal.tsx` and `app/globals.css`.

The backend receives requests, checks permissions, validates information, and works with the database. It is mainly in the `app/api` folder.

The browser never decides whether somebody is an administrator. Every protected action is checked again on the server.

## 4. Database tables

The `members` table stores each person's email, name, role, approval status, and creation date.

The `posts` table stores the title, description, family page, optional photograph link, author, approval status, and review information.

## 5. How FR-06 works

The post form requires a title, family page, and description. The photograph link is optional. The browser marks required fields, but the server validates them again because browser checks can be bypassed.

## 6. How to make Bahaiz an administrator

1. Bahaiz signs in once so his account request is created.
2. Karnell opens **Administration**.
3. Karnell approves Bahaiz's account.
4. Under **Approved accounts**, Karnell selects **Make administrator** beside Bahaiz.

## 7. What is intentionally waiting

Direct messaging, online payments, a separate mobile app, and advanced family-tree visualization are outside the approved scope. Direct photograph uploads are waiting until the family decides who may upload images and what consent rules apply.
