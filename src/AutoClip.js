// src/AutoClip.js
import { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { supabase } from "./supabaseClient";

const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;
const SAMPLE_INTERVAL = 4; // sample every 4 seconds
const CLIP_BEFORE = 3;
const CLIP_AFTER  = 6;
const BATCH_DELAY = 6000; // 6 second delay between batches
const BATCH_SIZE  = 4;    // only 4 frames per batch

function Btn({ color = "ghost", onClick, disabled, full, children, style = {} }) {
  const base = { border: "none", borderRadius: 10, padding: "0.7rem 1.4rem", fontSize: "0.95rem", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "all 0.2s", ...(full ? { width: "100%", boxSizing: "border-box" } : {}), ...style };
  const colors = { purple: { background: "#7C3AED", color: "white" }, ghost: { background: "#2a2540", color: "#c4b5fd" }, green: { background: "#16a34a", color: "white" }, red: { background: "#dc2626", color: "white" }, dark: { background: "#231f31", color: "#e2e8f0" } };
  return <button style={{ ...base, ...colors[color] }} onClick={disabled ? undefined : onClick}>{children}</button>;
}

function ProgressBar({ value, label }) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
        <span style={{ color: "#a78bfa", fontSize: "0.82rem", fontWeight: 600 }}>{label}</span>
        <span style={{ color: "white", fontSize: "0.82rem", fontWeight: 700 }}>{value}%</span>
      </div>
      <div style={{ background: "#231f31", borderRadius: 99, height: 8, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(90deg, #7C3AED, #a78bfa)", height: "100%", borderRadius: 99, width: `${value}%`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function fmtTime(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function extractFrame(video, canvas, time) {
  return new Promise((resolve) => {
    video.currentTime = time;
    video.onseeked = () => {
      canvas.width  = 320;
      canvas.height = 180;
      canvas.getContext("2d").drawImage(video, 0, 0, 320, 180);
      resolve(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
    };
  });
}

async function analyzeFrames(frames) {
  const parts = [];
  frames.forEach(({ base64, time }) => {
    parts.push({ text: `Frame at ${time.toFixed(1)}s:` });
    parts.push({ inline_data: { mime_type: "image/jpeg", data: base64 } });
  });
  parts.push({
    text: `You are analyzing frames from a volleyball match video to find setting moments.

A setting moment includes ANY of these:
- A player with hands raised above their head touching or about to touch the ball
- A player in a typical overhead setting posture (arms up, fingers spread)
- A player jumping or standing with arms extended upward near the ball
- Any moment that looks like it could be a volleyball set, even if partially visible
- Players near the net with hands up

Be GENEROUS in your detection — it is better to include too many timestamps than too few. If you see anything that might possibly be a set, include it.

Return ONLY a JSON array of the timestamps (numbers in seconds) where setting actions might be occurring. If truly nothing volleyball-related is visible return [].

Example response: [2.0, 4.0, 18.5, 34.0]

Respond with ONLY the JSON array, no other text.`
  });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    }
  );

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  console.log("Gemini raw response:", text);
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    console.log("Parsed timestamps:", parsed);
    return parsed;
  } catch (e) {
    console.error("Parse error:", e, "Raw text:", text);
    return [];
  }
}

function mergeTimestamps(timestamps, minGap = 5) {
  if (!timestamps.length) return [];
  const sorted = [...timestamps].sort((a, b) => a - b);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - merged[merged.length - 1] > minGap) merged.push(sorted[i]);
  }
  return merged;
}

