import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { members, posts } from "../../../db/schema";
import { requireAdmin } from "../_lib";

export async function PATCH(request: Request) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { kind, id, value } = await request.json() as { kind?: string; id?: number|string; value?: string };
    const db = getDb();
    if (kind === "post" && typeof id === "number" && ["approved","rejected"].includes(value || "")) {
      await db.update(posts).set({ status: value as "approved"|"rejected", reviewedAt: sql`CURRENT_TIMESTAMP`, reviewedBy: auth.member!.email }).where(eq(posts.id, id));
      return Response.json({ ok: true });
    }
    if (kind === "member" && typeof id === "string" && ["approved","removed"].includes(value || "")) {
      if (id === auth.member!.email) return Response.json({ error: "You cannot remove your own administrator account." }, { status: 400 });
      await db.update(members).set({ status: value as "approved"|"removed" }).where(eq(members.email, id));
      return Response.json({ ok: true });
    }
    if (kind === "role" && typeof id === "string" && ["admin","member"].includes(value || "")) {
      if (id === auth.member!.email && value !== "admin") return Response.json({ error: "You cannot remove your own administrator role." }, { status: 400 });
      await db.update(members).set({ role: value as "admin"|"member" }).where(eq(members.email, id));
      return Response.json({ ok: true });
    }
    return Response.json({ error: "That administrator action is not valid." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save the change." }, { status: 500 });
  }
}
