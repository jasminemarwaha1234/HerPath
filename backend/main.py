import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_PROJECT_ROOT))

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from ml.gmm import predict_single, career_timeline

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ML_OUT = _PROJECT_ROOT / 'ml' / 'output'
app.mount("/static", StaticFiles(directory=str(_ML_OUT)), name="static")

_gmm = None
_scaler = None


def _load_model():
    global _gmm, _scaler
    if _gmm is None:
        _gmm    = joblib.load(_ML_OUT / 'best_gmm.pkl')
        _scaler = joblib.load(_ML_OUT / 'scaler.pkl')
    return _gmm, _scaler


@app.get("/trigger-analysis")
async def trigger_analysis(
    age: float,
    university_gpa: float,
    internships_completed: int,
    networking_score: float,
    starting_salary: float,
    current_job_level: str,
    role: str,
    years: int = 20,
):
    gmm, scaler = _load_model()

    try:
        out = predict_single(gmm, scaler, age, university_gpa, internships_completed,
                             networking_score, starting_salary, current_job_level, role)
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Unknown job level: {current_job_level}")

    cluster   = out['female']['cluster']
    gap_score = out['female']['gap_score']

    scores     = pd.read_csv(_ML_OUT / 'gender_gap_scores.csv', index_col=0)
    female_avg = round(float(scores.loc[cluster, 'Female']), 2)
    male_avg   = round(float(scores.loc[cluster, 'Male']), 2)

    try:
        female_timeline, male_timeline = career_timeline(
            role, gmm, scaler, age, university_gpa,
            internships_completed, networking_score,
            starting_salary, current_job_level, years,
        )
    except Exception:
        female_timeline, male_timeline = [], []

    return {
        'cluster':   cluster,
        'gap_score': gap_score,
        'salary_bar': {
            'female':      female_avg,
            'male':        male_avg,
            'gap_dollars': round(abs(male_avg - female_avg), 2),
        },
        'promo_bar': {
            'female': float(out['female']['promotion_prob']),
            'male':   float(out['male']['promotion_prob']),
        },
        'cluster_plot_url': '/static/clusters_pca.png',
        'timeline': {
            'female': female_timeline,
            'male':   male_timeline,
        },
    }
