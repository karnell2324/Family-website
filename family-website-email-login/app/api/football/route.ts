import { NextResponse } from "next/server";

export const revalidate = 900;

type EspnStat = {
  name: string;
  displayValue: string;
};

function stat(stats: EspnStat[] = [], name: string) {
  return stats.find((item) => item.name === name)?.displayValue || "—";
}

export async function GET() {
  try {
    const [nflResponse, collegeResponse] = await Promise.all([
      fetch("https://site.api.espn.com/apis/v2/sports/football/nfl/standings", {
        next: { revalidate },
      }),
      fetch(
        "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings",
        { next: { revalidate } },
      ),
    ]);

    if (!nflResponse.ok || !collegeResponse.ok) {
      throw new Error("The football data provider did not respond successfully.");
    }

    const [nfl, college] = await Promise.all([
      nflResponse.json(),
      collegeResponse.json(),
    ]);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      nfl: {
        season: nfl.season?.displayName || nfl.season?.year || "Current season",
        conferences: (nfl.children || []).map(
          (conference: {
            name: string;
            abbreviation: string;
            standings?: {
              entries?: Array<{
                team: {
                  id: string;
                  displayName: string;
                  abbreviation: string;
                  logos?: Array<{ href: string }>;
                };
                stats?: EspnStat[];
              }>;
            };
          }) => ({
            name: conference.name,
            abbreviation: conference.abbreviation,
            teams: (conference.standings?.entries || []).map((entry) => ({
              id: entry.team.id,
              name: entry.team.displayName,
              abbreviation: entry.team.abbreviation,
              logo: entry.team.logos?.[0]?.href || null,
              wins: stat(entry.stats, "wins"),
              losses: stat(entry.stats, "losses"),
              ties: stat(entry.stats, "ties"),
              pct: stat(entry.stats, "winPercent"),
              streak: stat(entry.stats, "streak"),
              differential: stat(entry.stats, "pointDifferential"),
              seed: stat(entry.stats, "playoffSeed"),
            })),
          }),
        ),
      },
      college: {
        polls: (college.rankings || []).slice(0, 3).map(
          (poll: {
            name: string;
            shortName: string;
            ranks?: Array<{
              current: number;
              previous: number;
              trend?: string;
              points?: number;
              firstPlaceVotes?: number;
              recordSummary?: string;
              team: {
                id: string;
                location?: string;
                name?: string;
                nickname?: string;
                abbreviation: string;
                logos?: Array<{ href: string }>;
              };
            }>;
          }) => ({
            name: poll.name,
            shortName: poll.shortName,
            teams: (poll.ranks || []).slice(0, 25).map((rank) => ({
              id: rank.team.id,
              rank: rank.current,
              previous: rank.previous,
              trend: rank.trend || "—",
              name:
                rank.team.nickname ||
                rank.team.location ||
                rank.team.name ||
                rank.team.abbreviation,
              abbreviation: rank.team.abbreviation,
              logo: rank.team.logos?.[0]?.href || null,
              record: rank.recordSummary || "—",
              points: rank.points || 0,
              firstPlaceVotes: rank.firstPlaceVotes || 0,
            })),
          }),
        ),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Football data is temporarily unavailable.",
      },
      { status: 502 },
    );
  }
}
