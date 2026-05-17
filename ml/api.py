"""
HerPath ML API
--------------
POST /analyze

Body (JSON):
  {
    "Age":                    int,
    "Gender":                 "Female" | "Male",
    "University_GPA":         float,        # 0.0 – 4.0
    "Current_Role":           str,          # e.g. "Software Engineer"
    "Internships_Completed":  int,          # 0 – 4
    "Starting_Salary":        float,        # USD
    "Networking_Score":       int,          # 1 – 10
    "Current_Job_Level":      int           # 0=Entry 1=Mid 2=Senior 3=Executive
  }

Response (JSON):
  {
    "cluster":            int,
    "gap_score":          float,
    "female":             { "promotion_prob": float, "base_salary": float },
    "male":               { "promotion_prob": float, "base_salary": float },
    "bar_chart_path":     str,
    "line_chart_path":    str,
    "cluster_image_path": str
  }

Run:  uvicorn api:app --reload  (from the ml/ directory)
      pip install fastapi uvicorn
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

import gmm as gmmlib
import helpers

# ── constants ─────────────────────────────────────────────────────────────────

OUT_DIR = gmmlib.OUT_DIR

_LEVEL_MAP = {0: 'Entry', 1: 'Mid', 2: 'Senior', 3: 'Executive', 4: 'Executive'}

# ── model loaded once at startup ──────────────────────────────────────────────

_gmm      = joblib.load(OUT_DIR / 'best_gmm.pkl')
_scaler   = joblib.load(OUT_DIR / 'scaler.pkl')
_results  = pd.read_csv(OUT_DIR / 'gmm_hyperparam_results.csv')
_best_row = _results.iloc[0]

_df                     = gmmlib.load_data()
_X, _, _gender_raw      = gmmlib.preprocess(_df)
_labels                 = gmmlib.predict_batch(_X, _gmm)

# ── request / response models ─────────────────────────────────────────────────

class UserInput(BaseModel):
    Age:                   int
    Gender:                str = Field(..., pattern='^(Female|Male)$')
    University_GPA:        float = Field(..., ge=0.0, le=4.0)
    Current_Role:          str
    Internships_Completed: int   = Field(..., ge=0, le=4)
    Starting_Salary:       float
    Networking_Score:      int   = Field(..., ge=1, le=10)
    Current_Job_Level:     int   = Field(..., ge=0, le=4)


class AnalysisResult(BaseModel):
    cluster:            int
    gap_score:          float
    female:             dict
    male:               dict
    bar_chart_path:     str
    line_chart_path:    str
    cluster_image_path: str


# ── core analysis function ────────────────────────────────────────────────────

def analyze_user(
    age: int,
    gender: str,
    university_gpa: float,
    current_role: str,
    internships_completed: int,
    starting_salary: float,
    networking_score: int,
    current_job_level: int,
) -> dict:
    """
    Full pipeline for one user. Returns cluster, gender gap data, and image paths.

    current_job_level: integer 0–4 (0=Entry, 1=Mid, 2=Senior, 3+=Executive)
    """
    level_str = _LEVEL_MAP[min(current_job_level, 4)]
    level_enc = gmmlib.LEVEL_ORDER[level_str]

    user_out_dir = OUT_DIR / 'user_results'

    # 1 — cluster + gap score
    prediction = gmmlib.predict_single(
        _gmm, _scaler,
        age, university_gpa, internships_completed,
        networking_score, starting_salary, level_str, current_role,
    )
    cluster   = prediction['female']['cluster']
    gap_score = prediction['female']['gap_score']

    # 2 — cluster-average salaries + promotion probs (for bar chart)
    female_summary, male_summary = gmmlib.user_summary(
        _gmm, _scaler,
        age, university_gpa, internships_completed,
        networking_score, starting_salary, level_str, current_role,
    )

    # 3 — 20-year career trajectory (for line chart)
    female_timeline, male_timeline = gmmlib.career_timeline(
        current_role, _gmm, _scaler,
        age, university_gpa, internships_completed,
        networking_score, starting_salary, level_str,
    )

    # 4 — generate charts
    bar_path = helpers.plot_user_summary_bar(female_summary, male_summary, user_out_dir)
    line_path = helpers.plot_career_timeline_line(female_timeline, male_timeline, current_role, user_out_dir)
    cluster_path, _ = helpers.plot_cluster_image(
        _X, _labels, _gmm, _scaler, _best_row,
        age, university_gpa, internships_completed,
        networking_score, starting_salary, level_enc,
        user_out_dir, df=_df,
    )

    return {
        'cluster':            cluster,
        'gap_score':          gap_score,
        'female':             female_summary,
        'male':               male_summary,
        'bar_chart_path':     str(bar_path),
        'line_chart_path':    str(line_path),
        'cluster_image_path': str(cluster_path),
    }


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title='HerPath ML API')


@app.post('/analyze', response_model=AnalysisResult)
def analyze(user: UserInput):
    try:
        return analyze_user(
            age=user.Age,
            gender=user.Gender,
            university_gpa=user.University_GPA,
            current_role=user.Current_Role,
            internships_completed=user.Internships_Completed,
            starting_salary=user.Starting_Salary,
            networking_score=user.Networking_Score,
            current_job_level=user.Current_Job_Level,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
