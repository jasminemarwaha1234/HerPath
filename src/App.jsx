import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from "recharts";
// import heroBg from "./assets/pink2.webp";
import supabase from "./lib/supabaseClient";
import { ROLES } from "./roles.js";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       "#fff0f3",
  bgSoft:   "#ffe4ea",
  card:     "#ffffff",
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
  nav:      "#fff6f8",
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS / DROPDOWN OPTIONS
// ─────────────────────────────────────────────────────────────────────────────
const GENDERS = ["Female", "Male", "Non-binary / other"];
const JOB_LEVELS = [
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

// ─────────────────────────────────────────────────────────────────────────────
// HARDCODED JOB CARDS (backend: swap with LinkedIn API / your partner's endpoint)
// ─────────────────────────────────────────────────────────────────────────────
const HARDCODED_JOBS = [
  {
    id: 1,
    title: "Senior SWE – Backend Platform",
    company: "Stellarwave",
    companyType: "Startup",
    location: "San Francisco, CA",
    workType: "Remote",
    distance: "2.8 mi away",
    match: 88,
    // badge: "Salary transparent",
    badgeColor: "#d4b8e0",
    badgeText: "#7a5590",
    posted: "5d ago",
    womenAvg: 155000,
    menAvg: 200000,
    womenPct: 78,
  },
  {
    id: 2,
    title: "Senior SWE – Security & Identity",
    company: "Equal Paths",
    companyType: "Non-profit",
    location: "San Francisco, CA",
    workType: "Hybrid",
    distance: "3.5 mi away",
    match: 82,
    // badge: "✓ Pay certified",
    badgeColor: "#fce4ea",
    badgeText: "#c4536a",
    posted: "1d ago",
    womenAvg: 172000,
    menAvg: 195000,
    womenPct: 88,
  },
  {
    id: 3,
    title: "Product Manager – Growth",
    company: "Notion",
    companyType: "Tech",
    location: "New York, NY",
    workType: "Hybrid",
    distance: "1.2 mi away",
    match: 79,
    // badge: "Salary transparent",
    badgeColor: "#d4b8e0",
    badgeText: "#7a5590",
    posted: "3d ago",
    womenAvg: 148000,
    menAvg: 175000,
    womenPct: 85,
  },
  {
    id: 4,
    title: "Data Scientist – ML Platform",
    company: "Spotify",
    companyType: "Tech",
    location: "Remote",
    workType: "Remote",
    distance: null,
    match: 76,
    // badge: "✓ Pay certified",
    badgeColor: "#fce4ea",
    badgeText: "#c4536a",
    posted: "2d ago",
    womenAvg: 138000,
    menAvg: 162000,
    womenPct: 85,
  },
  {
    id: 5,
    title: "Marketing Director",
    company: "Glossier",
    companyType: "Consumer",
    location: "New York, NY",
    workType: "On-site",
    distance: "4.1 mi away",
    match: 74,
    badge: "Women-led",
    badgeColor: "#d4f0e8",
    badgeText: "#2d8c72",
    posted: "5d ago",
    womenAvg: 112000,
    menAvg: 130000,
    womenPct: 86,
  },
  {
    id: 6,
    title: "UX Research Lead",
    company: "Figma",
    companyType: "Tech",
    location: "Remote",
    workType: "Remote",
    distance: null,
    match: 71,
    // badge: "Salary transparent",
    badgeColor: "#d4b8e0",
    badgeText: "#7a5590",
    posted: "1w ago",
    womenAvg: 140000,
    menAvg: 168000,
    womenPct: 83,
  },
  {
    id: 7,
    title: "Financial Analyst",
    company: "Goldman Sachs",
    companyType: "Finance",
    location: "New York, NY",
    workType: "On-site",
    distance: "0.8 mi away",
    match: 68,
    badge: "Pay gap audit",
    badgeColor: "#fce4ea",
    badgeText: "#c4536a",
    posted: "4d ago",
    womenAvg: 95000,
    menAvg: 125000,
    womenPct: 76,
  },
  {
    id: 8,
    title: "Engineering Manager",
    company: "Stripe",
    companyType: "Fintech",
    location: "San Francisco, CA",
    workType: "Hybrid",
    distance: "2.0 mi away",
    match: 65,
    // badge: "✓ Pay certified",
    badgeColor: "#fce4ea",
    badgeText: "#c4536a",
    posted: "6d ago",
    womenAvg: 195000,
    menAvg: 230000,
    womenPct: 85,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TRAJECTORY MODEL
// ─────────────────────────────────────────────────────────────────────────────
function genTrajectory(p) {
  const age    = parseInt(p.age) || 28;
  const start  = Math.max(18, age - 5);
  const salary = parseInt(p.starting_salary) || 60000;
  return Array.from({ length: 65 - start + 1 }, (_, i) => {
    const a   = start + i;
    const man = Math.round(salary * Math.pow(1.065, i));
    let woman = Math.round(salary * Math.pow(1.045, i));
    if (p.leavePast && a >= age - 2 && a <= age + 2) woman = Math.round(woman * 0.935);
    if (p.leaveSoon && a >= age     && a <= age + 3) woman = Math.round(woman * 0.93);
    if (p.married   && a >= age)                     woman = Math.round(woman * 0.991);
    const actual = a <= age ? Math.round(salary * Math.pow(1.03, a - age)) : null;
    return { age: a, man, woman, actual };
  });
}

const fmt = v => `$${Math.round(v / 1000)}k`;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────


const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const pt = payload[0]?.payload;
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 12, fontFamily: "'DM Mono',monospace", boxShadow: "0 4px 20px #c4536a15" }}>
      <p style={{ color: C.muted, marginBottom: 6 }}>Year {label}</p>
      {payload.map(p => p.value != null && (
        <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>{p.name}: {fmt(p.value)}</p>
      ))}
      {(pt?.manRole || pt?.womanRole) && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 6 }}>
          {pt?.manRole   && <p style={{ color: C.man,   margin: "2px 0" }}>Male role → {pt.manRole}</p>}
          {pt?.womanRole && <p style={{ color: C.woman, margin: "2px 0" }}>Female role → {pt.womanRole}</p>}
        </div>
      )}
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

