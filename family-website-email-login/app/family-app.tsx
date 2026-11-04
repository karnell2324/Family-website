"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "member";
  status: "pending" | "approved" | "removed";
};

type Post = {
  id: number;
  title: string;
  description: string;
  category: string;
  image_url: string | null;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
};

type FamilyMember = {
  id: number;
  full_name: string;
  relationship_label: string | null;
  branch: string | null;
  life_years: string | null;
  bio: string | null;
  photo_url: string | null;
  parent_id: number | null;
  generation: number;
};

type FootballGame = {
  id: string;
  date: string;
  detail: string;
  venue: string;
  broadcast: string;
  away: FootballGameTeam;
  home: FootballGameTeam;
};

type FootballGameTeam = {
  id: string;
  name: string;
  abbreviation: string;
  logo: string | null;
  record: string;
};

type FootballVote = {
  game_id: string;
  user_id: string;
  pick_team_id: string;
};

type FootballData = {
  updatedAt: string;
  nfl: {
    season: string;
    games: FootballGame[];
    conferences: Array<{
      name: string;
      abbreviation: string;
      teams: Array<{
        id: string;
        name: string;
        abbreviation: string;
        logo: string | null;
        wins: string;
        losses: string;
        ties: string;
        pct: string;
        streak: string;
        differential: string;
        seed: string;
      }>;
    }>;
  };
  college: {
    games: FootballGame[];
    polls: Array<{
      name: string;
      shortName: string;
      teams: Array<{
        id: string;
        rank: number;
        previous: number;
        trend: string;
        name: string;
        abbreviation: string;
        logo: string | null;
        record: string;
        points: number;
        firstPlaceVotes: number;
      }>;
    }>;
  };
};

const categories = ["news", "history", "photos", "learning", "events"];

const sections = [
  ["home", "⌂", "Home"],
  ["news", "◈", "News"],
  ["history", "◷", "History"],
  ["family-tree", "♧", "Family Tree"],
  ["football", "🏈", "Football"],
  ["photos", "▣", "Photos"],
  ["learning", "◇", "Learning"],
  ["events", "○", "Events"],
  ["submit", "+", "Submit a post"],
  ["admin", "⚙", "Administration"],
] as const;

