import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
import heroBg from "./assets/pink2.webp";
import supabase from "./lib/supabaseClient";

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

import { ROLES } from "./roles.js";


// ── Dropdown options ──────────────────────────────────────────────────────────
const GENDERS       = ["Female", "Male", "Non-binary / other"];
const JOB_LEVELS    = [
  { value: 0, label: "0 — Student / pre-career" },
  { value: 1, label: "1 — Entry level"          },
  { value: 2, label: "2 — Mid level"            },
  { value: 3, label: "3 — Senior level"         },
  { value: 4, label: "4 — Executive"            },
];
const INTERNSHIP_OPTIONS = [
  { value: 0, label: "0 — None"       },
  { value: 1, label: "1 internship"   },
  { value: 2, label: "2 internships"  },
  { value: 3, label: "3 internships"  },
  { value: 4, label: "4+ internships" },
];
const FIELDS = ["Technology","Finance","Healthcare","Education","Marketing","Engineering","Law","Consulting"];

// ── Trajectory model ──────────────────────────────────────────────────────────
function genTrajectory(p) {
  const age    = parseInt(p.age) || 28;
  const start  = Math.max(18, age - 5);
  const salary = parseInt(p.starting_salary) || 60000;
  return Array.from({ length: 65 - start + 1 }, (_, i) => {
    const a    = start + i;
    const man  = Math.round(salary * Math.pow(1.065, i));
    let woman  = Math.round(salary * Math.pow(1.045, i));
    if (p.leavePast && a >= age - 2 && a <= age + 2) woman = Math.round(woman * 0.935);
    if (p.leaveSoon && a >= age     && a <= age + 3) woman = Math.round(woman * 0.93);
    if (p.married   && a >= age)                     woman = Math.round(woman * 0.991);
    const actual = a <= age
      ? Math.round(salary * Math.pow(1.03, a - age))
      : null;
    return { age: a, man, woman, actual };
  });
}

const fmt = v => `$${Math.round(v / 1000)}k`;

// ── Small UI atoms ────────────────────────────────────────────────────────────
const Tag = ({ children, neg }) => (
  <span style={{
    background: neg ? "#fce4ea" : "#d4f0e8",
    color: neg ? C.rose : C.mint,
    borderRadius: 99, padding: "3px 11px",
    fontSize: 10, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
    border: `1px solid ${neg ? "#f0b8c4" : "#a8ddd0"}`,
  }}>{children}</span>
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
    <span style={{ fontSize: 22 }}>{icon}</span>{label}
  </button>
);

// ── Reusable slider field ──────────────────────────────────────────────────────
const SliderField = ({ label, hint, min, max, value, onChange, displayVal }) => (
  <div>
    <label style={LBL}>
      {label}
      <span style={{ float: "right", color: C.rose, fontWeight: 700, fontSize: 13 }}>
        {displayVal ?? value}
      </span>
    </label>
    <input
      type="range" min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: C.rose, cursor: "pointer" }}
    />
    {hint && <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{hint}</div>}
  </div>
);

// ── Shared styles ──────────────────────────────────────────────────────────────
const INP = {
  background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 10,
  color: C.text, padding: "11px 14px", fontSize: 14,
  fontFamily: "'DM Sans',sans-serif", width: "100%", outline: "none",
  boxSizing: "border-box",
};
const SEL = {
  ...INP,
  appearance: "none", WebkitAppearance: "none", cursor: "pointer",
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239a6070' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36,
};
const LBL = {
  fontSize: 10, color: C.muted, textTransform: "uppercase",
  letterSpacing: "0.13em", fontFamily: "'DM Mono',monospace",
  marginBottom: 6, display: "block",
};
const CARD = {
  background: "#fff", border: `1.5px solid ${C.border}`,
  borderRadius: 24, padding: 32, marginBottom: 18,
  boxShadow: "0 2px 24px #c4536a0a",
};
const SECTION_HEAD = {
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: 22, fontWeight: 700, marginBottom: 20, color: C.text,
};