const SliderField = ({ label, hint, min, max, value, onChange, displayVal }) => (
  <div>
    <label style={LBL}>
      {label}
      <span style={{ float: "right", color: C.rose, fontWeight: 700, fontSize: 13 }}>
        {displayVal ?? value}
      </span>
    </label>
    <input type="range" min={min} max={max} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: "100%", accentColor: C.rose, cursor: "pointer" }} />
    {hint && <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginTop: 3 }}>{hint}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TOP NAV (results pages)
// ─────────────────────────────────────────────────────────────────────────────
function ResultsNav({ active, setActive, onHome }) {
  const tabs = [
    { id: "home",    label: "Home"      },
    { id: "stats",  label: "My Stats"  },
    { id: "linkedin", label: "Job Matches" },
  ];
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 100,
      background: C.nav,
      borderBottom: `1.5px solid ${C.border}`,
      display: "flex", alignItems: "center",
      padding: "0 32px",
      backdropFilter: "blur(12px)",
      boxShadow: "0 2px 20px #c4536a0c",
    }}>
      {/* Logo */}
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 800, color: C.text, paddingRight: 32, paddingTop: 14, paddingBottom: 14, letterSpacing: "-0.01em", borderRight: `1px solid ${C.border}`, marginRight: 8 }}>
        Her<em style={{ color: C.rose, fontStyle: "italic" }}>Path</em>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, flex: 1 }}>
        {tabs.map(t => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => t.id === "home" ? onHome() : setActive(t.id)}
              style={{
                background: "none",
                border: "none",
                borderBottom: `2.5px solid ${isActive ? C.rose : "transparent"}`,
                padding: "18px 20px 16px",
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13,
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? C.rose : C.muted,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Edit profile pill */}
      <button
        onClick={() => setActive("edit")}
        style={{
          background: "#fff", border: `1.5px solid ${C.border}`,
          borderRadius: 99, padding: "7px 16px",
          fontSize: 11, color: C.muted, cursor: "pointer",
          fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
        }}
      >
        Edit profile
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS VIEW
// ─────────────────────────────────────────────────────────────────────────────
// function StatsView({ p, traj, manNow, gapPct, lifetime }) {
//   const [tab, setTab] = useState("bar");
//   const curAge = parseInt(p.age);
//   const JOB_LEVEL_LABEL = JOB_LEVELS.find(j => j.value === p.job_level)?.label ?? "—";

const LoadingOverlay = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
      Running model…
    </div>
  );
  
  function StatsView({ traj, mlResult, mlLoading }) {
  const [tab, setTab] = useState("bar");

  const TABS = [
    { id: "bar",     label: "Bar chart"  },
    { id: "cluster", label: "Cluster"    },
    { id: "line",    label: "Line chart" },
  ];

  const barSalaryData = [{
    label: "Avg Base Salary",
    women: mlResult?.female?.base_salary ?? null,
    men:   mlResult?.male?.base_salary   ?? null,
  }];
  const barPromoData = [{
    label: "Promotion Probability",
    women: mlResult ? Math.round((mlResult.female?.prob ?? 0) * 100) : null,
    men:   mlResult ? Math.round((mlResult.male?.prob   ?? 0) * 100) : null,
  }];

  const lineData = mlResult
    ? mlResult.female_timeline.map((f, i) => ({
        year:      f.year,
        woman:     f.salary,
        man:       mlResult.male_timeline[i]?.salary ?? f.salary,
        womanRole: f.role ?? null,
        manRole:   mlResult.male_timeline[i]?.role ?? null,
      }))
    : traj.map(d => ({ year: d.age, woman: d.woman, man: d.man }));

  // const LoadingOverlay = () => (
  //   <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>
  //     Running model…
  //   </div>
  // );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "36px 24px 80px" }}>

      {/* Tab bar */}
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
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div style={{ background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 24, padding: 28, boxShadow: "0 2px 24px #c4536a0a" }}>

        {/* ── BAR CHART ── */}
        {tab === "bar" && <>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 30, fontWeight: 700, marginBottom: 4, color: C.text }}>
            Your cluster insights
          </h3>
          <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 24 }}>
            Cluster-average salary &amp; promotion probability · men vs. women
          </p>

          {mlLoading ? <LoadingOverlay /> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barSalaryData} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 12 }} />
                  <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10 }} formatter={(v, name) => [fmt(v), name]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.muted, paddingTop: 8 }} />
                  <Bar dataKey="women" name="Women" fill={C.woman} radius={[6, 6, 0, 0]} opacity={0.85} />
                  <Bar dataKey="men"   name="Men"   fill={C.man}   radius={[6, 6, 0, 0]} opacity={0.7}  />
                </BarChart>
              </ResponsiveContainer>

              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barPromoData} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10 }} formatter={(v, name) => [`${v}%`, name]} />
                  <Legend wrapperStyle={{ fontSize: 12, color: C.muted, paddingTop: 8 }} />
                  <Bar dataKey="women" name="Women" fill={C.woman} radius={[6, 6, 0, 0]} opacity={0.85} />
                  <Bar dataKey="men"   name="Men"   fill={C.man}   radius={[6, 6, 0, 0]} opacity={0.7}  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>}

        {/* ── CLUSTER ── */}
        {tab === "cluster" && <>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
            Salary cluster analysis
          </h3>
          <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>
            Where you fall among similar professionals
          </p>
          {mlLoading ? <LoadingOverlay /> : mlResult?.cluster_image_path ? (
            <img
              src={`/ml-api/output/user_results/${mlResult.cluster_image_path.split("/").pop()}?t=${mlResult._ts}`}
              alt="Salary cluster analysis"
              style={{ width: "100%", borderRadius: 16, border: `1px solid ${C.border}` }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: C.roseSoft, borderRadius: 16, height: 320, border: `1px solid ${C.border}` }}>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: C.muted }}>Submit the form to see your cluster</p>
            </div>
          )}
        </>}

        {/* ── LINE CHART ── */}
        {tab === "line" && <>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
            Salary over time
          </h3>
          <p style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace", marginBottom: 20 }}>
            {mlResult ? "20-year projected trajectory · men vs. women" : "Projected salary trajectory: men vs women"}
          </p>

          {mlLoading ? <LoadingOverlay /> : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={lineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {[["wG", C.woman], ["mG", C.man]].map(([id, col]) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={col} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={col} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} label={{ value: mlResult ? "Year" : "Age", position: "insideBottomRight", offset: -4, fill: C.muted, fontSize: 11 }} />
                  <YAxis tickFormatter={fmt} tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip content={<CustomTip />} />
                  <Area type="monotone" dataKey="man" stroke={C.man} fill="url(#mG)" strokeWidth={2} name="Men"
                    dot={(props) => {
                      const { cx, cy, payload, index } = props;
                      if (!payload.manRole) return null;
                      return <circle key={`m${index}`} cx={cx} cy={cy} r={5} fill={C.man} stroke="#fff" strokeWidth={2} />;
                    }}
                  />
                  <Area type="monotone" dataKey="woman" stroke={C.woman} fill="url(#wG)" strokeWidth={2.5} name="Women"
                    dot={(props) => {
                      const { cx, cy, payload, index } = props;
                      if (!payload.womanRole) return null;
                      return <circle key={`w${index}`} cx={cx} cy={cy} r={5} fill={C.woman} stroke="#fff" strokeWidth={2} />;
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
                {[[C.man, "Men"], [C.woman, "Women"]].map(([col, l]) => (
                  <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.muted }}>
                    <div style={{ width: 18, height: 2.5, background: col, borderRadius: 2 }} />{l}
                  </div>
                ))}
              </div>
            </>
          )}
        </>}

      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LINKEDIN / JOB MATCHES VIEW
// ─────────────────────────────────────────────────────────────────────────────
function LinkedInView({ p, jobs }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Remote", "Hybrid", "On-site"];

  const filtered = filter === "All"
    ? jobs
    : jobs.filter(j => j.workType === filter);

  const yourGap = (job) => job.menAvg - job.womenAvg;

  const workTypeIcon = (type) => ({ Remote: "🌐", Hybrid: "🏠", "On-site": "🏢", Startup: "🚀", "Non-profit": "🤝" }[type] || "📍");

  return (
    <div style={{ width: "100%", padding: "36px 40px 80px", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 800, margin: "0 0 6px", color: C.text }}>
          Job Matches For {p.name || "You"}
        </h2>
        <p style={{ fontSize: 12, color: C.muted, fontFamily: "'DM Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
          {/* {p.zipcode ? `Near ${p.zipcode} · ` : ""}Ranked by pay equity · hardcoded placeholder */}
          {/* <span style={{ background: C.roseSoft, color: C.rose, borderRadius: 99, padding: "2px 10px", border: `1px solid ${C.border}`, fontSize: 10 }}>
            Backend: connect /api/jobs
          </span> */}
        </p>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? C.rose : "#fff",
            border: `1.5px solid ${filter === f ? C.rose : C.border}`,
            borderRadius: 99, padding: "7px 18px", fontSize: 12,
            color: filter === f ? "#fff" : C.muted,
            cursor: "pointer", fontFamily: "'DM Mono',monospace",
            transition: "all 0.15s",
          }}>{f}</button>
        ))}
      </div>

      {/* 2-column grid — fills the full width */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {filtered.map(job => (
          <div key={job.id} style={{
            background: "#fff",
            border: `1.5px solid ${C.border}`,
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 2px 16px #c4536a08",
            transition: "box-shadow 0.2s, transform 0.2s",
            cursor: "pointer",
            display: "flex", flexDirection: "column", gap: 14,
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 28px #c4536a18"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 16px #c4536a08"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {/* Top: title + badges */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 19, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.25 }}>
                  {job.title}
                </h3>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {/* <span style={{
                    background: job.badgeColor, color: job.badgeText,
                    borderRadius: 99, padding: "3px 10px", fontSize: 10,
                    fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap",
                    border: `1px solid ${job.badgeText}22`,
                  }}>{job.badge}</span> */}
                  <span style={{
                    background: job.match >= 80 ? "#d4f0e8" : C.roseSoft,
                    color: job.match >= 80 ? "#2d8c72" : C.rose,
                    borderRadius: 99, padding: "3px 10px", fontSize: 10,
                    fontFamily: "'DM Mono',monospace", fontWeight: 700,
                    border: `1px solid ${job.match >= 80 ? "#a8ddd0" : C.border}`,
                    whiteSpace: "nowrap",
                  }}>{job.match}% match</span>
                </div>
              </div>
              {/* Company + location */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: C.rose, fontWeight: 600 }}>{job.company}</span>
                <span style={{ color: C.muted }}>·</span>
                <span style={{ fontSize: 12, color: C.muted }}>{job.location}</span>
                {job.distance && <><span style={{ color: C.muted }}>·</span><span style={{ fontSize: 12, color: C.muted }}>{job.distance}</span></>}
              </div>
            </div>

            {/* Salary comparison box */}
            <div style={{ background: C.roseSoft, borderRadius: 14, padding: "14px 16px", border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 9, color: C.muted, fontFamily: "'DM Mono',monospace", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                {/* Salary comparison · {job.title.split("–")[0].trim()} at this company */}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>

  {/* Women avg column */}
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", background: "#fff", borderRight: `1px solid ${C.border}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, justifyContent: "center" }}>
      {/* <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.rose, flexShrink: 0 }} /> */}
      <span style={{ fontSize: 18, color: C.muted, fontFamily: "'Cormorant Garamond',serif" }}>Women avg</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: C.text, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1 }}>{fmt(job.womenAvg)}</div>
  </div>

  {/* Men avg column */}
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", background: "#fff", borderRight: `1px solid ${C.border}` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, justifyContent: "center" }}>
      {/* <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a89ac4", flexShrink: 0 }} /> */}
      <span style={{ fontSize: 18, color: C.muted, fontFamily: "'Cormorant Garamond',serif" }}>Men avg</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: C.text, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1 }}>{fmt(job.menAvg)}</div>
  </div>

  {/* Your gap column */}
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", background: "#fff" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, justifyContent: "center" }}>
      {/* <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.rose, opacity: 0.5, flexShrink: 0 }} /> */}
      <span style={{ fontSize: 18, color: C.muted, fontFamily: "'Cormorant Garamond',serif" }}>Your gap</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 800, color: C.rose, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1 }}>{fmt(yourGap(job))}/yr</div>
  </div>

</div>
            </div>

            {/* Bottom: icons + apply */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", gap: 18, flex: 1 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 17 }}>{workTypeIcon(job.companyType)}</div>
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{job.companyType}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 17 }}>{workTypeIcon(job.workType)}</div>
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono',monospace" }}>{job.workType}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.muted }}>Posted</div>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{job.posted}</div>
                </div>
              </div>
              <button style={{
                background: C.rose, color: "#fff", border: "none",
                borderRadius: 10, padding: "10px 18px", fontSize: 13,
                fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap",
              }}
                onMouseEnter={e => e.currentTarget.style.background = C.roseDark}
                onMouseLeave={e => e.currentTarget.style.background = C.rose}
                onClick={() => job.url && window.open(job.url, "_blank")}
              >Apply →</button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: C.muted, fontFamily: "'DM Mono',monospace", fontSize: 13 }}>
            No {filter} jobs in the hardcoded set yet — backend will populate this.
          </div>
        )}
      </div>

      {/* Backend note */}
      {/* <div style={{ marginTop: 28, background: "#fff", border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 20 }}>🔧</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4, fontFamily: "'Cormorant Garamond',serif" }}>For your partner (backend)</p>
          <p style={{ fontSize: 11, color: C.muted, fontFamily: "'DM Mono',monospace", lineHeight: 1.6 }}>
            Replace HARDCODED_JOBS with: GET /api/jobs?field={p.field}&level={p.job_level}&zipcode={p.zipcode || "—"}<br/>
            womenAvg / menAvg / womenPct = pull from Glassdoor, Levels.fyi, or your ML model<br/>
            match % = your recommendation model output
          </p>
        </div>
      </div> */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function HerPath() {
  const [heroVisible, setHV]  = useState(sessionStorage.getItem("started") !== "true");
  const [formStep, setFormStep] = useState(0);   // 0 = form, 1 = results
  const [resultsTab, setResultsTab] = useState("stats"); // stats | linkedin | edit
  const formRef = useRef(null);

  const [p, setP] = useState({
    name: "", age: 22, gender: "Female", gpa: 3.5,
    field: "Technology", specific_role: "", internships: 0,
    starting_salary: 60000, networking_score: 5, job_level: 1,
    married: false, leavePast: false, leaveSoon: false,
    zipcode: "",
  });
  const set = (key, val) => setP(prev => ({ ...prev, [key]: val }));

  const [mlResult, setMlResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [jobs, setJobs] = useState(HARDCODED_JOBS);

  useEffect(() => {
    window.scrollTo(0, 0);
    window.addEventListener("beforeunload", () => sessionStorage.removeItem("started"));
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;0,800;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(l);
  }, []);

  const scrollToForm = () => {
    sessionStorage.setItem("started", "true");
    setHV(false);
    setFormStep(0);
    window.scrollTo(0, 0);
  };

  const goHome = () => {
    sessionStorage.removeItem("started");
    setHV(true);
    setFormStep(0);
    window.scrollTo(0, 0);
  };

  // Derived stats (fallback trajectory for line chart while API loads)
  const traj = genTrajectory(p);

  const handleAnalyze = async () => {
    const { error } = await supabase.from("user_inputs").insert([{
      Age: parseInt(p.age), Gender: p.gender,
      University_GPA: parseFloat(p.gpa),
      Current_Role: p.specific_role || null,
      Internships_Completed: parseInt(p.internships),
      Starting_Salary: parseInt(p.starting_salary),
      Networking_Score: parseInt(p.networking_score),
      Current_Job_Level: parseInt(p.job_level),
    }]);
    if (error) console.error("Supabase error:", error);

    setMlLoading(true);
    setFormStep(1);
    setResultsTab("stats");
    window.scrollTo(0, 0);

    try {
      const apiGender = p.gender === "Female" ? "Female" : "Male";
      const res = await fetch("/ml-api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Age: parseInt(p.age),
          Gender: apiGender,
          University_GPA: parseFloat(p.gpa),
          Current_Role: p.specific_role || "Software Engineer",
          Internships_Completed: parseInt(p.internships),
          Starting_Salary: parseInt(p.starting_salary),
          Networking_Score: parseInt(p.networking_score),
          Current_Job_Level: parseInt(p.job_level),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMlResult({ ...data, _ts: Date.now() });
      } else {
        console.error("ML API error:", await res.text());
      }
    } catch (err) {
      console.error("ML API unreachable:", err);
    } finally {
      setMlLoading(false);
    }

    try {
      const role    = p.specific_role || p.field;
      const jobsRes = await fetch(`/api/jobs?role=${encodeURIComponent(role)}&zipcode=${encodeURIComponent(p.zipcode || "")}`);
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        if (data.length > 0) setJobs(data);
      }
    } catch (err) {
      console.error("Jobs API unreachable:", err);
    }
  };

  // ── HERO ──
  if (heroVisible) return (
    <div style={{
      minHeight: "100vh",
      width: "100%",
      // backgroundImage: `url(${heroBg})`,
      backgroundImage: "url('/pink2.webp')",
      backgroundSize: "cover",
      backgroundPosition: "center",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "60px 32px 48px", textAlign: "center",
      flexShrink: 0,
    }}>
      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }`}</style>
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
        Find out how gender, life events, and hidden labor shape your salary and what to do about it.
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
  );

  // ── RESULTS (with nav) ──
  if (formStep === 1) return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`input:focus, select:focus { border-color:#c4536a !important; } select option { background:#fff; color:#3d1a24; }`}</style>

      <ResultsNav
        active={resultsTab}
        setActive={setResultsTab}
        onHome={goHome}
      />

      {resultsTab === "stats" && (
        <StatsView traj={traj} mlResult={mlResult} mlLoading={mlLoading} />
      )}

      {resultsTab === "linkedin" && (
        <LinkedInView p={p} jobs={jobs} />
      )}

      {resultsTab === "edit" && (
        <div style={{ maxWidth:860, margin:"0 auto", padding:"36px 24px 80px" }}>
          <button onClick={() => setResultsTab("stats")} style={{
            background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:99,
            padding:"7px 18px", fontSize:11, color:C.muted,
            cursor:"pointer", fontFamily:"'DM Mono',monospace", marginBottom:24,
          }}>← Back to stats</button>
          <p style={{ fontSize:12, color:C.muted, fontFamily:"'DM Mono',monospace", marginBottom:8 }}>Editing your profile — changes will re-run the model.</p>
          {/* Re-render the form inline */}
          <FormBody p={p} set={set} onSubmit={() => { handleAnalyze(); setResultsTab("stats"); }} submitLabel="Update my analysis →" />
        </div>
      )}
    </div>
  );

  // ── FORM ──
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`input:focus, select:focus { border-color:#c4536a !important; } select option { background:#fff; color:#3d1a24; } input[type=range]::-webkit-slider-thumb { accent-color:#c4536a; }`}</style>
      {/* Mini nav */}
      <div style={{ background:C.nav, borderBottom:`1.5px solid ${C.border}`, padding:"14px 32px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={goHome} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.rose }}>←</button>
        <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:800, color:C.text }}>
          Her<em style={{ color:C.rose, fontStyle:"italic" }}>Path</em>
        </span>
      </div>
      <div ref={formRef} style={{ maxWidth:860, margin:"0 auto", padding:"48px 24px 80px" }}>
        <div style={{ marginBottom:36 }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:800, margin:"0 0 8px", color:C.text }}>
            Tell us about yourself 🌷
          </h2>
          <p style={{ fontSize:12, color:C.muted, fontFamily:"'DM Mono',monospace" }}>
            Your answers stay private — we use them to model your salary trajectory.
          </p>
        </div>
        <FormBody p={p} set={set} onSubmit={handleAnalyze} submitLabel="Analyze my trajectory →" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM BODY (reusable for both initial + edit)
