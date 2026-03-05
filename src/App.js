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
  const c = { purple: "#7C3AED", green: "#16a34a", amber: "#d97706", red: "#dc2626", gray: "#4b5563" };
  return <span style={{ background: c[color] || c.gray, color: "white", borderRadius: 6, padding: "0.2rem 0.6rem", fontSize: "0.78rem", fontWeight: 700 }}>{children}</span>;
}

function Btn({ color = "ghost", onClick, disabled, full, children, style = {} }) {
  const base = { border: "none", borderRadius: 10, padding: "0.7rem 1.4rem", fontSize: "0.95rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "opacity 0.2s", ...(full ? { width: "100%" } : {}), ...style };
  const colors = { purple: { background: "#7C3AED", color: "white" }, ghost: { background: "#2a2540", color: "#c4b5fd" }, green: { background: "#16a34a", color: "white" }, red: { background: "#dc2626", color: "white" }, dark: { background: "#231f31", color: "#e2e8f0" } };
  return <button style={{ ...base, ...colors[color] }} onClick={disabled ? undefined : onClick}>{children}</button>;
}

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
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
        setMessage("Check your email for a confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: "100%", background: "#1a1625", border: "1px solid #3b3556", borderRadius: 8, padding: "0.65rem 0.75rem", color: "white", fontSize: "0.95rem", boxSizing: "border-box", marginBottom: "0.75rem" };

  return (
    <div style={{ background: "#12101e", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.25rem" }}>🏐</div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "white", margin: 0 }}>Reading the Game</h1>
          <p style={{ color: "#a78bfa", marginTop: "0.4rem" }}>Volleyball setter recognition trainer</p>
        </div>
        <div style={{ background: "#1e1a2e", borderRadius: 16, padding: "1.75rem" }}>
          <h2 style={{ color: "white", fontWeight: 700, fontSize: "1.1rem", marginBottom: "1.25rem", marginTop: 0 }}>
            {isSignUp ? "Create an Account" : "Sign In"}
          </h2>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle}
            onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          {error   && <p style={{ color: "#fca5a5", fontSize: "0.85rem", marginBottom: "0.75rem" }}>⚠️ {error}</p>}
          {message && <p style={{ color: "#86efac", fontSize: "0.85rem", marginBottom: "0.75rem" }}>✓ {message}</p>}
          <Btn color="purple" full disabled={loading || !email || !password} onClick={handleSubmit}>
            {loading ? "Please wait…" : isSignUp ? "Create Account" : "Sign In"}
          </Btn>
          <p style={{ color: "#6b7280", fontSize: "0.85rem", textAlign: "center", marginTop: "1rem", marginBottom: 0 }}>
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <span onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
              style={{ color: "#a78bfa", cursor: "pointer", fontWeight: 600 }}>
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
  const [file, setFile]         = useState(null);
  const [objURL, setObjURL]     = useState(null);
  const [freezeAt, setFreezeAt] = useState(null);
  const [answer, setAnswer]     = useState(null);
  const [label, setLabel]       = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjURL(url);
    setFreezeAt(null); setAnswer(null);
  }, [file]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !objURL) return;
    v.src = objURL;
    v.load();
  }, [objURL]);

  const markFreeze = () => {
    const t = videoRef.current?.currentTime;
    if (t != null && isFinite(t)) setFreezeAt(parseFloat(t.toFixed(2)));
  };

  const canSave = file && freezeAt != null && answer && label.trim() && !uploading;

  const handleSave = async () => {
    setUploading(true); setError(null);
    try {
      // Upload video to Supabase Storage under userId/filename
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("videos").upload(path, file);
      if (upErr) throw upErr;

      // Save metadata to clips table
      const { data, error: dbErr } = await supabase.from("clips").insert({
        user_id: userId,
        label: label.trim(),
        freeze_at: freezeAt,
        answer,
        video_path: path,
      }).select().single();
      if (dbErr) throw dbErr;

      onSave(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 640 }}>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "1.25rem", color: "white" }}>＋ Tag New Clip</h2>

      <div style={{ background: "#231f31", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
        <p style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>STEP 1 — Upload Video</p>
        <input type="file" accept="video/mp4,video/webm,video/*" onChange={e => { const f = e.target.files[0]; if (!f) return; setFile(f); setLabel(f.name.replace(/\.[^.]+$/, "")); }} style={{ color: "#e2e8f0", fontSize: "0.9rem" }} />
        {file && <p style={{ color: "#86efac", fontSize: "0.82rem", marginTop: "0.4rem" }}>✓ {file.name}</p>}
      </div>

      {objURL && (
        <div style={{ background: "#231f31", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
          <p style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.5rem" }}>CLIP LABEL</p>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Rotation 2 – Quick Attack"
            style={{ width: "100%", background: "#1a1625", border: "1px solid #3b3556", borderRadius: 8, padding: "0.5rem 0.75rem", color: "white", fontSize: "0.9rem", boxSizing: "border-box" }} />
        </div>
      )}

      {objURL && (
        <div style={{ background: "#231f31", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
          <p style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem" }}>STEP 2 — Mark Freeze Point</p>
          <video ref={videoRef} controls playsInline style={{ width: "100%", borderRadius: 8, marginBottom: "0.75rem", background: "#000", display: "block" }} />
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <Btn color="purple" onClick={markFreeze}>🧊 Mark Current Frame</Btn>
            {freezeAt != null && <Tag color="green">Freeze @ {fmtTime(freezeAt)}</Tag>}
          </div>
          <p style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: "0.5rem" }}>Play to the setter's touch moment, then click Mark.</p>
        </div>
      )}

      {freezeAt != null && (
        <div style={{ background: "#231f31", borderRadius: 12, padding: "1rem", marginBottom: "1.25rem" }}>
          <p style={{ color: "#a78bfa", fontWeight: 600, fontSize: "0.85rem", marginBottom: "0.75rem" }}>STEP 3 — Correct Answer</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {CHOICES.map(c => <Btn key={c} color={answer === c ? "purple" : "ghost"} onClick={() => setAnswer(c)} style={answer === c ? { outline: "2px solid #a78bfa" } : {}}>{c}</Btn>)}
          </div>
        </div>
      )}

      {error && <p style={{ color: "#fca5a5", fontSize: "0.85rem", marginBottom: "0.75rem" }}>⚠️ {error}</p>}

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <Btn color="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn color="purple" disabled={!canSave} onClick={handleSave}>
          {uploading ? "Uploading…" : "Save Clip →"}
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
  const [phase, setPhase]   = useState("loading");
  const [picked, setPicked] = useState(null);
  const [videoURL, setVideoURL] = useState(null);

  useEffect(() => {
    if (!clip) return;
    setPhase("loading"); setPicked(null); didFreezeRef.current = false;
    // Get a signed URL from Supabase Storage
    supabase.storage.from("videos").createSignedUrl(clip.video_path, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) { setPhase("error"); return; }
        setVideoURL(data.signedUrl);
      });
  }, [clip]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoURL) return;
    v.src = videoURL;
    v.load();
  }, [videoURL]);

  const watchFreeze = useCallback(() => {
    const v = videoRef.current;
    if (!v || didFreezeRef.current) return;
    if (v.currentTime >= clip.freeze_at) {
      v.pause(); didFreezeRef.current = true; setPhase("frozen");
    } else { rafRef.current = requestAnimationFrame(watchFreeze); }
  }, [clip?.freeze_at]);

  const handleCanPlay = () => { if (phase === "loading") setPhase("idle"); };
  const handlePlay = () => { cancelAnimationFrame(rafRef.current); didFreezeRef.current = false; setPhase("playing"); rafRef.current = requestAnimationFrame(watchFreeze); videoRef.current?.play(); };
  const handlePick = (choice) => { cancelAnimationFrame(rafRef.current); setPicked(choice); setPhase("revealed"); };
  const handleResume = () => { setPhase("playing"); videoRef.current?.play(); };
  const handleEnded = () => setPhase("done");
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const correct = picked === clip?.answer;

  return (
    <div style={{ width: "100%", maxWidth: 640 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <span style={{ color: "white", fontWeight: 700 }}>{clip?.label}</span>
        <span style={{ color: "#a78bfa", fontSize: "0.85rem" }}>Clip {index + 1} / {total}</span>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: "1rem" }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i < index ? "#7C3AED" : i === index ? "#c4b5fd" : "#312e3d" }} />
        ))}
      </div>
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", marginBottom: "1rem" }}>
        <video ref={videoRef} onCanPlay={handleCanPlay} onEnded={handleEnded} playsInline style={{ width: "100%", display: "block" }} />
        {phase === "loading" && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0008" }}><span style={{ color: "#a78bfa", fontWeight: 700 }}>⏳ Loading…</span></div>}
        {phase === "frozen" && <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(124,58,237,0.9)", borderRadius: 8, padding: "0.3rem 0.7rem", color: "white", fontWeight: 700, fontSize: "0.82rem" }}>⏸ READ THE SETTER</div>}
        {phase === "revealed" && (
          <div style={{ position: "absolute", inset: 0, background: correct ? "rgba(22,163,74,0.35)" : "rgba(220,38,38,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: correct ? "#16a34a" : "#dc2626", borderRadius: 16, padding: "1rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem" }}>{correct ? "✅" : "❌"}</div>
              <div style={{ color: "white", fontWeight: 700, fontSize: "1.1rem" }}>{correct ? "Correct!" : "Incorrect"}</div>
              {!correct && <div style={{ color: "#fca5a5", fontSize: "0.85rem", marginTop: "0.25rem" }}>Answer: {clip.answer}</div>}
            </div>
          </div>
        )}
      </div>
      {phase === "loading"  && <Btn color="ghost" full disabled>Loading video…</Btn>}
      {phase === "idle"     && <Btn color="purple" full onClick={handlePlay}>▶ Play Clip</Btn>}
      {phase === "frozen"   && (
        <div>
          <p style={{ color: "#c4b5fd", textAlign: "center", marginBottom: "0.75rem", fontWeight: 600 }}>Where is the setter going?</p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            {CHOICES.map(c => <Btn key={c} color="dark" onClick={() => handlePick(c)} style={{ flex: 1, padding: "0.85rem", fontSize: "1rem" }}>{c}</Btn>)}
          </div>
        </div>
      )}
      {phase === "revealed" && <Btn color={correct ? "green" : "red"} full onClick={handleResume}>▶ See the Play</Btn>}
      {phase === "done" && (
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Btn color="ghost" onClick={onQuit} style={{ flex: 1 }}>← Quit</Btn>
          <Btn color="purple" onClick={() => onResult({ picked, answer: clip.answer, correct })} style={{ flex: 1, padding: "0.85rem" }}>Next Clip →</Btn>
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
      <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "white", marginBottom: "0.25rem" }}>Session Complete</h2>
      <p style={{ color: "#a78bfa", marginBottom: "1.5rem", fontSize: "1.1rem" }}>{correct} / {results.length} correct reads</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2rem" }}>
        {results.map((r, i) => (
          <div key={i} style={{ background: "#231f31", borderRadius: 10, padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${r.correct ? "#22c55e" : "#ef4444"}` }}>
            <span style={{ color: "white", fontWeight: 600, fontSize: "0.9rem" }}>{clips[i]?.label}</span>
            <span style={{ fontSize: "0.82rem", color: "#c4b5fd" }}>You: {r.picked} {r.correct ? <span style={{ color: "#86efac" }}>✓</span> : <span style={{ color: "#fca5a5" }}>✗ ({r.answer})</span>}</span>
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

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]       = useState(null);
  const [authReady, setAuthReady]   = useState(false);
  const [screen, setScreen]         = useState("home");
  const [clips, setClips]           = useState([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [results, setResults]       = useState([]);
  const [trainIndex, setTrainIndex] = useState(0);

  // Listen for auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Load clips from Supabase when logged in
  useEffect(() => {
    if (!session) return;
    setLoadingClips(true);
    supabase.from("clips").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setClips(data || []); setLoadingClips(false); });
  }, [session]);

  const handleSaveClip  = (clip) => { setClips(prev => [clip, ...prev]); setScreen("home"); };
  const handleDeleteClip = async (id, videoPath) => {
    await supabase.storage.from("videos").remove([videoPath]);
    await supabase.from("clips").delete().eq("id", id);
    setClips(prev => prev.filter(c => c.id !== id));
  };
  const startTraining   = () => { setResults([]); setTrainIndex(0); setScreen("training"); };
  const handleResult    = (result) => {
    const next = [...results, result];
    setResults(next);
    if (trainIndex + 1 < clips.length) setTrainIndex(i => i + 1);
    else setScreen("score");
  };
  const handleSignOut = () => supabase.auth.signOut();

  const shell = (children) => (
    <div style={{ background: "#12101e", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", fontFamily: "system-ui, sans-serif" }}>
      {children}
    </div>
  );

  if (!authReady) return shell(<p style={{ color: "#a78bfa" }}>Loading…</p>);
  if (!session)   return <AuthScreen />;

  if (screen === "home") return shell(
    <div style={{ width: "100%", maxWidth: 640 }}>
      <div style={{ marginBottom: "2rem", textAlign: "center", position: "relative" }}>
        <div style={{ fontSize: "2.2rem", marginBottom: "0.25rem" }}>🏐</div>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "white", margin: 0 }}>Reading the Game</h1>
        <p style={{ color: "#a78bfa", marginTop: "0.4rem" }}>Volleyball setter recognition trainer</p>
        <button onClick={handleSignOut} style={{ position: "absolute", top: 0, right: 0, background: "none", border: "1px solid #3b3556", borderRadius: 8, color: "#6b7280", fontSize: "0.8rem", padding: "0.3rem 0.7rem", cursor: "pointer" }}>Sign Out</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        {/* Library */}
        <div style={{ background: "#1e1a2e", borderRadius: 16, padding: "1.25rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ color: "white", fontWeight: 700 }}>📁 Clip Library</span>
            <Tag color="purple">{clips.length}</Tag>
          </div>
          <p style={{ color: "#6b7280", fontSize: "0.82rem", marginBottom: "1rem" }}>Upload and tag your setter clips.</p>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "1rem", minHeight: 80 }}>
            {loadingClips ? <p style={{ color: "#4b5563", fontSize: "0.82rem" }}>Loading clips…</p>
              : clips.length === 0 ? <p style={{ color: "#4b5563", fontSize: "0.82rem", fontStyle: "italic" }}>No clips tagged yet.</p>
              : clips.map((c) => (
                <div key={c.id} style={{ background: "#231f31", borderRadius: 8, padding: "0.5rem 0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#e2e8f0", fontSize: "0.82rem", flex: 1, marginRight: "0.5rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
                  <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0, alignItems: "center" }}>
                    <Tag color="gray">⏱ {fmtTime(c.freeze_at)}</Tag>
                    <Tag color="purple">{c.answer}</Tag>
                    <button onClick={() => handleDeleteClip(c.id, c.video_path)} title="Remove"
                      style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "0.9rem", padding: "0 0.2rem" }}>✕</button>
                  </div>
                </div>
              ))}
          </div>
          <Btn color="purple" full onClick={() => setScreen("setup")}>＋ Tag a Clip</Btn>
        </div>

        {/* Training */}
        <div style={{ background: "#1e1a2e", borderRadius: 16, padding: "1.25rem", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ color: "white", fontWeight: 700 }}>🎯 Training</span>
            <Tag color={clips.length > 0 ? "green" : "gray"}>{clips.length > 0 ? "Ready" : "No clips"}</Tag>
          </div>
          <p style={{ color: "#6b7280", fontSize: "0.82rem", marginBottom: "1rem" }}>Test your setter reads on your tagged clips.</p>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "1rem" }}>
            {clips.length === 0
              ? <p style={{ color: "#4b5563", fontSize: "0.82rem", fontStyle: "italic" }}>Tag at least one clip to start training.</p>
              : <>
                  <div style={{ background: "#231f31", borderRadius: 8, padding: "0.6rem 0.75rem", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#a78bfa", fontSize: "0.82rem" }}>Clips available</span>
                    <span style={{ color: "white", fontWeight: 700, fontSize: "0.82rem" }}>{clips.length}</span>
                  </div>
                  {results.length > 0 && (
                    <div style={{ background: "#231f31", borderRadius: 8, padding: "0.6rem 0.75rem", display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#a78bfa", fontSize: "0.82rem" }}>Last session</span>
                      <span style={{ color: "white", fontWeight: 700, fontSize: "0.82rem" }}>{results.filter(r => r.correct).length} / {results.length} correct</span>
                    </div>
                  )}
                </>
            }
          </div>
          <Btn color={clips.length === 0 ? "ghost" : "green"} full disabled={clips.length === 0} onClick={startTraining}>▶ Start Training</Btn>
        </div>
      </div>
    </div>
  );

  if (screen === "setup")    return shell(<SetupMode onSave={handleSaveClip} onCancel={() => setScreen("home")} userId={session.user.id} />);
  if (screen === "training") return shell(<TrainingPlayer clip={clips[trainIndex]} index={trainIndex} total={clips.length} onResult={handleResult} onQuit={() => setScreen("home")} />);
  if (screen === "score")    return shell(<ScoreScreen results={results} clips={clips} onRetry={startTraining} onHome={() => setScreen("home")} />);
}