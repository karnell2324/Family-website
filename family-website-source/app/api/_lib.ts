import { and, asc, count, desc, eq } from "drizzle-orm";
import { getChatGPTUser } from "../chatgpt-auth";
import { getDb } from "../../db";
import { members, posts } from "../../db/schema";

export const CATEGORIES = ["news", "history", "photos", "learning", "events"];

export async function currentMember() {
  const user = await getChatGPTUser();
  if (!user) return null;
  const db = getDb();
  let member = await db.query.members.findFirst({ where: eq(members.email, user.email.toLowerCase()) });
  if (!member) {
    const [{ total }] = await db.select({ total: count() }).from(members);
    const first = total === 0;
    [member] = await db.insert(members).values({
      email: user.email.toLowerCase(), name: user.fullName || user.displayName,
      role: first ? "admin" : "member", status: first ? "approved" : "pending",
    }).returning();
  }
  return member;
}

export async function requireApproved() {
  const member = await currentMember();
  if (!member) return { error: Response.json({ error: "Sign in is required." }, { status: 401 }) };
  if (member.status !== "approved") return { member, error: Response.json({ error: "Your family account is not approved." }, { status: 403 }) };
  return { member };
}

export async function requireAdmin() {
  const result = await requireApproved();
  if (result.error) return result;
  if (result.member?.role !== "admin") return { member: result.member, error: Response.json({ error: "Administrator access is required." }, { status: 403 }) };
  return result;
}

export async function dashboardData(member: NonNullable<Awaited<ReturnType<typeof currentMember>>>) {
  const db = getDb();
  const approvedPosts = member.status === "approved" ? await db.select().from(posts).where(eq(posts.status, "approved")).orderBy(desc(posts.createdAt), desc(posts.id)).limit(100) : [];
  const pendingPosts = member.role === "admin" && member.status === "approved" ? await db.select().from(posts).where(eq(posts.status, "pending")).orderBy(asc(posts.createdAt)) : [];
  const pendingMembers = member.role === "admin" && member.status === "approved" ? await db.select().from(members).where(eq(members.status, "pending")).orderBy(asc(members.createdAt)) : [];
  const approvedMembers = member.role === "admin" && member.status === "approved" ? await db.select().from(members).where(eq(members.status, "approved")).orderBy(asc(members.name)) : [];
  return { member, posts: approvedPosts, pendingPosts, pendingMembers, approvedMembers };
}
