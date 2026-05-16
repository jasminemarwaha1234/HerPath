import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import heroBg from "./assets/pink2.webp";

const C = {
  bg:       "#fff0f3",
  bgSoft:   "#ffe4ea",
  card:     "#ffffff",
  cardSoft: "#ffd6de",
  rose:     "#c4536a",
  roseDark: "#9e3a52",
  roseSoft: "#fce4ea",
  mauve:    "#a05570",
  mint:     "#2d8c72",
  sky:      "#3a7ca5",
  text:     "#3d1a24",
  muted:    "#9a6070",
  border:   "#f0b8c4",
  man:      "#3a7ca5",
  woman:    "#c4536a",
  actual:   "#2d8c72",
};

const FIELDS = ["Technology","Finance","Healthcare","Education","Marketing","Engineering","Law","Consulting"];
const EDU    = ["High School","Associate's","Bachelor's","Master's","PhD","JD / MD"];
const CITIES = [
  { name:"New York, NY",      avg:95000,  pct:48, opp:"High"   },
  { name:"San Francisco, CA", avg:115000, pct:44, opp:"High"   },
  { name:"Austin, TX",        avg:82000,  pct:47, opp:"Medium" },
  { name:"Chicago, IL",       avg:79000,  pct:50, opp:"Medium" },
  { name:"Seattle, WA",       avg:108000, pct:43, opp:"High"   },
  { name:"Boston, MA",        avg:88000,  pct:49, opp:"High"   },
  { name:"Atlanta, GA",       avg:74000,  pct:51, opp:"Medium" },
  { name:"Denver, CO",        avg:78000,  pct:46, opp:"Medium" },
];

function genTrajectory(p) {
  const start = Math.max(22, parseInt(p.age) - parseInt(p.exp));
  const entry = p.salary * 0.45;
  return Array.from({ length: 65 - start + 1 }, (_, i) => {
    const a = start + i;
    const man = Math.round(entry * Math.pow(1.065, i));
    let woman = Math.round(entry * Math.pow(1.045, i));
    if (p.leavePast && a >= parseInt(p.age) - 2 && a <= parseInt(p.age) + 2)
      woman = Math.round(woman * 0.935);
    if (p.leaveSoon && a >= parseInt(p.age) && a <= parseInt(p.age) + 3)
      woman = Math.round(woman * 0.93);
    if (p.married && a >= parseInt(p.age))
      woman = Math.round(woman * 0.991);
    const actual = a <= parseInt(p.age)
      ? Math.round(p.salary * Math.pow(1.03, a - parseInt(p.age)))
      : null;
    return { age: a, man, woman, actual };
  });
}

const fmt = v => `$${Math.round(v / 1000)}k`;

const Tag = ({ children, neg }) => (
  <span style={{
    background: neg ? "#fce4ea" : "#d4f0e8",
    color: neg ? C.rose : C.mint,
    borderRadius: 99, padding: "3px 11px",
    fontSize: 10, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
    border: `1px solid ${neg ? "#f0b8c4" : "#a8ddd0"}`,
  }}>
    {children}
  </span>
);

const StatPill = ({ label, value, sub, accent }) => (
  <div style={{
    background: accent ? C.roseSoft : C.card,
    border: `1.5px solid ${accent ? C.rose + "66" : C.border}`,
    borderRadius: 18, padding: "18px 20px",
    display: "flex", flexDirection: "column", gap: 4,
  }}>
    <span style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.13em", fontFamily: "'DM Mono',monospace" }}>{label}</span>
    <span style={{ fontSize: 26, fontWeight: 800, color: accent ? C.rose : C.text, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1.1 }}>{value}</span>
    {sub && <span style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{sub}</span>}
  </div>
);

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 12, fontFamily: "'DM Mono',monospace", boxShadow: "0 4px 20px #c4536a15" }}>
      <p style={{ color: C.muted, marginBottom: 6 }}>Age {label}</p>
      {payload.map(p => p.value != null && (
        <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
};

const ToggleBtn = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, background: active ? C.roseSoft : "#fff",
    border: `1.5px solid ${active ? C.rose : C.border}`,
    borderRadius: 14, padding: "16px 18px", cursor: "pointer",
    color: active ? C.roseDark : C.muted,
    textAlign: "left", display: "flex", alignItems: "center", gap: 12,
    fontSize: 13, fontFamily: "'DM Sans',sans-serif", transition: "all 0.15s",
  }}>
    <span style={{ fontSize: 22 }}>{icon}</span>
    {label}
  </button>
);

