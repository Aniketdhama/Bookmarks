/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const normalizeUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const isValidUrl = (value) => {
  try {
    const url = new URL(normalizeUrl(value));
    return Boolean(url.hostname);
  } catch {
    return false;
  }
};

export default function Home() {
  const [session, setSession] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const user = session?.user;
  const missingEnv =
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const displayName = useMemo(() => {
    if (!user) return "";
    return (
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "Signed in"
    );
  }, [user]);

  useEffect(() => {
    if (missingEnv) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const fetchBookmarks = useCallback(async () => {
    if (missingEnv || !user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, title, url, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) {
      setBookmarks(data || []);
    }
    setLoading(false);
  }, [missingEnv, user]);

  useEffect(() => {
    if (missingEnv) return;
    if (!user) {
      setBookmarks([]);
      setLoading(false);
      return;
    }

    fetchBookmarks();
  }, [fetchBookmarks, missingEnv, user]);

  useEffect(() => {
    if (missingEnv) return undefined;
    if (!user) return undefined;

    const channel = supabase
      .channel("bookmarks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookmarks",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setBookmarks((prev) => {
              if (prev.some((item) => item.id === payload.new.id)) {
                return prev;
              }
              return [payload.new, ...prev];
            });
          }
          if (payload.eventType === "UPDATE") {
            setBookmarks((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? payload.new : item
              )
            );
          }
          if (payload.eventType === "DELETE") {
            setBookmarks((prev) =>
              prev.filter((item) => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const signInWithGoogle = async () => {
    if (missingEnv) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const signOut = async () => {
    if (missingEnv) return;
    await supabase.auth.signOut();
  };

  const handleAddBookmark = async (event) => {
    event.preventDefault();
    setFormError("");
    if (missingEnv) return;

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle || !trimmedUrl) {
      setFormError("Title and URL are required.");
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setFormError("Enter a valid URL (example: https://example.com).");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("bookmarks").insert({
      title: trimmedTitle,
      url: normalizeUrl(trimmedUrl),
      user_id: user.id,
    });

    setSaving(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setTitle("");
    setUrl("");
  };

  const handleDelete = async (id) => {
    if (missingEnv) return;
    setFormError("");
    setBookmarks((prev) => prev.filter((item) => item.id !== id));
    const { error } = await supabase.from("bookmarks").delete().eq("id", id);
    if (error) {
      setFormError(error.message);
      fetchBookmarks();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (missingEnv) {
    return (
      <div className="min-h-screen px-6 py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <header className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
              Smart Bookmark App
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">
              Configure Supabase to continue.
            </h1>
            <p className="text-slate-300">
              Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to
              your .env.local file.
            </p>
          </header>
          <section className="glass rounded-2xl p-6 md:p-8">
            <p className="text-sm text-slate-300">
              See README.md for step-by-step setup instructions.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
            Smart Bookmark App
          </p>
          <h1 className="text-3xl font-semibold md:text-4xl">
            Save once. Access anywhere.
          </h1>
          <p className="text-slate-300">
            Private bookmarks, Google-only login, and real-time updates
          </p>
        </header>

        {!user ? (
          <section className="glass flex flex-col gap-4 rounded-2xl p-6 md:p-8">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">Sign in to continue</h2>
              <p className="text-sm text-slate-300">
                Use Google-only login
              </p>
            </div>
            <button className="btn-primary w-full md:w-fit" onClick={signInWithGoogle}>
              Continue with Google
            </button>
          </section>
        ) : (
          <section className="glass flex flex-col gap-6 rounded-2xl p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="User avatar"
                    className="h-10 w-10 rounded-full border border-emerald-200/30"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-slate-900 font-bold">
                    {displayName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm text-slate-300">Signed in as</p>
                  <p className="font-semibold">{displayName}</p>
                </div>
              </div>
              <button className="btn-ghost" onClick={signOut}>
                Sign out
              </button>
            </div>

            <form
              className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4"
              onSubmit={handleAddBookmark}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Title
                  <input
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500"
                    placeholder="Enter Title here"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={120}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  URL
                  <input
                    className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 placeholder:text-slate-500"
                    placeholder="Enter URL here"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                </label>
              </div>
              {formError ? (
                <p className="text-sm text-rose-300">{formError}</p>
              ) : null}
              <button className="btn-primary w-full md:w-fit" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add bookmark"}
              </button>
            </form>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Your bookmarks</h3>
                <span className="text-sm text-slate-400">
                  {bookmarks.length} total
                </span>
              </div>
              {loading ? (
                <p className="text-sm text-slate-400">Loading bookmarks...</p>
              ) : bookmarks.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No bookmarks yet. Add your first one above.
                </p>
              ) : (
                <div className="grid gap-3">
                  {bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex flex-col">
                        <p className="font-semibold text-slate-100">
                          {bookmark.title}
                        </p>
                        <a
                          className="text-sm text-emerald-300 hover:text-emerald-200"
                          href={bookmark.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {bookmark.url}
                        </a>
                      </div>
                      <button
                        className="text-sm text-rose-300 hover:text-rose-200 md:text-right"
                        onClick={() => setDeleteTarget(bookmark)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {deleteTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-6">
            <div className="glass w-full max-w-md rounded-2xl p-6">
              <h4 className="text-lg font-semibold">Delete bookmark?</h4>
              <p className="mt-2 text-sm text-slate-300">
                This will permanently remove “{deleteTarget.title}”.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  className="btn-ghost"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button className="btn-primary" onClick={confirmDelete}>
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </div>
  );
}