export default function FamilyApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (current: User) => {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", current.id)
      .single();

    if (profileError) throw profileError;

    setProfile(profileData);

    if (profileData.status === "approved") {
      const { data: approved, error: postsError } = await supabase
        .from("posts")
        .select("*,profiles!posts_author_id_fkey(full_name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      setPosts(approved || []);

      const { data: tree, error: treeError } = await supabase
        .from("family_members")
        .select("*")
        .order("generation")
        .order("full_name");

      if (treeError && treeError.code !== "42P01") throw treeError;
      setFamilyMembers(tree || []);

      if (profileData.role === "admin") {
        const [
          { data: allMembers, error: membersError },
          { data: queue, error: queueError },
        ] = await Promise.all([
          supabase.from("profiles").select("*").order("created_at"),
          supabase
            .from("posts")
            .select("*,profiles!posts_author_id_fkey(full_name)")
            .eq("status", "pending")
            .order("created_at"),
        ]);

        if (membersError) throw membersError;
        if (queueError) throw queueError;

        setMembers(allMembers || []);
        setPendingPosts(queue || []);
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        setUser(data.user);

        if (data.user) {
          await load(data.user);
        }

        setLoading(false);
      })
      .catch((authError) => {
        setError(authError.message);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setRecovering(true);
        }

        setUser(session?.user || null);

        if (!session) {
          setProfile(null);
        }
      },
    );

    return () => listener.subscription.unsubscribe();
  }, [load]);

  const shown = useMemo(
    () =>
      view === "home"
        ? posts
        : posts.filter((post) => post.category === view),
    [posts, view],
  );

  async function refresh() {
    if (user) await load(user);
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));

    const { error: insertError } = await supabase.from("posts").insert({
      title: String(values.title).trim(),
      description: String(values.description).trim(),
      category: values.category,
      image_url: String(values.image_url).trim() || null,
      author_id: user!.id,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    form.reset();
    setMessage("Your post is waiting for administrator approval.");
    await refresh();
  }

  async function update(
    table: "profiles" | "posts",
    id: string | number,
    values: Record<string, string>,
  ) {
    setError("");

    const { error: updateError } = await supabase
      .from(table)
      .update(values)
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("The change was saved.");
    await refresh();
  }

  async function addFamilyMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const parentId = String(values.parent_id || "");

    const { error: insertError } = await supabase
      .from("family_members")
      .insert({
        full_name: String(values.full_name).trim(),
        relationship_label: String(values.relationship_label).trim() || null,
        branch: String(values.branch).trim() || null,
        life_years: String(values.life_years).trim() || null,
        bio: String(values.bio).trim() || null,
        photo_url: String(values.photo_url).trim() || null,
        parent_id: parentId ? Number(parentId) : null,
        generation: Number(values.generation),
        created_by: user!.id,
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    form.reset();
    setMessage("Family member added to the tree.");
    await refresh();
  }

  async function removeFamilyMember(id: number) {
    setError("");
    const { error: deleteError } = await supabase
      .from("family_members")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setMessage("Family member removed from the tree.");
    await refresh();
  }

  if (loading) {
    return <div className="loading">Opening the family website…</div>;
  }

  if (recovering) {
    return <ResetPassword onDone={() => setRecovering(false)} />;
  }

  if (!user) {
    return <Auth />;
  }

  if (!profile) {
    return (
      <Status
        title="Account setup is incomplete"
        text="Please refresh the page. If this continues, the database setup has not been completed yet."
      />
    );
  }

  if (profile.status !== "approved") {
    return (
      <Status
        title="Account awaiting approval"
        text="Karnell or Bahaiz must approve your family account before you can view private content."
      >
        <button
          className="secondary"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </Status>
    );
  }

  const isAdmin = profile.role === "admin";

  const heading =
    view === "home"
      ? `Welcome, ${profile.full_name.split(" ")[0]}`
      : sections.find((section) => section[0] === view)?.[2] ||
        "Family Website";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="crest">F</div>

          <div>
            <strong>Family Website</strong>
            <small>Our people. Our story.</small>
          </div>
        </div>

        <div className="account">
          <span>{profile.email}</span>

          <button
            className="signout"
            style={{ background: "transparent" }}
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <p className="nav-label">Family spaces</p>

          <nav className="nav">
            {sections
              .filter(
                (section) => section[0] !== "admin" || isAdmin,
              )
              .map(([key, icon, label]) => (
                <button
                  key={key}
                  className={view === key ? "active" : ""}
                  onClick={() => {
                    setView(key);
                    setMessage("");
                    setError("");
                  }}
                >
                  <span className="icon">{icon}</span>
                  {label}
                </button>
              ))}
          </nav>
        </aside>

        <main className="main">
          <section className="hero">
            <div>
              <p className="eyebrow">Private family community</p>
              <h1>{heading}</h1>

              <p>
                {view === "home"
                  ? "A protected place to keep up with family, preserve our history, learn together, and celebrate what matters."
                  : view === "admin"
                    ? "Approve accounts, review posts, and manage administrator roles."
                    : view === "submit"
                      ? "Share something meaningful with the family. Every post is reviewed before it appears."
                      : view === "family-tree"
                        ? "See how our generations and family branches connect, and preserve the people behind our story."
                        : view === "football"
                          ? "Follow the NFL playoff race and the latest college football polls in one family scoreboard."
                        : `Approved ${heading.toLowerCase()} shared by our family.`}
              </p>
            </div>

            {view !== "submit" &&
              view !== "family-tree" &&
              view !== "football" && (
              <button
                className="primary"
                onClick={() => setView("submit")}
              >
                + Submit a post
              </button>
            )}
          </section>

          {message && <div className="notice">{message}</div>}
          {error && <div className="notice error">{error}</div>}

          {view === "submit" ? (
            <PostForm submit={submitPost} />
          ) : view === "family-tree" ? (
            <FamilyTree
              members={familyMembers}
              isAdmin={isAdmin}
              addMember={addFamilyMember}
              removeMember={removeFamilyMember}
            />
          ) : view === "football" ? (
            <FootballHub userId={user.id} />
          ) : view === "admin" && isAdmin ? (
            <Admin
              members={members}
              queue={pendingPosts}
              current={profile}
              update={update}
            />
          ) : (
            <Content
              posts={shown}
              view={view}
              heading={heading}
              navigate={setView}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function FootballHub({ userId }: { userId: string }) {
  const [mode, setMode] = useState<"nfl" | "college" | "games">("nfl");
  const [data, setData] = useState<FootballData | null>(null);
  const [selectedPoll, setSelectedPoll] = useState(0);
  const [gameLeague, setGameLeague] = useState<"nfl" | "college">("nfl");
  const [votes, setVotes] = useState<FootballVote[]>([]);
  const [votingGame, setVotingGame] = useState("");
  const [footballError, setFootballError] = useState("");

  const loadVotes = useCallback(async () => {
    const { data: voteData, error: voteError } = await supabase
      .from("football_votes")
      .select("game_id,user_id,pick_team_id");

    if (voteError) throw voteError;
    setVotes(voteData || []);
  }, []);

  const loadFootball = useCallback(async () => {
    setFootballError("");

    try {
      const response = await fetch("/api/football");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Football data is unavailable.");
      }

      setData(payload);
    } catch (loadError) {
      setFootballError(
        loadError instanceof Error
          ? loadError.message
          : "Football data is unavailable.",
      );
    }
  }, []);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void Promise.all([loadFootball(), loadVotes()]).catch((loadError) => {
        setFootballError(
          loadError instanceof Error ? loadError.message : "Football data is unavailable.",
        );
      });
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadFootball, loadVotes]);

  const castVote = async (gameId: string, teamId: string) => {
    setVotingGame(gameId);
    setFootballError("");
    const { error: voteError } = await supabase.from("football_votes").upsert(
      { game_id: gameId, user_id: userId, pick_team_id: teamId },
      { onConflict: "game_id,user_id" },
    );

    if (voteError) setFootballError(voteError.message);
    else await loadVotes();
    setVotingGame("");
  };

  if (!data && !footballError) {
    return (
      <section className="panel football-loading">
        <div className="football-mark">🏈</div>
        <h2>Loading the football board…</h2>
        <p>Pulling the latest standings and rankings.</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="panel football-loading">
        <div className="football-mark">!</div>
        <h2>Football data is temporarily unavailable</h2>
        <p>{footballError}</p>
        <button className="primary" onClick={loadFootball}>Try again</button>
      </section>
    );
  }

  const poll = data.college.polls[selectedPoll] || data.college.polls[0];
  const upcomingGames = gameLeague === "nfl" ? data.nfl.games : data.college.games;

  return (
    <section className="football-hub">
      <div className="football-toolbar panel">
        <div className="football-switch" role="tablist" aria-label="Football leagues">
          <button
            role="tab"
            aria-selected={mode === "nfl"}
            className={mode === "nfl" ? "active" : ""}
            onClick={() => setMode("nfl")}
          >
            NFL standings
          </button>
          <button
            role="tab"
            aria-selected={mode === "college"}
            className={mode === "college" ? "active" : ""}
            onClick={() => setMode("college")}
          >
            College rankings
          </button>
          <button
            role="tab"
            aria-selected={mode === "games"}
            className={mode === "games" ? "active" : ""}
            onClick={() => setMode("games")}
          >
            Game polls
          </button>
        </div>

        <div className="football-updated">
          <span className="live-dot" /> Updated {new Date(data.updatedAt).toLocaleString()}
          <button className="refresh-scoreboard" onClick={loadFootball}>↻</button>
        </div>
      </div>

      {mode === "nfl" ? (
        <div className="conference-grid">
          {data.nfl.conferences.map((conference) => (
            <section className="panel standings-panel" key={conference.abbreviation}>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{data.nfl.season} season</p>
                  <h2>{conference.name}</h2>
                </div>
                <span className="pill">{conference.abbreviation}</span>
              </div>
              <div className="football-table-wrap">
                <table className="football-table">
                  <thead>
                    <tr>
                      <th>Seed</th><th>Team</th><th>W</th><th>L</th><th>T</th><th>PCT</th><th>DIFF</th><th>STRK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conference.teams.map((team) => (
                      <tr key={team.id}>
                        <td className="rank-cell">{team.seed}</td>
                        <td>
                          <div className="team-name">
                            {team.logo && <img src={team.logo} alt="" />}
                            <span><strong>{team.name}</strong><small>{team.abbreviation}</small></span>
                          </div>
                        </td>
                        <td>{team.wins}</td><td>{team.losses}</td><td>{team.ties}</td><td>{team.pct}</td><td>{team.differential}</td><td>{team.streak}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : mode === "college" ? (
        <section className="panel rankings-panel">
          <div className="rankings-heading">
            <div>
              <p className="eyebrow">National polls</p>
              <h2>{poll?.name || "College football rankings"}</h2>
            </div>
            <div className="poll-picker" aria-label="Choose a college football poll">
              {data.college.polls.map((item, index) => (
                <button
                  key={item.shortName}
                  className={selectedPoll === index ? "active" : ""}
                  onClick={() => setSelectedPoll(index)}
                >
                  {item.shortName}
                </button>
              ))}
            </div>
          </div>

          {poll ? (
            <div className="ranking-list">
              {poll.teams.map((team) => {
                const movement = team.previous
                  ? team.previous - team.rank
                  : 0;

                return (
                  <article className="ranking-row" key={team.id}>
                    <div className="college-rank">{team.rank}</div>
                    <div className="team-name college-team">
                      {team.logo && <img src={team.logo} alt="" />}
                      <span><strong>{team.name}</strong><small>{team.record}</small></span>
                    </div>
                    <div className={`rank-move ${movement > 0 ? "up" : movement < 0 ? "down" : ""}`}>
                      {movement > 0 ? `↑ ${movement}` : movement < 0 ? `↓ ${Math.abs(movement)}` : "—"}
                      <small>movement</small>
                    </div>
                    <div className="poll-points"><strong>{team.points.toLocaleString()}</strong><small>points</small></div>
                    <div className="first-votes"><strong>{team.firstPlaceVotes}</strong><small>1st-place</small></div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty">No college rankings are available yet.</div>
          )}
        </section>
      ) : (
        <GamePolls
          league={gameLeague}
          setLeague={setGameLeague}
          games={upcomingGames}
          votes={votes}
          userId={userId}
          votingGame={votingGame}
          castVote={castVote}
        />
      )}

      <p className="football-source">Standings, rankings, and schedules refresh automatically every 15 minutes. Data provided by ESPN.</p>
    </section>
  );
}

function GamePolls({
  league,
  setLeague,
  games,
  votes,
  userId,
  votingGame,
  castVote,
}: {
  league: "nfl" | "college";
  setLeague: (league: "nfl" | "college") => void;
  games: FootballGame[];
  votes: FootballVote[];
  userId: string;
  votingGame: string;
  castVote: (gameId: string, teamId: string) => Promise<void>;
}) {
  return (
    <section className="panel game-polls-panel">
      <div className="rankings-heading">
        <div>
          <p className="eyebrow">Family predictions</p>
          <h2>Who wins the next game?</h2>
        </div>
        <div className="poll-picker" aria-label="Choose game league">
          <button className={league === "nfl" ? "active" : ""} onClick={() => setLeague("nfl")}>NFL</button>
          <button className={league === "college" ? "active" : ""} onClick={() => setLeague("college")}>College</button>
        </div>
      </div>

      <div className="game-grid">
        {games.map((game) => {
          const gameVotes = votes.filter((vote) => vote.game_id === game.id);
          const myVote = gameVotes.find((vote) => vote.user_id === userId)?.pick_team_id;
          const total = gameVotes.length;
          const count = (teamId: string) => gameVotes.filter((vote) => vote.pick_team_id === teamId).length;

          return (
            <article className="game-card" key={game.id}>
              <div className="game-meta">
                <strong>{new Date(game.date).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</strong>
                <span>{game.broadcast} · {game.venue}</span>
              </div>
              {[game.away, game.home].map((team) => {
                const teamVotes = count(team.id);
                const percent = total ? Math.round((teamVotes / total) * 100) : 0;
                return (
                  <button
                    className={`game-pick ${myVote === team.id ? "selected" : ""}`}
                    key={team.id}
                    onClick={() => void castVote(game.id, team.id)}
                    disabled={votingGame === game.id}
                  >
                    <span className="game-team">
                      {team.logo && <img src={team.logo} alt="" />}
                      <span><strong>{team.name}</strong><small>{team.record}</small></span>
                    </span>
                    <span className="vote-result"><strong>{percent}%</strong><small>{teamVotes} {teamVotes === 1 ? "vote" : "votes"}</small></span>
                    <span className="vote-bar" style={{ width: `${percent}%` }} />
                  </button>
                );
              })}
              <p className="game-vote-note">{myVote ? "Your pick is saved. Choose the other team to change it." : `${total} family ${total === 1 ? "vote" : "votes"} so far.`}</p>
            </article>
          );
        })}
        {!games.length && <div className="empty">No upcoming {league === "nfl" ? "NFL" : "college"} games are listed yet.</div>}
      </div>
    </section>
  );
}

function FamilyTree({
  members,
  isAdmin,
  addMember,
  removeMember,
}: {
  members: FamilyMember[];
  isAdmin: boolean;
  addMember: (event: FormEvent<HTMLFormElement>) => void;
  removeMember: (id: number) => void;
}) {
  const generations = Array.from(
    new Set(members.map((member) => member.generation)),
  ).sort((a, b) => a - b);

  return (
    <div className="tree-layout">
      <section className="panel tree-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Our lineage</p>
            <h2>Generations of family</h2>
          </div>
          <span className="pill">{members.length} people</span>
        </div>

        {members.length ? (
          <div className="family-tree" aria-label="Family tree">
            {generations.map((generation, index) => (
              <section className="generation" key={generation}>
                <div className="generation-label">
                  <span>Generation {index + 1}</span>
                </div>
                <div className="generation-row">
                  {members
                    .filter((member) => member.generation === generation)
                    .map((member) => {
                      const parent = members.find(
                        (candidate) => candidate.id === member.parent_id,
                      );

                      return (
                        <article className="person-card" key={member.id}>
                          <div className="person-photo">
                            {member.photo_url ? (
                              <img src={member.photo_url} alt="" />
                            ) : (
                              <span>{member.full_name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="person-copy">
                            <h3>{member.full_name}</h3>
                            {(member.relationship_label || member.life_years) && (
                              <p className="person-detail">
                                {[member.relationship_label, member.life_years]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                            {parent && (
                              <p className="parent-link">Child of {parent.full_name}</p>
                            )}
                            {member.branch && <span className="branch">{member.branch} branch</span>}
                            {member.bio && <p className="person-bio">{member.bio}</p>}
                          </div>
                          {isAdmin && (
                            <button
                              className="remove-person"
                              onClick={() => removeMember(member.id)}
                              aria-label={`Remove ${member.full_name}`}
                              title="Remove from tree"
                            >
                              ×
                            </button>
                          )}
                        </article>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="tree-empty">
            <div className="tree-mark">♧</div>
            <h3>Our tree starts here</h3>
            <p>
              {isAdmin
                ? "Add the oldest known relative first, then connect each generation below them."
                : "Karnell and Bahaiz are building the family tree. Check back as our story grows."}
            </p>
          </div>
        )}
      </section>

      {isAdmin && (
        <aside className="panel tree-form-panel">
          <p className="eyebrow">Administrator tools</p>
          <h2>Add a relative</h2>
          <p className="help">Start with the oldest generation and work forward.</p>

          <form className="form" onSubmit={addMember}>
            <Field label="Full name *">
              <input name="full_name" maxLength={100} required />
            </Field>
            <div className="form-pair">
              <Field label="Generation *">
                <input name="generation" type="number" min="1" max="20" defaultValue="1" required />
              </Field>
              <Field label="Family branch">
                <input name="branch" maxLength={60} placeholder="Example: Holmes" />
              </Field>
            </div>
            <Field label="Parent or direct ancestor">
              <select name="parent_id" defaultValue="">
                <option value="">No parent listed</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.full_name}</option>
                ))}
              </select>
            </Field>
            <div className="form-pair">
              <Field label="Family role">
                <input name="relationship_label" maxLength={60} placeholder="Grandmother, cousin…" />
              </Field>
              <Field label="Life years">
                <input name="life_years" maxLength={40} placeholder="1948–2021 or Born 1985" />
              </Field>
            </div>
            <Field label="Photograph link">
              <input name="photo_url" type="url" placeholder="https://…" />
            </Field>
            <Field label="A short memory or note">
              <textarea name="bio" maxLength={500} />
            </Field>
            <button className="primary">Add to family tree</button>
          </form>
        </aside>
      )}
    </div>
  );
}

function Auth() {
  const [mode, setMode] = useState<
    "signin" | "signup" | "forgot"
  >("signin");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleAuthentication(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    );

    const email = String(values.email).trim();

    if (mode === "forgot") {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage("Password-reset link sent. Check your email.");
      }

      return;
    }

    const password = String(values.password);

    if (mode === "signup") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: String(values.full_name).trim(),
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage(
          "Account created. Check your email if confirmation is enabled, then sign in.",
        );
      }
    } else {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        setError(signInError.message);
      }
    }
  }

  return (
    <div
      className="pending"
      style={{ maxWidth: 480, textAlign: "left" }}
    >
      <div className="seal">F</div>
      <p className="eyebrow">Private family space</p>

      <h1>
        {mode === "signin"
          ? "Welcome back"
          : mode === "signup"
            ? "Create an account"
            : "Reset your password"}
      </h1>

      <p>
        {mode === "signin"
          ? "Sign in with your family website account."
          : mode === "signup"
            ? "Create an account. An administrator must approve it before you can view family content."
            : "Enter your email and we will send you a secure reset link."}
      </p>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <form className="form" onSubmit={handleAuthentication}>
        {mode === "signup" && (
          <Field label="Full name">
            <input name="full_name" required />
          </Field>
        )}

        <Field label="Email">
          <input name="email" type="email" required />
        </Field>

        {mode !== "forgot" && (
          <Field label="Password">
            <input
              name="password"
              type="password"
              minLength={8}
              required
            />
          </Field>
        )}

        <button className="primary">
          {mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Send reset link"}
        </button>
      </form>

      {mode === "signin" && (
        <button
          className="secondary"
          style={{ marginTop: 12, width: "100%" }}
          onClick={() => setMode("forgot")}
        >
          Forgot password?
        </button>
      )}

      <button
        className="secondary"
        style={{ marginTop: 12, width: "100%" }}
        onClick={() =>
          setMode(mode === "signin" ? "signup" : "signin")
        }
      >
        {mode === "signin"
          ? "Create a family account"
          : "Back to sign in"}
      </button>
    </div>
  );
}

function ResetPassword({ onDone }: { onDone: () => void }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    );

    const password = String(values.password);
    const confirmation = String(values.confirm);

    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Your password has been changed.");
    setTimeout(onDone, 1200);
  }

  return (
    <div
      className="pending"
      style={{ maxWidth: 480, textAlign: "left" }}
    >
      <div className="seal">F</div>
      <p className="eyebrow">Private family space</p>
      <h1>Choose a new password</h1>

      <p>Enter a new password for your family website account.</p>

      {message && <div className="notice">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      <form className="form" onSubmit={reset}>
        <Field label="New password">
          <input
            name="password"
            type="password"
            minLength={8}
            required
          />
        </Field>

        <Field label="Confirm new password">
          <input
            name="confirm"
            type="password"
            minLength={8}
            required
          />
        </Field>

        <button className="primary">Update password</button>
      </form>
    </div>
  );
}

function Status({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="pending">
      <div className="seal">⌛</div>
      <p className="eyebrow">Private family space</p>
      <h1>{title}</h1>
      <p>{text}</p>
      {children}
    </div>
  );
}

function PostForm({
  submit,
}: {
  submit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="panel" style={{ maxWidth: 760 }}>
      <div className="panel-head">
        <h2>Submit a family post</h2>
        <span className="pill">Review required</span>
      </div>

      <form className="form" onSubmit={submit}>
        <Field label="Title *">
          <input name="title" maxLength={100} required />
        </Field>

        <Field label="Family page *">
          <select name="category" required defaultValue="">
            <option value="" disabled>
              Select a page
            </option>

            {categories.map((category) => (
              <option key={category} value={category}>
                {capitalize(category)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description *">
          <textarea
            name="description"
            maxLength={2000}
            required
          />
        </Field>

        <Field label="Photograph link (optional)">
          <input
            name="image_url"
            type="url"
            placeholder="https://…"
          />
        </Field>

        <button className="primary">Send for approval</button>
      </form>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Admin({
  members,
  queue,
  current,
  update,
}: {
  members: Profile[];
  queue: Post[];
  current: Profile;
  update: (
    table: "profiles" | "posts",
    id: string | number,
    values: Record<string, string>,
  ) => void;
}) {
  return (
    <div className="grid">
      <section className="panel">
        <div className="panel-head">
          <h2>Post review queue</h2>
          <span className="pill">{queue.length} pending</span>
        </div>

        <div className="queue">
          {queue.length ? (
            queue.map((post) => (
              <article className="post" key={post.id}>
                <div className="post-meta">
                  <span className="pill">{post.category}</span>
                  <span>{post.profiles?.full_name}</span>
                </div>

                <h3>{post.title}</h3>
                <p>{post.description}</p>

                <div className="actions">
                  <button
                    className="primary"
                    onClick={() =>
                      update("posts", post.id, {
                        status: "approved",
                      })
                    }
                  >
                    Approve
                  </button>

                  <button
                    className="danger"
                    onClick={() =>
                      update("posts", post.id, {
                        status: "rejected",
                      })
                    }
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))
          ) : (
            <Empty text="No posts are waiting." />
          )}
        </div>
      </section>

      <section className="panel">
        <h2>Family accounts</h2>

        <div className="queue" style={{ marginTop: 18 }}>
          {members.map((member) => (
            <div className="member-row" key={member.id}>
              <div>
                <strong>{member.full_name}</strong>
                <small>
                  {member.email} · {member.status} · {member.role}
                </small>
              </div>

              <div className="actions">
                {member.status === "pending" && (
                  <button
                    className="primary"
                    onClick={() =>
                      update("profiles", member.id, {
                        status: "approved",
                      })
                    }
                  >
                    Approve
                  </button>
                )}

                {member.status === "approved" &&
                  member.role === "member" && (
                    <button
                      className="secondary"
                      onClick={() =>
                        update("profiles", member.id, {
                          role: "admin",
                        })
                      }
                    >
                      Make admin
                    </button>
                  )}

                {member.id !== current.id && (
                  <button
                    className="danger"
                    onClick={() =>
                      update("profiles", member.id, {
                        status: "removed",
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Content({
  posts,
  view,
  heading,
  navigate,
}: {
  posts: Post[];
  view: string;
  heading: string;
  navigate: (destination: string) => void;
}) {
  return (
    <div className="grid">
      <section className="panel">
        <div className="panel-head">
          <h2>{view === "home" ? "Latest from the family" : heading}</h2>
          <span className="pill">{posts.length} posts</span>
        </div>

        <div className="post-list">
          {posts.length ? (
            posts.map((post) => (
              <article className="post" key={post.id}>
                <div className="post-meta">
                  <span className="pill">{post.category}</span>
                  <span>{post.profiles?.full_name}</span>
                  <time>
                    {new Date(post.created_at).toLocaleDateString()}
                  </time>
                </div>

                <h3>{post.title}</h3>
                <p>{post.description}</p>

                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Family post photograph"
                  />
                )}
              </article>
            ))
          ) : (
            <Empty text="Nothing has been shared here yet." />
          )}
        </div>
      </section>

      <aside className="panel">
        <h2>Family spaces</h2>

        <div className="categories">
          {categories.map((category) => (
            <button
              key={category}
              className="category"
              style={{
                borderLeft: 0,
                borderRight: 0,
                borderTop: 0,
                background: "transparent",
                width: "100%",
              }}
              onClick={() => navigate(category)}
            >
              <span>{capitalize(category)}</span>
              <span>→</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function capitalize(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}
