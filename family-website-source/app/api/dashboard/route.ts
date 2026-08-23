import { currentMember, dashboardData } from "../_lib";

export async function GET() {
  try {
    const member = await currentMember();
    if (!member) return Response.json({ error: "Sign in is required." }, { status: 401 });
    return Response.json(await dashboardData(member));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the website." }, { status: 500 });
  }
}