// ─────────────────────────────────────────────────────────────────────────────
function FormBody({ p, set, onSubmit, submitLabel }) {
  return (
    <>
      {/* Card 1: About you */}
      <div style={CARD}>
        <h2 style={SECTION_HEAD}>About you 🌷</h2>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
          <div>
            <label style={LBL}>First name</label>
            <input style={INP} type="text" placeholder="e.g. Sarah" value={p.name} onChange={e => set("name", e.target.value)} />
          </div>
          <div>
            <label style={LBL}>Age</label>
            <input style={INP} type="number" min="18" max="65" placeholder="e.g. 24" value={p.age} onChange={e => set("age", e.target.value)} />
          </div>
          <div>
            <label style={LBL}>ZIP code</label>
            <input style={INP} type="text" placeholder="e.g. 94102" maxLength={10} value={p.zipcode} onChange={e => set("zipcode", e.target.value)} />
          </div>
          <div>
            <label style={LBL}>Gender</label>
            <select style={SEL} value={p.gender} onChange={e => set("gender", e.target.value)}>
              {GENDERS.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label style={LBL}>Field / industry</label>
            <select style={SEL} value={p.field} onChange={e => set("field", e.target.value)}>
              {FIELDS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          {/* Role autocomplete */}
          <div style={{ gridColumn:"1 / -1", position:"relative" }}>
            <label style={LBL}>Specific role / job title</label>
            <input style={INP} type="text" placeholder="Type to search e.g. Software…"
              value={p.specific_role}
              onChange={e => set("specific_role", e.target.value)}
              onBlur={() => setTimeout(() => set("_roleOpen", false), 150)}
              onFocus={() => set("_roleOpen", true)}
            />
            {p._roleOpen && p.specific_role.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:99, background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, marginTop:4, boxShadow:"0 8px 24px #c4536a15", maxHeight:200, overflowY:"auto" }}>
                {ROLES.filter(r => r.toLowerCase().includes(p.specific_role.toLowerCase())).map(r => (
                  <div key={r} onMouseDown={() => set("specific_role", r)}
                    style={{ padding:"10px 14px", fontSize:13, cursor:"pointer", color:C.text, fontFamily:"'DM Sans',sans-serif", borderBottom:`1px solid ${C.border}`, transition:"background 0.1s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.roseSoft}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                  >{r}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card 2: Academic & career baseline */}
      <div style={CARD}>
        <h2 style={SECTION_HEAD}>Academic & career baseline </h2>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          <SliderField label="University GPA" hint="0.0 – 4.0 scale" min={0} max={40}
            value={Math.round(p.gpa * 10)} onChange={v => set("gpa", v / 10)} displayVal={p.gpa.toFixed(1)} />
          <div>
            <label style={LBL}>Internships completed</label>
            <select style={SEL} value={p.internships} onChange={e => set("internships", parseInt(e.target.value))}>
              {INTERNSHIP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:"1 / -1" }}>
            <label style={LBL}>Starting salary ($/yr)</label>
            <input style={INP} type="number" placeholder="e.g. 75000" value={p.starting_salary || ""}
              onChange={e => set("starting_salary", parseInt(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      {/* Card 3: Career position */}
      <div style={CARD}>
        <h2 style={SECTION_HEAD}>Career position </h2>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          <div>
            <label style={LBL}>Current job level</label>
            <select style={SEL} value={p.job_level} onChange={e => set("job_level", parseInt(e.target.value))}>
              {JOB_LEVELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ fontSize:10, color:C.muted, fontFamily:"'DM Mono',monospace", marginTop:4 }}>Entry → Mid → Senior → Executive</div>
          </div>
          <SliderField label="Networking score" hint="1 = low · 10 = highly connected" min={1} max={10}
            value={p.networking_score} onChange={v => set("networking_score", v)} />
        </div>
      </div>

      {/* Card 4: Life circumstances */}
      <div style={CARD}>
        <h2 style={SECTION_HEAD}>Life circumstances 🌸</h2>
        <p style={{ fontSize:11, color:C.muted, fontFamily:"'DM Mono',monospace", marginBottom:20 }}>
          These have measurable, documented impacts on salary trajectory.
        </p>
        <div style={{ display:"flex", gap:12, marginBottom:12 }}>
          <ToggleBtn icon="💍" label="Are you currently married?"      active={p.married}   onClick={() => set("married",   !p.married)}   />
          <ToggleBtn icon="🤱" label="Have you taken maternity leave?" active={p.leavePast} onClick={() => set("leavePast", !p.leavePast)} />
        </div>
        <div style={{ display:"flex", gap:12 }}>
          <ToggleBtn icon="📅" label="Planning maternity leave soon?"  active={p.leaveSoon} onClick={() => set("leaveSoon", !p.leaveSoon)} />
          <div style={{ flex:1 }} />
        </div>
      </div>

      <button onClick={onSubmit} style={{
        width:"100%", background:C.rose, color:"#fff", border:"none",
        borderRadius:16, padding:"18px 32px", fontSize:15, fontWeight:600,
        cursor:"pointer", fontFamily:"'DM Sans',sans-serif", letterSpacing:"0.02em",
        boxShadow:"0 4px 20px #c4536a33",
      }}>
        {submitLabel}
      </button>
      {/* <p style={{ marginTop:14, fontSize:10, color:C.muted, fontFamily:"'DM Mono',monospace", textAlign:"center" }}>
        Fields: Age · Gender · GPA · Role · Internships · Salary · Networking · Job Level
      </p> */}
    </>
  );
}