// ═════════════════════════════════════════════════════════════════════════════
export default function HerPath() {
  const [step, setStep]         = useState(0);
  const [tab,  setTab]          = useState("trajectory");
  // const [heroVisible, setHV]    = useState(true);
  const [heroVisible, setHV] = useState(sessionStorage.getItem("started") !== "true");
  const formRef                 = useRef(null);

  // ── Form state matches Kaggle schema exactly ──────────────────────────────
  const [p, setP] = useState({
    // personal / display
    name:              "",
    // Kaggle fields
    age:               22,
    gender:            "Female",
    gpa:               3.5,           // University_GPA  (0.0–4.0)
    field:             "Technology",  // Field_of_Study / industry
    specific_role:     "",            // Specific_Role
    internships:       0,             // Internships_Completed (0–4)
    starting_salary:   60000,         // Starting_Salary
    networking_score:  5,             // Networking_Score (1–10)
    job_level:         1,             // Current_Job_Level (0–4)
    // life events (affect trajectory model)
    married:           false,
    leavePast:         false,
    leaveSoon:         false,
  });

  const set = (key, val) => setP(prev => ({ ...prev, [key]: val }));

  // ── Font load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0); 
    window.addEventListener("beforeunload", () => sessionStorage.removeItem("started"));
    const l = document.createElement("link");
    l.rel  = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;0,800;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }, []);

  // useEffect(() => {
  //   document.body.style.overflow            = heroVisible ? "hidden" : "auto";
  //   document.documentElement.style.overflow = heroVisible ? "hidden" : "auto";
  // }, [heroVisible]);

//   useEffect(() => {
//   setHV(true);
//   setStep(0);
//   window.scrollTo(0, 0);
// }, []);

  // const scrollToForm = () => {
  //   formRef.current?.scrollIntoView({ behavior: "smooth" });
  //   setTimeout(() => setHV(false), 800);
  // };
