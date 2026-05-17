import { useState, useEffect, useRef } from "react";

const C = {
  rose:     "#c4536a",
  roseSoft: "#fce4ea",
  text:     "#3d1a24",
  muted:    "#9a6070",
  border:   "#f0b8c4",
};

function renderMarkdown(text) {
  return text.split("\n").map((line, i) => {
    const isBullet = /^[-*]\s/.test(line);
    const raw = isBullet ? line.replace(/^[-*]\s/, "") : line;

    const parts = raw.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : p
    );

    if (isBullet) return (
      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
        <span style={{ color: C.rose, flexShrink: 0, marginTop: 2 }}>•</span>
        <span>{parts}</span>
      </div>
    );
    if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
    return <div key={i} style={{ marginBottom: 4 }}>{parts}</div>;
  });
}

const SUGGESTED = [
  "Why might I be earning less than my male peers?",
  "How can I negotiate a higher salary?",
  "What factors affect my promotion chances?",
  "What should I say in my next performance review?",
];

export default function WhyTheGapTab({ p, mlResult }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [initializing, setInitializing] = useState(true);
  const feedRef                   = useRef(null);

  const userProfile = {
    name:                  p.name || "Unknown",
    age:                   p.age,
    gender:                p.gender || "N/A",
    field:                 p.field || "N/A",
    role:                  p.specific_role || p.field || "N/A",
    gpa:                   p.gpa,
    internships:           p.internships,
    job_level:             ["Student/pre-career","Entry level","Mid level","Senior level","Executive"][p.job_level] || p.job_level,
    networking_score:      p.networking_score,
    starting_salary:       p.starting_salary,
    pay_gap:               mlResult
      ? Math.abs(((mlResult.male?.base_salary - mlResult.female?.base_salary) /
          (mlResult.male?.base_salary || 1)) * 100).toFixed(1)
      : "N/A",
    promotion_probability: mlResult
      ? Math.round((mlResult.female?.prob ?? 0) * 100)
      : "N/A",
    marital_status:        p.married ? "Yes" : "No",
    maternity_leave_taken: p.leavePast ? "Yes" : "No",
    maternity_leave_planned: p.leaveSoon ? "Yes" : "No",
  };

  const callChat = async (history) => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, user_profile: userProfile }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        console.error("Chat API error:", await res.text());
      }
    } catch (err) {
      console.error("Chat fetch error:", err);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  // Fire opening summary on mount
  useEffect(() => { callChat([]); }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    await callChat(newHistory);
  };

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px 80px" }}>
      <style>{`
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30%            { transform: translateY(-6px); opacity: 1; }
        }
        #whygap-input:focus { border-color: #c4536a !important; outline: none; }
      `}</style>

      <div style={{
        background: "#fff",
        border: `1.5px solid ${C.border}`,
        borderRadius: 24,
        boxShadow: "0 2px 24px #c4536a0a",
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 180px)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "28px 32px 20px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <h2 style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 28, fontWeight: 700,
            color: C.text, margin: "0 0 6px",
          }}>
            Understand Your Trajectory
          </h2>
          <p style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: 10, color: C.muted,
            textTransform: "uppercase", letterSpacing: "0.13em",
            margin: 0,
          }}>
            AI analysis based on your unique profile &amp; similar professional clusters
          </p>
        </div>

        {/* ── Chat Feed ── */}
        <div ref={feedRef} style={{
          flex: 1, overflowY: "auto",
          padding: "24px 32px",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "78%",
                background:   msg.role === "user" ? C.rose : C.roseSoft,
                color:        msg.role === "user" ? "#fff" : C.text,
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding: "12px 16px",
                fontSize: 14, lineHeight: 1.65,
                fontFamily: "'DM Sans',sans-serif",
                boxShadow: "0 1px 8px #c4536a10",
              }}>
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                background: C.roseSoft,
                borderRadius: "18px 18px 18px 4px",
                padding: "14px 18px",
                display: "flex", gap: 6, alignItems: "center",
              }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: C.rose,
                    animation: `typingDot 1.2s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Suggested Questions ── */}
        {!initializing && messages.length <= 1 && !loading && (
          <div style={{
            padding: "0 24px 12px",
            display: "flex", flexWrap: "wrap", gap: 8,
            flexShrink: 0,
          }}>
            {SUGGESTED.map((q, i) => (
              <button key={i} onClick={() => setInput(q)} style={{
                background: "#fff",
                border: `1.5px solid ${C.border}`,
                borderRadius: 99,
                padding: "7px 14px",
                fontSize: 12,
                fontFamily: "'DM Sans',sans-serif",
                color: C.muted,
                cursor: "pointer",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.target.style.borderColor = C.rose; e.target.style.color = C.rose; }}
              onMouseLeave={e => { e.target.style.borderColor = C.border; e.target.style.color = C.muted; }}
              >{q}</button>
            ))}
          </div>
        )}

        {/* ── Input Bar ── */}
        <div style={{
          padding: "14px 24px 20px",
          borderTop: `1px solid ${C.border}`,
          display: "flex", gap: 10, alignItems: "center",
          flexShrink: 0,
        }}>
          <input
            id="whygap-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendMessage()}
            placeholder="Ask about your pay gap, promotion chances, negotiation..."
            disabled={loading}
            style={{
              flex: 1,
              background: "#fff",
              border: `1.5px solid ${C.border}`,
              borderRadius: 99,
              padding: "12px 20px",
              fontSize: 14,
              fontFamily: "'DM Sans',sans-serif",
              color: C.text,
              outline: "none",
              transition: "border-color 0.15s",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? "#e8c5cc" : C.rose,
              color: "#fff",
              border: "none",
              borderRadius: 99,
              padding: "12px 22px",
              fontSize: 13, fontWeight: 600,
              cursor: loading || !input.trim() ? "default" : "pointer",
              fontFamily: "'DM Sans',sans-serif",
              whiteSpace: "nowrap",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            Send →
          </button>
        </div>
      </div>
    </div>
  );
}