export default function HerPath() {
  const [step, setStep] = useState(0);
  const [tab,  setTab]  = useState("trajectory");
  const [heroVisible, setHeroVisible] = useState(true);
  const formRef = useRef(null);

  const [p, setP] = useState({
    name: "", age: 32, salary: 75000, field: "Technology",
    edu: "Bachelor's", exp: 8,
    married: false, leavePast: false, leaveSoon: false,
    location: "New York, NY", role: "Senior Engineer",
  });

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;0,800;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    document.body.style.overflow = heroVisible ? "hidden" : "auto";
    document.documentElement.style.overflow = heroVisible ? "hidden" : "auto";
  }, [heroVisible]);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => setHeroVisible(false), 800);
  };

  const traj     = genTrajectory(p);
  const curAge   = parseInt(p.age);
  const manNow   = traj.find(d => d.age === curAge)?.man || p.salary;
  const gapPct   = Math.round((1 - p.salary / manNow) * 100);
  const lifetime = Math.round(traj.reduce((s, d) => s + Math.max(0, (d.man || 0) - (d.woman || 0)), 0));

  const inp = {
    background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10,
    color: C.text, padding: "11px 14px", fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", width: "100%", outline: "none",
    boxSizing: "border-box",
  };
  const lbl = {
    fontSize: 10, color: C.muted, textTransform: "uppercase",
    letterSpacing: "0.13em", fontFamily: "'DM Mono',monospace",
    marginBottom: 6, display: "block",
  };

  const TABS = [
    { id: "trajectory", icon: "📈", label: "Trajectory"  },
    { id: "life",       icon: "🌸", label: "Life events" },
    { id: "tasks",      icon: "📋", label: "Task load"   },
  ];

  const lifeEvents = [
    p.married   && { age: curAge - 2, icon: "💍", label: "Marriage",                impact: "−2–3% trajectory", neg: true  },
    p.leavePast && { age: curAge - 1, icon: "🤱", label: "Maternity leave (taken)", impact: "−7% on return",    neg: true  },
    p.leavePast && { age: curAge,     icon: "📋", label: "Post-leave reassignment", impact: "+12% admin load",  neg: true  },
    p.leaveSoon && { age: curAge + 1, icon: "📅", label: "Planned maternity leave", impact: "−7–12% projected", neg: true  },
                   { age: curAge + 3, icon: "📈", label: "Promotion window",        impact: "Critical moment",  neg: false },
  ].filter(Boolean);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: C.bg, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }
        select option { background: #fff; color: #3d1a24; }
        input:focus, select:focus { border-color: #c4536a !important; }
      `}</style>

      {/* ══ HERO ══ */}
      {heroVisible && (
        <div style={{
          minHeight: "100vh",
          width: "100%",
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "60px 32px 48px", textAlign: "center",
          flexShrink: 0,
        }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: "clamp(230px, 14vw, 130px)",
            fontWeight: 800, lineHeight: 1.0,
            margin: "0 0 16px",
          }}>
            <span style={{ color: "#fff" }}>Her</span>
            <em style={{ color: C.rose, fontStyle: "italic" }}>Path</em>
          </h1>
          <p style={{ color: "#5a2535", fontSize: 15, fontFamily: "'DM Mono',monospace", maxWidth: 4000, lineHeight: 4, marginBottom: 36 }}>
            find out how gender, life events, and hidden labor shape your salary and what to do about it.
          </p>
          <button onClick={scrollToForm} style={{
            background: C.rose, color: "#fff", border: "none",
            borderRadius: 99, padding: "14px 36px",
            fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", letterSpacing: "0.02em",
          }}>
            Get started
          </button>
          <div style={{ marginTop: 28, fontSize: 20, color: "#c4536a88", animation: "bounce 2s infinite" }}>↓</div>
        </div>
      )}

      {/* ══ FORM + RESULTS ══ */}
      <div ref={formRef} style={{ background: C.bg, padding: "64px 20px 80px", minHeight: "100vh" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {step === 0 && (
            <>
              {/* Profile card */}
              <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 24, padding: 32, marginBottom: 18, boxShadow: "0 2px 24px #c4536a0a" }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, marginBottom: 24, color: C.text }}>
                  Tell us about yourself 🌷
                </h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
                  {[
                    { label: "First name",         key: "name",   type: "text",   ph: "e.g. Sarah" },
                    { label: "Age",                 key: "age",    type: "number"  },
                    { label: "Current salary ($)",  key: "salary", type: "number"  },
                    { label: "Years of experience", key: "exp",    type: "number"  },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={lbl}>{f.label}</label>
                      <input style={inp} type={f.type} placeholder={f.ph || ""} value={p[f.key]}
                        onChange={e => setP({ ...p, [f.key]: f.type === "number" ? (parseInt(e.target.value) || 0) : e.target.value })} />
                    </div>
                  ))}
                  {[
                    { label: "Field / industry", key: "field",    opts: FIELDS },
                    { label: "Education",         key: "edu",      opts: EDU    },
                    { label: "Location",          key: "location", opts: CITIES.map(c => c.name) },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={lbl}>{f.label}</label>
                      <select style={inp} value={p[f.key]} onChange={e => setP({ ...p, [f.key]: e.target.value })}>
                        {f.opts.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label style={lbl}>Current / desired role</label>
                    <input style={inp} placeholder="e.g. Senior Engineer" value={p.role}
                      onChange={e => setP({ ...p, role: e.target.value })} />
                  </div>
                </div>
              </div>

              {/* Life circumstances */}
              <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 24, padding: 32, marginBottom: 22, boxShadow: "0 2px 24px #c4536a0a" }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 6, color: C.text }}>
                  Life circumstances 🌸
                </h2>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>
                  These have measurable, documented impacts on salary trajectory.
                </p>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <ToggleBtn icon="💍" label="Are you currently married?"      active={p.married}   onClick={() => setP({ ...p, married: !p.married })} />
                  <ToggleBtn icon="🤱" label="Have you taken maternity leave?" active={p.leavePast} onClick={() => setP({ ...p, leavePast: !p.leavePast })} />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <ToggleBtn icon="📅" label="Planning maternity leave soon?"  active={p.leaveSoon} onClick={() => setP({ ...p, leaveSoon: !p.leaveSoon })} />
                  <div style={{ flex: 1 }} />
                </div>
              </div>

              <button onClick={() => setStep(1)} style={{
                width: "100%", background: C.rose, color: "#fff", border: "none",
                borderRadius: 16, padding: "18px 32px", fontSize: 15, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif", letterSpacing: "0.02em",
              }}>
                Analyze my trajectory →
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <button onClick={() => setStep(0)} style={{
                background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 99,
                padding: "7px 18px", fontSize: 11, color: C.muted,
                cursor: "pointer", fontFamily: "'DM Mono',monospace", marginBottom: 20,
              }}>
                ← Edit profile
              </button>

              <p style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 16 }}>
                {p.name ? `${p.name}'s` : "Your"} analysis · {p.field} · {p.location}
              </p>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                <StatPill label="Your salary"            value={fmt(p.salary)} sub={p.role} />
                <StatPill label="Gap vs. male peer"      value={`−${gapPct}%`} sub={`${fmt(manNow)} avg for men`} accent />
                <StatPill label="Projected lifetime loss" value={fmt(lifetime)} sub="vs. male trajectory" accent />
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} style={{
                    background: tab === t.id ? C.rose : "#fff",
                    border: `1.5px solid ${tab === t.id ? C.rose : C.border}`,
                    borderRadius: 99, padding: "8px 18px", fontSize: 12,
                    color: tab === t.id ? "#fff" : C.muted,
                    cursor: "pointer", fontFamily: "'DM Mono',monospace",
                    display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                  }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ background: C.card, border: `1.5px solid ${C.border}`, borderRadius: 24, padding: 28, boxShadow: "0 2px 24px #c4536a0a" }}>

                {tab === "trajectory" && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
                      Salary trajectory to retirement
                    </h3>
                    <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>
                      Modeled using BLS growth rates + gender gap research · Hardcoded data
                    </p>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={traj} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          {[["wG", C.woman], ["mG", C.man], ["aG", C.actual]].map(([id, col]) => (
                            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={col} stopOpacity={0.2} />
                              <stop offset="95%" stopColor={col} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="age" tick={{ fill: C.muted, fontSize: 11 }} />
                        <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} />
                        <Tooltip content={<CustomTip />} />
                        <Area type="monotone" dataKey="man"    stroke={C.man}    fill="url(#mG)" strokeWidth={2}   name="Man (same role)"   dot={false} />
                        <Area type="monotone" dataKey="woman"  stroke={C.woman}  fill="url(#wG)" strokeWidth={2.5} name="Woman (modeled)"    dot={false} />
                        <Area type="monotone" dataKey="actual" stroke={C.actual} fill="url(#aG)" strokeWidth={2}   name="Your current pace" dot={false} connectNulls={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
                      {[[C.man,"Man — same role"],[C.woman,"Woman (modeled)"],[C.actual,"Your pace"]].map(([col, l]) => (
                        <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
                          <div style={{ width: 18, height: 2.5, background: col, borderRadius: 2 }} />{l}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === "life" && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
                      Life events & career impact
                    </h3>
                    <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 24 }}>
                      How marriage, maternity leave & expectations shape your salary pace
                    </p>
                    <div style={{ position: "relative", paddingLeft: 30 }}>
                      <div style={{ position: "absolute", left: 12, top: 0, bottom: 0, width: 1, background: C.border }} />
                      {lifeEvents.map((evt, i) => (
                        <div key={i} style={{ marginBottom: 24, position: "relative" }}>
                          <div style={{ position: "absolute", left: -24, top: 2, width: 20, height: 20, borderRadius: "50%", background: C.roseSoft, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                            {evt.icon}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 3 }}>Age {evt.age}</div>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 5, color: C.text }}>{evt.label}</div>
                          <Tag neg={evt.neg}>{evt.impact}</Tag>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: C.roseSoft, borderRadius: 16, padding: 20, marginTop: 10, border: `1px solid ${C.border}` }}>
                      <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, marginBottom: 14, color: C.text }}>
                        The motherhood penalty — by the numbers
                      </p>
                      {[
                        ["Avg salary drop on return from leave",  "−7%",    "HBR / BLS"],
                        ["Promotion speed after first child",      "−23%",   "McKinsey Women in the Workplace"],
                        ["Likelihood assigned admin tasks",         "+34%",   "LeanIn.org"],
                        ["Lifetime gap vs. child-free women",      "−$400k", "U.S. Census Bureau"],
                      ].map(([l, v, s]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                          <div>
                            <div style={{ fontSize: 13, color: C.text }}>{l}</div>
                            <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>Source: {s}</div>
                          </div>
                          <span style={{ fontSize: 20, fontWeight: 800, color: C.rose, fontFamily: "'Cormorant Garamond',serif", minWidth: 70, textAlign: "right" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {tab === "tasks" && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
                      Task distribution
                    </h3>
                    <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 22 }}>
                      % of work time on non-promotable tasks — same role, same level · Hardcoded data
                    </p>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart layout="vertical" margin={{ left: 10, right: 10 }}
                        data={[
                          { task: "Core role work",     w: 62, m: 80 },
                          { task: "Admin / scheduling", w: 14, m: 8  },
                          { task: "Meeting notes",      w: 9,  m: 4  },
                          { task: "Emotional support",  w: 8,  m: 8  },
                          { task: "Event planning",     w: 7,  m: 2  },
                        ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: C.muted, fontSize: 11 }} />
                        <YAxis type="category" dataKey="task" tick={{ fill: C.text, fontSize: 11 }} width={150} />
                        <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text }} />
                        <Legend wrapperStyle={{ fontSize: 12, color: C.muted }} />
                        <Bar dataKey="w" name="Woman" fill={C.woman} radius={[0, 7, 7, 0]} opacity={0.85} />
                        <Bar dataKey="m" name="Man"   fill={C.man}   radius={[0, 7, 7, 0]} opacity={0.7}  />
                      </BarChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 24 }}>
                      <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, fontWeight: 700, marginBottom: 14, color: C.text }}>
                        Tasks disproportionately assigned to women
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[
                          ["Taking meeting notes",      "~2 hrs/wk"],
                          ["Planning office events",    "~1.5 hrs/wk"],
                          ["Onboarding new staff",      "~3 hrs/wk"],
                          ["Emotional labor / support", "~2 hrs/wk"],
                          ["Scheduling & coordination", "~1 hr/wk"],
                          ["Administrative overflow",   "~2.5 hrs/wk"],
                        ].map(([task, time]) => (
                          <div key={task} style={{ background: C.roseSoft, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: C.text }}>{task}</span>
                            <span style={{ background: "#fff", color: C.rose, borderRadius: 99, padding: "3px 10px", fontSize: 10, fontFamily: "'DM Mono',monospace", border: `1px solid ${C.border}` }}>{time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Insight strip */}
              <div style={{ marginTop: 20, background: C.roseSoft, border: `1.5px solid ${C.border}`, borderRadius: 20, padding: "20px 26px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>💌</span>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 5, fontFamily: "'Cormorant Garamond',serif", color: C.text }}>
                    Key insight for {p.name || "you"}
                  </p>
                  <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65 }}>
                    In <strong style={{ color: C.text }}>{p.field}</strong>, you're earning an estimated{" "}
                    <strong style={{ color: C.rose }}>−{gapPct}%</strong> vs. a male peer with equal experience.
                    {p.leavePast ? " Past maternity leave is modeled to have reduced your trajectory by ~7%." : ""}
                    {p.leaveSoon ? " Upcoming leave may widen this gap by 7–12% over the next few years." : ""}
                    {" "}Negotiating at your next review could recover{" "}
                    <strong style={{ color: C.mint }}>{fmt(manNow * 0.05)}–{fmt(manNow * 0.12)}</strong>/yr.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
