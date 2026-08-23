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

const categories = ["news", "history", "photos", "learning", "events"];

const sections = [
  ["home", "⌂", "Home"],
  ["news", "◈", "News"],
  ["history", "◷", "History"],
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
                      : `Approved ${heading.toLowerCase()} shared by our family.`}
              </p>
            </div>

            {view !== "submit" && (
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
