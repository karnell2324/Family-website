import { getDb } from "../../../db";
import { posts } from "../../../db/schema";
import { CATEGORIES, requireApproved } from "../_lib";

export async function POST(request: Request) {
  try {
    const auth = await requireApproved();
    if (auth.error) return auth.error;
    const payload = await request.json() as Record<string, string>;
    const title = payload.title?.trim(), description = payload.description?.trim(), category = payload.category?.trim(), imageUrl = payload.imageUrl?.trim() || null;
    if (!title || !description || !category) return Response.json({ error: "Title, family page, and description are required." }, { status: 400 });
    if (title.length > 100 || description.length > 2000) return Response.json({ error: "The post is longer than the allowed limit." }, { status: 400 });
    if (!CATEGORIES.includes(category)) return Response.json({ error: "Select an approved family page." }, { status: 400 });
    if (imageUrl) { try { const u = new URL(imageUrl); if (!['http:','https:'].includes(u.protocol)) throw new Error(); } catch { return Response.json({ error: "Photograph link must be a valid web address." }, { status: 400 }); } }
    const [post] = await getDb().insert(posts).values({ title, description, category, imageUrl, authorEmail: auth.member!.email, authorName: auth.member!.name }).returning();
    return Response.json({ post }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit the post." }, { status: 500 });
  }
}