//   const scrollToForm = () => {
//   setHV(false);
//   //setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  
// };
const scrollToForm = () => {
  sessionStorage.setItem("started", "true");
  setHV(false);
};

  // ── Derived stats ──────────────────────────────────────────────────────────
  const traj     = genTrajectory(p);
  const curAge   = parseInt(p.age);
  const manNow   = traj.find(d => d.age === curAge)?.man || p.starting_salary;
  const gapPct   = Math.round((1 - p.starting_salary / manNow) * 100);
  const lifetime = Math.round(traj.reduce((s, d) => s + Math.max(0, (d.man || 0) - (d.woman || 0)), 0));

  const JOB_LEVEL_LABEL = JOB_LEVELS.find(j => j.value === p.job_level)?.label ?? "—";

  // ── Supabase submit ────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    const { error } = await supabase
      .from("user_inputs")
      .insert([{
        Age:                   parseInt(p.age),
        Gender:                p.gender,
        University_GPA:        parseFloat(p.gpa),
        Current_Role:          p.specific_role || null,
        Internships_Completed: parseInt(p.internships),
        Starting_Salary:       parseInt(p.starting_salary),
        Networking_Score:      parseInt(p.networking_score),
        Current_Job_Level:     parseInt(p.job_level),
      }]);
    if (error) console.error("Supabase error:", error);
    setStep(1);
  };

  // ── Life events timeline ───────────────────────────────────────────────────
  const lifeEvents = [
    p.married   && { age: curAge - 2, icon: "💍", label: "Marriage",                impact: "−2–3% trajectory",  neg: true  },
    p.leavePast && { age: curAge - 1, icon: "🤱", label: "Maternity leave (taken)", impact: "−7% on return",     neg: true  },
    p.leavePast && { age: curAge,     icon: "📋", label: "Post-leave reassignment", impact: "+12% admin load",   neg: true  },
    p.leaveSoon && { age: curAge + 1, icon: "📅", label: "Planned maternity leave", impact: "−7–12% projected",  neg: true  },
                   { age: curAge + 3, icon: "📈", label: "Promotion window",        impact: "Critical moment",   neg: false },
  ].filter(Boolean);

  const TABS = [
    { id: "trajectory", icon: "📈", label: "Trajectory"  },
    { id: "life",       icon: "🌸", label: "Life events" },
    { id: "tasks",      icon: "📋", label: "Task load"   },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", width: "100%", background: C.bg, color: C.text, fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }
        select option { background:#fff; color:#3d1a24; }
        input:focus, select:focus { border-color:#c4536a !important; }
        input[type=range]::-webkit-slider-thumb { accent-color: #c4536a; }
        html { scroll-behavior: auto; }
      `}</style>

      {/* ── HERO ── */}
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

      {/* ── FORM + RESULTS ── */}
      {!heroVisible && <div ref={formRef} style={{ background: C.bg, padding: "64px 20px 80px", minHeight: "100vh" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* ══════════════ STEP 0 — FORM ══════════════ */}
          {step === 0 && (
            <>

              {/* ── Card 1: About you ── */}
              <div style={CARD}>
                <h2 style={SECTION_HEAD}>About you 🌷</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

                  {/* Name */}
                  <div>
                    <label style={LBL}>First name</label>
                    <input style={INP} type="text" placeholder="e.g. Sarah"
                      value={p.name} onChange={e => set("name", e.target.value)} />
                  </div>

                  {/* Age */}
                  <div>
                    <label style={LBL}>Age</label>
                    <input style={INP} type="number" min="18" max="65" placeholder="e.g. 24"
                      value={p.age} onChange={e => set("age", e.target.value)} />
                  </div>

                  {/* Gender */}
                  <div>
                    <label style={LBL}>Gender</label>
                    <select style={SEL} value={p.gender} onChange={e => set("gender", e.target.value)}>
                      {GENDERS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>

                  {/* Field of study / industry */}
                  <div>
                    <label style={LBL}>Field / industry</label>
                    <select style={SEL} value={p.field} onChange={e => set("field", e.target.value)}>
                      {FIELDS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* Specific role
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={LBL}>Specific role / job title</label>
                    <input style={INP} type="text" placeholder="e.g. Software Engineer, Product Manager…"
                      value={p.specific_role} onChange={e => set("specific_role", e.target.value)} />
                  </div> */}
                  {/* Specific role */}
<div style={{ gridColumn: "1 / -1", position: "relative" }}>
  <label style={LBL}>Specific role / job title</label>
  <input style={INP} type="text" placeholder="Type to search e.g. Software…"
    value={p.specific_role}
    onChange={e => set("specific_role", e.target.value)}
    onBlur={() => setTimeout(() => set("_roleOpen", false), 150)}
    onFocus={() => set("_roleOpen", true)}
  />
  {p._roleOpen && p.specific_role.length > 0 && (
    <div style={{
      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 99,
      background: "#fff", border: `1.5px solid ${C.border}`,
      borderRadius: 12, marginTop: 4,
      boxShadow: "0 8px 24px #c4536a15", maxHeight: 200, overflowY: "auto",
    }}>
      {ROLES.filter(r => r.toLowerCase().includes(p.specific_role.toLowerCase()))
        .map(r => (
          <div key={r}
            onMouseDown={() => set("specific_role", r)}
            style={{
              padding: "10px 14px", fontSize: 13, cursor: "pointer",
              color: C.text, fontFamily: "'DM Sans',sans-serif",
              borderBottom: `1px solid ${C.border}`,
              transition: "background 0.1s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.roseSoft}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            {r}
          </div>
        ))}
    </div>
  )}
</div>

                </div>
              </div>

              {/* ── Card 2: Academic & career baseline ── */}
              <div style={CARD}>
                <h2 style={SECTION_HEAD}>Academic & career baseline 🎓</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                  {/* GPA slider */}
                  <SliderField
                    label="University GPA"
                    hint="0.0 – 4.0 scale"
                    min={0} max={40} value={Math.round(p.gpa * 10)}
                    onChange={v => set("gpa", v / 10)}
                    displayVal={p.gpa.toFixed(1)}
                  />

                  {/* Internships */}
                  <div>
                    <label style={LBL}>Internships completed</label>
                    <select style={SEL} value={p.internships}
                      onChange={e => set("internships", parseInt(e.target.value))}>
                      {INTERNSHIP_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Starting salary */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={LBL}>Starting salary ($/yr)</label>
                    <input style={INP} type="number" placeholder="e.g. 75000"
                      value={p.starting_salary || ""}
                      onChange={e => set("starting_salary", parseInt(e.target.value) || 0)} />
                  </div>

                </div>
              </div>

              {/* ── Card 3: Career position ── */}
              <div style={CARD}>
                <h2 style={SECTION_HEAD}>Career position 📊</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

                  {/* Current job level */}
                  <div>
                    <label style={LBL}>Current job level</label>
                    <select style={SEL} value={p.job_level}
                      onChange={e => set("job_level", parseInt(e.target.value))}>
                      {JOB_LEVELS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 4 }}>
                      Career stages: Entry → Mid → Senior → Executive
                    </div>
                  </div>

                  {/* Networking score */}
                  <SliderField
                    label="Networking score"
                    hint="1 = low activity · 10 = highly connected (LinkedIn, events, etc.)"
                    min={1} max={10} value={p.networking_score}
                    onChange={v => set("networking_score", v)}
                  />

                </div>
              </div>

              {/* ── Card 4: Life circumstances ── */}
              <div style={CARD}>
                <h2 style={SECTION_HEAD}>Life circumstances 🌸</h2>
                <p style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>
                  These have measurable, documented impacts on salary trajectory.
                </p>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <ToggleBtn icon="💍" label="Are you currently married?"      active={p.married}   onClick={() => set("married",   !p.married)}   />
                  <ToggleBtn icon="🤱" label="Have you taken maternity leave?" active={p.leavePast} onClick={() => set("leavePast", !p.leavePast)} />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <ToggleBtn icon="📅" label="Planning maternity leave soon?"  active={p.leaveSoon} onClick={() => set("leaveSoon", !p.leaveSoon)} />
                  <div style={{ flex: 1 }} />
                </div>
              </div>

              {/* ── Submit ── */}
              <button onClick={handleAnalyze} style={{
                width: "100%", background: C.rose, color: "#fff", border: "none",
                borderRadius: 16, padding: "18px 32px", fontSize: 15, fontWeight: 600,
                cursor: "pointer", fontFamily: "'DM Sans',sans-serif", letterSpacing: "0.02em",
                boxShadow: "0 4px 20px #c4536a33", transition: "background 0.2s",
              }}>
                Analyze my trajectory →
              </button>

              {/* schema hint for devs */}
              <p style={{ marginTop: 14, fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", textAlign: "center" }}>
                Fields: Age · Gender · University_GPA · Specific_Role · Internships_Completed · Starting_Salary · Networking_Score · Current_Job_Level
              </p>
            </>
          )}

          {/* ══════════════ STEP 1 — RESULTS ══════════════ */}
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
                {p.name ? `${p.name}'s` : "Your"} analysis · {p.field} · {p.specific_role || "your role"} · {JOB_LEVEL_LABEL}
              </p>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                <StatPill label="Starting salary"        value={fmt(p.starting_salary)} sub={p.specific_role || "your role"} />
                <StatPill label="Gap vs. male peer"      value={`−${gapPct}%`}          sub={`${fmt(manNow)} avg for men`}   accent />
                <StatPill label="Projected lifetime loss" value={fmt(lifetime)}          sub="vs. male trajectory"            accent />
              </div>

              {/* Profile summary chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {[
                  `GPA ${p.gpa.toFixed(1)}`,
                  `${p.internships} internship${p.internships !== 1 ? "s" : ""}`,
                  `Networking ${p.networking_score}/10`,
                  JOB_LEVEL_LABEL.split("—")[1]?.trim() || "Entry level",
                ].map(chip => (
                  <span key={chip} style={{
                    background: "#fff", border: `1px solid ${C.border}`,
                    borderRadius: 99, padding: "4px 12px",
                    fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace",
                  }}>
                    {chip}
                  </span>
                ))}
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
              <div style={{ background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 24, padding: 28, boxShadow: "0 2px 24px #c4536a0a" }}>

                {/* TRAJECTORY TAB */}
                {tab === "trajectory" && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
                      Salary trajectory to retirement
                    </h3>
                    <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>
                      Modeled using BLS growth rates + gender gap research · Starting from ${p.starting_salary.toLocaleString()}
                    </p>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={traj} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          {[["wG", C.woman], ["mG", C.man], ["aG", C.actual]].map(([id, col]) => (
                            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={col} stopOpacity={0.2} />
                              <stop offset="95%" stopColor={col} stopOpacity={0}   />
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

                {/* LIFE EVENTS TAB */}
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

                {/* TASKS TAB */}
                {tab === "tasks" && (
                  <>
                    <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
                      Task distribution
                    </h3>
                    <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 22 }}>
                      % of work time on non-promotable tasks — same role, same level
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
                    {" "}A networking score of <strong style={{ color: C.text }}>{p.networking_score}/10</strong>{" "}
                    {p.networking_score >= 7 ? "puts you in a strong position to leverage connections." : "— increasing this to 8+ is one of the highest-ROI career moves you can make."}{" "}
                    Negotiating at your next review could recover{" "}
                    <strong style={{ color: C.mint }}>{fmt(manNow * 0.05)}–{fmt(manNow * 0.12)}</strong>/yr.
                  </p>
                </div>
              </div>
            </>
          )}

        </div>
      </div>}
    </div>
  );
}