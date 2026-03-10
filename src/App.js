// src/App.js
import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const CHOICES = ["Outside", "Middle", "Opposite"];

function fmtTime(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function Tag({ color, children }) {
  const c = { purple: "#7C3AED", green: "#16a34a", amber: "#d97706", red: "#dc2626", gray: "#4b5563", blue: "#2563eb" };
  return <span style={{ background: c[color] || c.gray, color: "white", borderRadius: 6, padding: "0.2rem 0.6rem", fontSize: "0.78rem", fontWeight: 700 }}>{children}</span>;
}

function Btn({ color = "ghost", onClick, disabled, full, children, style = {} }) {
  const base = { border: "none", borderRadius: 10, padding: "0.7rem 1.4rem", fontSize: "0.95rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "all 0.2s", ...(full ? { width: "100%", boxSizing: "border-box" } : {}), ...style };
  const colors = { purple: { background: "#7C3AED", color: "white" }, ghost: { background: "#2a2540", color: "#c4b5fd" }, green: { background: "#16a34a", color: "white" }, red: { background: "#dc2626", color: "white" }, dark: { background: "#231f31", color: "#e2e8f0" }, blue: { background: "#2563eb", color: "white" } };
  return <button style={{ ...base, ...colors[color] }} onClick={disabled ? undefined : onClick}>{children}</button>;
}

function StatCard({ label, value, sub, color = "#7C3AED" }) {
  return (
    <div style={{ background: "#1e1a2e", borderRadius: 14, padding: "1.25rem", textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: "2rem", fontWeight: 800, color, marginBottom: "0.15rem" }}>{value}</div>
      <div style={{ color: "white", fontWeight: 700, fontSize: "0.9rem" }}>{label}</div>
      {sub && <div style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: "0.2rem" }}>{sub}</div>}
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
function AuthScreen() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [message, setMessage]   = useState(null);
  const [error, setError]       = useState(null);

  const handleSubmit = async () => {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Account created! You can now sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inp = { width: "100%", background: "#12101e", border: "1px solid #3b3556", borderRadius: 10, padding: "0.75rem 1rem", color: "white", fontSize: "0.95rem", boxSizing: "border-box", marginBottom: "0.75rem", outline: "none" };

  return (
    <div style={{ background: "#12101e", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🏐</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "white", margin: 0 }}>Reading the Game</h1>
          <p style={{ color: "#a78bfa", marginTop: "0.5rem", fontSize: "1rem" }}>Volleyball setter recognition trainer</p>
        </div>
        <div style={{ background: "#1e1a2e", borderRadius: 18, padding: "2rem", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <h2 style={{ color: "white", fontWeight: 700, fontSize: "1.15rem", marginBottom: "1.5rem", marginTop: 0 }}>
            {isSignUp ? "Create an Account" : "Welcome Back"}
          </h2>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inp, marginBottom: "1.25rem" }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          {error   && <p style={{ color: "#fca5a5", fontSize: "0.85rem", marginBottom: "0.75rem", background: "#2d1515", borderRadius: 8, padding: "0.5rem 0.75rem" }}>⚠️ {error}</p>}
          {message && <p style={{ color: "#86efac", fontSize: "0.85rem", marginBottom: "0.75rem", background: "#152d1e", borderRadius: 8, padding: "0.5rem 0.75rem" }}>✓ {message}</p>}
          <Btn color="purple" full disabled={loading || !email || !password} onClick={handleSubmit}>
            {loading ? "Please wait…" : isSignUp ? "Create Account" : "Sign In"}
          </Btn>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", textAlign: "center", marginTop: "1.25rem", marginBottom: 0 }}>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <span onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
              style={{ color: "#a78bfa", cursor: "pointer", fontWeight: 700 }}>
              {isSignUp ? "Sign In" : "Sign Up"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── SETUP MODE ────────────────────────────────────────────────────────────────
function SetupMode({ onSave, onCancel, userId }) {
  const [file, setFile]           = useState(null);
  const [objURL, setObjURL]       = useState(null);
  const [freezeAt, setFreezeAt]   = useState(null);
  const [answer, setAnswer]       = useState(null);
  const [label, setLabel]         = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjURL(url); setFreezeAt(null); setAnswer(null);
  }, [file]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !objURL) return;
    v.src = objURL; v.load();
  }, [objURL]);

  const markFreeze = () => {
    const t = videoRef.current?.currentTime;
    if (t != null && isFinite(t)) setFreezeAt(parseFloat(t.toFixed(2)));
  };

  const handleSave = async () => {
    setUploading(true); setError(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("videos").upload(path, file);
      if (upErr) throw upErr;
      const { data, error: dbErr } = await supabase.from("clips").insert({ user_id: userId, label: label.trim(), freeze_at: freezeAt, answer, video_path: path }).select().single();
      if (dbErr) throw dbErr;
      onSave(data);
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  };

  const canSave = file && freezeAt != null && answer && label.trim() && !uploading;
  const sectionStyle = { background: "#1e1a2e", borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" };
  const labelStyle = { color: "#a78bfa", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", marginBottom: "0.6rem", display: "block" };

  return (
    <div style={{ width: "100%", maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#a78bfa", cursor: "pointer", fontSize: "1.1rem" }}>←</button>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "white", margin: 0 }}>Upload Clip</h2>
      </div>

      <div style={sectionStyle}>
        <span style={labelStyle}>STEP 1 — SELECT VIDEO</span>
        <input type="file" accept="video/mp4,video/webm,video/*" onChange={e => { const f = e.target.files[0]; if (!f) return; setFile(f); setLabel(f.name.replace(/\.[^.]+$/, "")); }} style={{ color: "#e2e8f0", fontSize: "0.9rem" }} />
        {file && <p style={{ color: "#86efac", fontSize: "0.82rem", marginTop: "0.5rem", marginBottom: 0 }}>✓ {file.name}</p>}
      </div>

      {objURL && (
        <div style={sectionStyle}>
          <span style={labelStyle}>CLIP LABEL</span>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Rotation 2 – Quick Attack"
            style={{ width: "100%", background: "#12101e", border: "1px solid #3b3556", borderRadius: 10, padding: "0.65rem 0.9rem", color: "white", fontSize: "0.9rem", boxSizing: "border-box" }} />
        </div>
      )}

      {objURL && (
        <div style={sectionStyle}>
          <span style={labelStyle}>STEP 2 — MARK FREEZE POINT</span>
          <video ref={videoRef} controls playsInline style={{ width: "100%", borderRadius: 10, marginBottom: "0.75rem", background: "#000", display: "block" }} />
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <Btn color="purple" onClick={markFreeze}>🧊 Mark Current Frame</Btn>
            {freezeAt != null && <Tag color="green">✓ Freeze @ {fmtTime(freezeAt)}</Tag>}
          </div>
          <p style={{ color: "#4b5563", fontSize: "0.78rem", marginTop: "0.5rem", marginBottom: 0 }}>Play to the setter's touch moment, then click Mark.</p>
        </div>
      )}

      {freezeAt != null && (
        <div style={sectionStyle}>
          <span style={labelStyle}>STEP 3 — CORRECT ANSWER</span>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {CHOICES.map(c => <Btn key={c} color={answer === c ? "purple" : "ghost"} onClick={() => setAnswer(c)} style={answer === c ? { outline: "2px solid #a78bfa" } : {}}>{c}</Btn>)}
          </div>
        </div>
      )}

      {error && <p style={{ color: "#fca5a5", fontSize: "0.85rem", marginBottom: "0.75rem", background: "#2d1515", borderRadius: 8, padding: "0.5rem 0.75rem" }}>⚠️ {error}</p>}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Btn color="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn color="purple" disabled={!canSave} onClick={handleSave} style={{ flex: 1 }}>
          {uploading ? "⏳ Uploading…" : "Save Clip →"}
        </Btn>
      </div>
    </div>
  );
}

// ── TRAINING PLAYER ───────────────────────────────────────────────────────────
function TrainingPlayer({ clip, index, total, onResult, onQuit }) {
  const videoRef     = useRef(null);
  const rafRef       = useRef(null);
  const didFreezeRef = useRef(false);
  const [phase, setPhase]     = useState("loading");
  const [picked, setPicked]   = useState(null);
  const [videoURL, setVideoURL] = useState(null);

  useEffect(() => {
    if (!clip) return;
    setPhase("loading"); setPicked(null); didFreezeRef.current = false;
    supabase.storage.from("videos").createSignedUrl(clip.video_path, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) { setPhase("error"); return; }
        setVideoURL(data.signedUrl);
      });
  }, [clip]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoURL) return;
    v.src = videoURL; v.load();
  }, [videoURL]);

  const watchFreeze = useCallback(() => {
    const v = videoRef.current;
    if (!v || didFreezeRef.current) return;
    if (v.currentTime >= clip.freeze_at) {
      v.pause(); didFreezeRef.current = true; setPhase("frozen");
    } else { rafRef.current = requestAnimationFrame(watchFreeze); }
  }, [clip?.freeze_at]);

  const handleCanPlay = () => { if (phase === "loading") setPhase("idle"); };
  const handlePlay    = () => { cancelAnimationFrame(rafRef.current); didFreezeRef.current = false; setPhase("playing"); rafRef.current = requestAnimationFrame(watchFreeze); videoRef.current?.play(); };
  const handlePick    = (choice) => { cancelAnimationFrame(rafRef.current); setPicked(choice); setPhase("revealed"); };
  const handleResume  = () => { setPhase("playing"); videoRef.current?.play(); };
  const handleEnded   = () => setPhase("done");
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const correct = picked === clip?.answer;

  return (
    <div style={{ width: "100%", maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <button onClick={onQuit} style={{ background: "none", border: "none", color: "#a78bfa", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 }}>← Quit</button>
        <span style={{ color: "#a78bfa", fontSize: "0.85rem", fontWeight: 600 }}>Clip {index + 1} / {total}</span>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: "0.75rem" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < index ? "#7C3AED" : i === index ? "#c4b5fd" : "#231f31" }} />
        ))}
      </div>
      <div style={{ background: "#1e1a2e", borderRadius: 14, padding: "0.75rem", marginBottom: "0.75rem" }}>
        <span style={{ color: "white", fontWeight: 700 }}>{clip?.label}</span>
      </div>
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", marginBottom: "1rem" }}>
        <video ref={videoRef} onCanPlay={handleCanPlay} onEnded={handleEnded} playsInline style={{ width: "100%", display: "block" }} />
        {phase === "loading" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0008" }}>
            <span style={{ color: "#a78bfa", fontWeight: 700 }}>⏳ Loading…</span>
          </div>
        )}
        {phase === "frozen" && (
          <div style={{ position: "absolute", top: 12, right: 12, background: "rgba(124,58,237,0.95)", borderRadius: 8, padding: "0.35rem 0.8rem", color: "white", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.05em" }}>
            ⏸ READ THE SETTER
          </div>
        )}
        {phase === "revealed" && (
          <div style={{ position: "absolute", inset: 0, background: correct ? "rgba(22,163,74,0.4)" : "rgba(220,38,38,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: correct ? "#16a34a" : "#dc2626", borderRadius: 18, padding: "1.25rem 2.5rem", textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
              <div style={{ fontSize: "2.2rem" }}>{correct ? "✅" : "❌"}</div>
              <div style={{ color: "white", fontWeight: 800, fontSize: "1.2rem", marginTop: "0.25rem" }}>{correct ? "Correct!" : "Incorrect"}</div>
              {!correct && <div style={{ color: "#fca5a5", fontSize: "0.85rem", marginTop: "0.25rem" }}>Answer: {clip.answer}</div>}
            </div>
          </div>
        )}
      </div>
      {phase === "loading"  && <Btn color="ghost" full disabled>Loading video…</Btn>}
      {phase === "idle"     && <Btn color="purple" full onClick={handlePlay} style={{ padding: "1rem" }}>▶ Play Clip</Btn>}
      {phase === "frozen"   && (
        <div>
          <p style={{ color: "#c4b5fd", textAlign: "center", marginBottom: "0.75rem", fontWeight: 700, fontSize: "1rem" }}>Where is the setter going?</p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {CHOICES.map(c => <Btn key={c} color="dark" onClick={() => handlePick(c)} style={{ flex: 1, padding: "1rem", fontSize: "1rem" }}>{c}</Btn>)}
          </div>
        </div>
      )}
      {phase === "revealed" && <Btn color={correct ? "green" : "red"} full onClick={handleResume} style={{ padding: "1rem" }}>▶ See the Play</Btn>}
      {phase === "done" && (
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Btn color="ghost" onClick={onQuit} style={{ flex: 1 }}>← Quit</Btn>
          <Btn color="purple" onClick={() => onResult({ picked, answer: clip.answer, correct })} style={{ flex: 1, padding: "1rem" }}>Next Clip →</Btn>
        </div>
      )}
    </div>
  );
}

// ── SCORE SCREEN ──────────────────────────────────────────────────────────────
function ScoreScreen({ results, clips, onRetry, onHome }) {
  const correct = results.filter(r => r.correct).length;
  const pct = Math.round((correct / results.length) * 100);
  return (
    <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
      <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>{pct === 100 ? "🏆" : pct >= 60 ? "👍" : "📚"}</div>
      <h2 style={{ fontSize: "1.8rem", fontWeight: 800, color: "white", marginBottom: "0.25rem" }}>Session Complete</h2>
      <p style={{ color: "#a78bfa", marginBottom: "1.5rem", fontSize: "1.1rem" }}>{correct} / {results.length} correct reads</p>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <StatCard label="Accuracy" value={`${pct}%`} color={pct >= 60 ? "#16a34a" : "#dc2626"} />
        <StatCard label="Correct" value={correct} color="#7C3AED" />
        <StatCard label="Incorrect" value={results.length - correct} color="#6b7280" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2rem" }}>
        {results.map((r, i) => (
          <div key={i} style={{ background: "#1e1a2e", borderRadius: 10, padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${r.correct ? "#22c55e" : "#ef4444"}` }}>
            <span style={{ color: "white", fontWeight: 600, fontSize: "0.9rem" }}>{clips[i]?.label}</span>
            <span style={{ fontSize: "0.82rem", color: "#c4b5fd" }}>
              {r.picked} {r.correct ? <span style={{ color: "#86efac" }}>✓</span> : <span style={{ color: "#fca5a5" }}>✗ ({r.answer})</span>}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
        <Btn color="ghost" onClick={onHome}>← Home</Btn>
        <Btn color="purple" onClick={onRetry}>Try Again</Btn>
      </div>
    </div>
  );
}

// ── STATS TAB ─────────────────────────────────────────────────────────────────
function StatsTab({ userId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("stats").select("*").eq("user_id", userId).single()
      .then(({ data }) => { setStats(data); setLoading(false); });
  }, [userId]);

  const pct = stats && stats.total_guesses > 0
    ? Math.round((stats.total_correct / stats.total_guesses) * 100)
    : 0;

  if (loading) return <p style={{ color: "#a78bfa", textAlign: "center" }}>Loading stats…</p>;

  if (!stats || stats.total_guesses === 0) return (
    <div style={{ textAlign: "center", padding: "2rem 0" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📊</div>
      <p style={{ color: "#6b7280", fontSize: "0.95rem" }}>No stats yet — complete a training session to start tracking!</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <StatCard label="Accuracy" value={`${pct}%`} sub={`${stats.total_correct} of ${stats.total_guesses} correct`} color={pct >= 60 ? "#16a34a" : "#dc2626"} />
        <StatCard label="Total Guesses" value={stats.total_guesses} color="#7C3AED" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <StatCard label="Current Streak" value={`🔥 ${stats.current_streak}`} sub="correct in a row" color="#d97706" />
        <StatCard label="Best Streak" value={`⭐ ${stats.best_streak}`} sub="all time" color="#2563eb" />
      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]         = useState(null);
  const [authReady, setAuthReady]     = useState(false);
  const [screen, setScreen]           = useState("home");
  const [activeTab, setActiveTab]     = useState("library");
  const [clips, setClips]             = useState([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [results, setResults]         = useState([]);
  const [trainIndex, setTrainIndex]   = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoadingClips(true);
    supabase.from("clips").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setClips(data || []); setLoadingClips(false); });
  }, [session]);

  const updateStats = async (sessionResults) => {
    if (!session) return;
    const uid = session.user.id;
    const { data: existing } = await supabase.from("stats").select("*").eq("user_id", uid).single();

    const newCorrect  = sessionResults.filter(r => r.correct).length;
    const newTotal    = sessionResults.length;

    // Calculate new streak
    let currentStreak = existing?.current_streak || 0;
    for (const r of sessionResults) {
      if (r.correct) currentStreak++;
      else currentStreak = 0;
    }
    const bestStreak = Math.max(existing?.best_streak || 0, currentStreak);

    const payload = {
      user_id: uid,
      total_correct:   (existing?.total_correct  || 0) + newCorrect,
      total_guesses:   (existing?.total_guesses  || 0) + newTotal,
      current_streak:  currentStreak,
      best_streak:     bestStreak,
      updated_at:      new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("stats").update(payload).eq("user_id", uid);
    } else {
      await supabase.from("stats").insert(payload);
    }
  };

  const handleSaveClip   = (clip) => { setClips(prev => [clip, ...prev]); setScreen("home"); };
  const handleDeleteClip = async (id, videoPath) => {
    await supabase.storage.from("videos").remove([videoPath]);
    await supabase.from("clips").delete().eq("id", id);
    setClips(prev => prev.filter(c => c.id !== id));
  };
  const startTraining  = () => { setResults([]); setTrainIndex(0); setScreen("training"); };
  const handleResult   = async (result) => {
    const next = [...results, result];
    setResults(next);
    if (trainIndex + 1 < clips.length) {
      setTrainIndex(i => i + 1);
    } else {
      await updateStats(next);
      setScreen("score");
    }
  };
  const handleSignOut = () => supabase.auth.signOut();

  const shell = (children) => (
    <div style={{ background: "#12101e", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      {children}
    </div>
  );

  if (!authReady) return shell(<p style={{ color: "#a78bfa" }}>Loading…</p>);
  if (!session)   return <AuthScreen />;

  // ── HOME ───────────────────────────────────────────────────────────────────
  if (screen === "home") {
    const tabs = [
      { id: "library",  label: "📁 Library" },
      { id: "training", label: "🎯 Training" },
      { id: "stats",    label: "📊 Stats" },
    ];

    return shell(
      <div style={{ width: "100%", maxWidth: 640 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
          <div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", margin: 0 }}>🏐 Reading the Game</h1>
            <p style={{ color: "#6b7280", fontSize: "0.82rem", marginTop: "0.2rem" }}>Volleyball setter recognition trainer</p>
          </div>
          <button onClick={handleSignOut} style={{ background: "#1e1a2e", border: "1px solid #3b3556", borderRadius: 8, color: "#6b7280", fontSize: "0.8rem", padding: "0.4rem 0.85rem", cursor: "pointer" }}>Sign Out</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#1e1a2e", borderRadius: 12, padding: "0.3rem", marginBottom: "1.25rem", gap: "0.25rem" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ flex: 1, border: "none", borderRadius: 9, padding: "0.6rem", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                background: activeTab === t.id ? "#7C3AED" : "transparent",
                color: activeTab === t.id ? "white" : "#6b7280" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: "#1e1a2e", borderRadius: 16, padding: "1.25rem" }}>

          {/* LIBRARY TAB */}
          {activeTab === "library" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ color: "white", fontWeight: 700 }}>Your Clips</span>
                <Tag color="purple">{clips.length} clips</Tag>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem", minHeight: 60 }}>
                {loadingClips ? <p style={{ color: "#4b5563", fontSize: "0.85rem" }}>Loading clips…</p>
                  : clips.length === 0 ? <p style={{ color: "#4b5563", fontSize: "0.85rem", fontStyle: "italic" }}>No clips yet — upload your first one below.</p>
                  : clips.map(c => (
                    <div key={c.id} style={{ background: "#12101e", borderRadius: 10, padding: "0.65rem 0.9rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#e2e8f0", fontSize: "0.88rem", flex: 1, marginRight: "0.5rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
                      <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexShrink: 0 }}>
                        <Tag color="gray">⏱ {fmtTime(c.freeze_at)}</Tag>
                        <button onClick={() => handleDeleteClip(c.id, c.video_path)} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "0.9rem", padding: "0 0.2rem" }}>✕</button>
                      </div>
                    </div>
                  ))}
              </div>
              <Btn color="purple" full onClick={() => setScreen("setup")}>＋ Upload Clip</Btn>
            </div>
          )}

          {/* TRAINING TAB */}
          {activeTab === "training" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ color: "white", fontWeight: 700 }}>Training Session</span>
                <Tag color={clips.length > 0 ? "green" : "gray"}>{clips.length > 0 ? "Ready" : "No clips"}</Tag>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                {clips.length === 0
                  ? <p style={{ color: "#4b5563", fontSize: "0.85rem", fontStyle: "italic" }}>Upload at least one clip to start training.</p>
                  : <>
                      <div style={{ background: "#12101e", borderRadius: 10, padding: "0.7rem 0.9rem", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "#a78bfa", fontSize: "0.85rem" }}>Clips in session</span>
                        <span style={{ color: "white", fontWeight: 700, fontSize: "0.85rem" }}>{clips.length}</span>
                      </div>
                      {results.length > 0 && (
                        <div style={{ background: "#12101e", borderRadius: 10, padding: "0.7rem 0.9rem", display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#a78bfa", fontSize: "0.85rem" }}>Last session</span>
                          <span style={{ color: "white", fontWeight: 700, fontSize: "0.85rem" }}>{results.filter(r => r.correct).length} / {results.length} correct</span>
                        </div>
                      )}
                    </>
                }
              </div>
              <Btn color={clips.length === 0 ? "ghost" : "green"} full disabled={clips.length === 0} onClick={startTraining} style={{ padding: "1rem" }}>
                ▶ Start Training
              </Btn>
            </div>
          )}

          {/* STATS TAB */}
          {activeTab === "stats" && <StatsTab userId={session.user.id} />}
        </div>
      </div>
    );
  }

  if (screen === "setup")    return shell(<SetupMode onSave={handleSaveClip} onCancel={() => setScreen("home")} userId={session.user.id} />);
  if (screen === "training") return shell(<TrainingPlayer clip={clips[trainIndex]} index={trainIndex} total={clips.length} onResult={handleResult} onQuit={() => setScreen("home")} />);
  if (screen === "score")    return shell(<ScoreScreen results={results} clips={clips} onRetry={startTraining} onHome={() => setScreen("home")} />);
}