export default function AutoClip({ onBack, userId }) {
  const [file, setFile]             = useState(null);
  const [previewURL, setPreviewURL] = useState(null);
  const [phase, setPhase]           = useState("idle");
  const [progress, setProgress]     = useState(0);
  const [statusMsg, setStatusMsg]   = useState("");
  const [timestamps, setTimestamps] = useState([]);
  const [clips, setClips]           = useState([]);
  const [ffmpegReady, setFfmpegReady] = useState(false);
  const [error, setError]           = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const ffmpegRef = useRef(new FFmpeg());

  useEffect(() => {
    const load = async () => {
      const ff = ffmpegRef.current;
      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`,   "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      setFfmpegReady(true);
    };
    load().catch(e => setError("Failed to load FFmpeg: " + e.message));
  }, []);

  const handleFile = (f) => {
    setFile(f);
    setPhase("idle");
    setTimestamps([]);
    setClips([]);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreviewURL(url);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.load();
      }
    }, 100);
  };

  const runAnalysis = async () => {
    if (!file || !videoRef.current) return;
    setError(null);
    const video    = videoRef.current;
    const canvas   = canvasRef.current;
    const duration = video.duration;

    // Step 1 — Extract frames
    setPhase("extracting");
    setStatusMsg("Extracting frames from video…");
    const times = [];
    for (let t = 0; t < duration; t += SAMPLE_INTERVAL) times.push(parseFloat(t.toFixed(1)));

    const allFrames = [];
    for (let i = 0; i < times.length; i++) {
      const base64 = await extractFrame(video, canvas, times[i]);
      allFrames.push({ base64, time: times[i] });
      setProgress(Math.round((i / times.length) * 100));
    }

    // Step 2 — Analyze with Gemini
    setPhase("analyzing");
    setStatusMsg("Analyzing frames with Gemini AI…");
    const batchSize = BATCH_SIZE;
    const allTimestamps = [];
    for (let i = 0; i < allFrames.length; i += batchSize) {
      const batch = allFrames.slice(i, i + batchSize);
      setStatusMsg(`Analyzing frames ${i + 1}–${Math.min(i + batchSize, allFrames.length)} of ${allFrames.length}…`);
      setProgress(Math.round((i / allFrames.length) * 100));
      const found = await analyzeFrames(batch);
      allTimestamps.push(...found);
      // Wait between batches to avoid rate limiting
      if (i + batchSize < allFrames.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    const merged = mergeTimestamps(allTimestamps);
    setTimestamps(merged);

    if (merged.length === 0) {
      setPhase("done");
      setStatusMsg("No setting moments detected. Try a different video or adjust the sample rate.");
      return;
    }

    setStatusMsg(`Found ${merged.length} setting moment${merged.length !== 1 ? "s" : ""}! Extracting clips…`);

    // Step 3 — Extract clips with FFmpeg
    setPhase("clipping");
    const ff = ffmpegRef.current;
    await ff.writeFile("input.mp4", await fetchFile(file));

    const outputClips = [];
    for (let i = 0; i < merged.length; i++) {
      const t       = merged[i];
      const start   = Math.max(0, t - CLIP_BEFORE);
      const end     = Math.min(duration, t + CLIP_AFTER);
      const clipDur = end - start;
      const outName = `clip_${i + 1}.mp4`;

      setStatusMsg(`Cutting clip ${i + 1} of ${merged.length} (${fmtTime(start)} – ${fmtTime(end)})…`);
      setProgress(Math.round((i / merged.length) * 100));

      await ff.exec(["-ss", String(start), "-i", "input.mp4", "-t", String(clipDur), "-c", "copy", outName]);
      const data    = await ff.readFile(outName);
      const blob    = new Blob([data.buffer], { type: "video/mp4" });
      const blobURL = URL.createObjectURL(blob);

      const path = `${userId}/autoclip_${Date.now()}_${i + 1}.mp4`;
      const { error: upErr } = await supabase.storage.from("videos").upload(path, blob);
      let dbClip = null;
      if (!upErr) {
        const { data: inserted } = await supabase.from("clips").insert({
          user_id:    userId,
          label:      `Auto Clip ${i + 1} @ ${fmtTime(t)}`,
          freeze_at:  CLIP_BEFORE,
          answer:     "Outside",
          video_path: path,
        }).select().single();
        dbClip = inserted;
      }

      outputClips.push({ blobURL, start, end, setAt: t, path, dbClip });
      await ff.deleteFile(outName);
    }

    await ff.deleteFile("input.mp4");
    setClips(outputClips);
    setPhase("done");
    setProgress(100);
    setStatusMsg(`Done! ${outputClips.length} clips extracted and saved to your library.`);
  };

  const sectionStyle = { background: "#1e1a2e", borderRadius: 14, padding: "1.25rem", marginBottom: "1rem" };

  return (
    <div style={{ width: "100%", maxWidth: 640, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#a78bfa", cursor: "pointer", fontSize: "1.1rem" }}>←</button>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "white", margin: 0 }}>⚡ Auto Clip</h2>
          <p style={{ color: "#6b7280", fontSize: "0.8rem", margin: 0 }}>Gemini AI-powered setter clip extractor</p>
        </div>
        {!ffmpegReady && <span style={{ marginLeft: "auto", color: "#6b7280", fontSize: "0.78rem" }}>⏳ Loading FFmpeg…</span>}
        {ffmpegReady  && <span style={{ marginLeft: "auto", color: "#86efac", fontSize: "0.78rem" }}>✓ FFmpeg ready</span>}
      </div>

      <div style={sectionStyle}>
        <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", display: "block", marginBottom: "0.6rem" }}>UPLOAD MATCH VIDEO</span>
        <input type="file" accept="video/mp4,video/webm,video/*" onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} style={{ color: "#e2e8f0", fontSize: "0.9rem" }} />
        {file && <p style={{ color: "#86efac", fontSize: "0.82rem", marginTop: "0.5rem", marginBottom: 0 }}>✓ {file.name}</p>}
      </div>

      <video ref={videoRef} style={{ display: "none" }} playsInline />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {file && phase === "idle" && (
        <div style={sectionStyle}>
          <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", display: "block", marginBottom: "0.6rem" }}>PREVIEW</span>
          <video src={previewURL} controls style={{ width: "100%", borderRadius: 10, background: "#000" }} />
          <p style={{ color: "#6b7280", fontSize: "0.78rem", marginTop: "0.6rem", marginBottom: 0 }}>
            Gemini will sample a frame every {SAMPLE_INTERVAL}s and detect all setting moments. Each clip will be {CLIP_BEFORE + CLIP_AFTER}s long.
          </p>
        </div>
      )}

      {["extracting", "analyzing", "clipping"].includes(phase) && (
        <div style={sectionStyle}>
          <ProgressBar value={progress} label={phase === "extracting" ? "Extracting Frames" : phase === "analyzing" ? "Gemini AI Analysis" : "Cutting Clips"} />
          <p style={{ color: "#c4b5fd", fontSize: "0.85rem", margin: 0 }}>{statusMsg}</p>
        </div>
      )}

      {error && (
        <div style={{ ...sectionStyle, background: "#2d1515", borderLeft: "4px solid #dc2626" }}>
          <p style={{ color: "#fca5a5", margin: 0, fontSize: "0.9rem" }}>⚠️ {error}</p>
        </div>
      )}

      {phase === "done" && (
        <div style={{ ...sectionStyle, background: clips.length > 0 ? "#152d1e" : "#1e1a2e", borderLeft: `4px solid ${clips.length > 0 ? "#16a34a" : "#6b7280"}` }}>
          <p style={{ color: clips.length > 0 ? "#86efac" : "#6b7280", margin: 0, fontWeight: 700 }}>
            {clips.length > 0 ? `✅ ${statusMsg}` : `ℹ️ ${statusMsg}`}
          </p>
        </div>
      )}

      {timestamps.length > 0 && (
        <div style={sectionStyle}>
          <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", display: "block", marginBottom: "0.75rem" }}>
            DETECTED SETTING MOMENTS ({timestamps.length})
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {timestamps.map((t, i) => (
              <span key={i} style={{ background: "#231f31", color: "#c4b5fd", borderRadius: 8, padding: "0.3rem 0.7rem", fontSize: "0.85rem", fontWeight: 600 }}>
                🏐 {fmtTime(t)}
              </span>
            ))}
          </div>
        </div>
      )}

      {clips.length > 0 && (
        <div style={sectionStyle}>
          <span style={{ color: "#a78bfa", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", display: "block", marginBottom: "0.75rem" }}>
            EXTRACTED CLIPS
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {clips.map((c, i) => (
              <div key={i} style={{ background: "#12101e", borderRadius: 10, padding: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ color: "white", fontWeight: 700, fontSize: "0.9rem" }}>Clip {i + 1}</span>
                  <span style={{ color: "#6b7280", fontSize: "0.78rem" }}>{fmtTime(c.start)} – {fmtTime(c.end)}</span>
                </div>
                <video src={c.blobURL} controls style={{ width: "100%", borderRadius: 8, background: "#000" }} />
                {c.dbClip && <p style={{ color: "#86efac", fontSize: "0.78rem", marginTop: "0.4rem", marginBottom: 0 }}>✓ Saved to your library as "{c.dbClip.label}"</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {file && phase === "idle" && (
        <Btn color="purple" full disabled={!ffmpegReady} onClick={runAnalysis} style={{ padding: "1rem", fontSize: "1rem" }}>
          {ffmpegReady ? "⚡ Start AI Analysis" : "⏳ Loading FFmpeg…"}
        </Btn>
      )}

      {phase === "done" && clips.length > 0 && (
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
          <Btn color="ghost" full onClick={() => { setPhase("idle"); setFile(null); setClips([]); setTimestamps([]); setPreviewURL(null); }}>
            Process Another Video
          </Btn>
          <Btn color="green" full onClick={onBack}>View in Library →</Btn>
        </div>
      )}
    </div>
  );
}