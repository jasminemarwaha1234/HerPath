import pandas as pd
import numpy as np
import joblib
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from itertools import product
from pathlib import Path

DATA_PATH = Path(__file__).parent.parent / 'data' / 'education_career_success.csv'
OUT_DIR   = Path(__file__).parent / 'output'

LEVEL_ORDER = {'Entry': 0, 'Mid': 1, 'Senior': 2, 'Executive': 3}

PARAM_GRID = {
    'n_components':    [2, 3, 4, 5, 6, 7],
    'covariance_type': ['full', 'tied', 'diag', 'spherical'],
    'init_params':     ['kmeans', 'k-means++', 'random_from_data'],
}
# ── Current Probability ──────────────────────────────────────────────────────────────────────


def curr_probability(role):
    df = pd.read_csv("data/US_information_technology.csv")
    role_df = df[df["from"] == role]
    if role_df.empty:
        return 0.5
    total_freq = role_df["frequency"].sum()
    base_prob = (role_df["promotion_prob"] * role_df["frequency"]).sum() / total_freq
    return float(base_prob)


# ── Data ──────────────────────────────────────────────────────────────────────

def load_data():
    df = pd.read_csv(DATA_PATH)
    df = df[df['Field_of_Study'] != "Computer Science"]
    df = df.drop(columns=[
        'High_School_GPA', 'SAT_Score', 'Field_of_Study', 'Projects_Completed',
        'Certifications', 'Soft_Skills_Score', 'Job_Offers', 'Career_Satisfaction',
        'Years_to_Promotion', 'Work_Life_Balance', 'Entrepreneurship', 'ID',
    ])
    return df


def preprocess(df):
    """
    Separate Gender for analysis, encode remaining categoricals, and scale.
    Gender is NOT included in clustering features.
    Returns (X_scaled, scaler, gender_raw).
    """
    df = df.copy()
    gender_raw = df.pop('Gender')                          # pull out before clustering
    df['Current_Job_Level'] = df['Current_Job_Level'].map(LEVEL_ORDER)
    scaler = StandardScaler()
    X      = scaler.fit_transform(df)
    return X, scaler, gender_raw

# ── Training ──────────────────────────────────────────────────────────────────

def run_hyperparam_search(X):
    results = []
    for n, cov, init in product(
        PARAM_GRID['n_components'],
        PARAM_GRID['covariance_type'],
        PARAM_GRID['init_params'],
    ):
        gmm = GaussianMixture(
            n_components=n, covariance_type=cov, init_params=init,
            n_init=5, max_iter=300, random_state=42,
        )
        gmm.fit(X)
        results.append({
            'n_components':    n,
            'covariance_type': cov,
            'init_params':     init,
            'bic':             gmm.bic(X),
            'aic':             gmm.aic(X),
            'converged':       gmm.converged_,
        })
    return pd.DataFrame(results).sort_values('bic')


def fit_best(X, results_df):
    best = results_df.iloc[0]
    gmm = GaussianMixture(
        n_components=int(best.n_components),
        covariance_type=best.covariance_type,
        init_params=best.init_params,
        n_init=5, max_iter=300, random_state=42,
    )
    gmm.fit(X)
    return gmm


def load_or_train(X, scaler):
    """Load saved model + results if they exist, otherwise train from scratch."""
    model_path   = OUT_DIR / 'best_gmm.pkl'
    scaler_path  = OUT_DIR / 'scaler.pkl'
    results_path = OUT_DIR / 'gmm_hyperparam_results.csv'

    if model_path.exists() and results_path.exists():
        print("Saved model found — loading (skipping training).")
        return joblib.load(model_path), pd.read_csv(results_path)

    print("No saved model found — running hyperparameter search...")
    OUT_DIR.mkdir(exist_ok=True)
    results_df = run_hyperparam_search(X)
    results_df.to_csv(results_path, index=False)

    gmm = fit_best(X, results_df)
    joblib.dump(gmm,    model_path)
    joblib.dump(scaler, scaler_path)
    print(f"Model saved → {model_path}")
    return gmm, results_df

# ── Prediction ────────────────────────────────────────────────────────────────

def predict_batch(X, gmm):
    """Return cluster labels for every row in already-scaled X."""
    return gmm.predict(X)


def predict_single(gmm, scaler, age, university_gpa, internships_completed,
                   networking_score, starting_salary, current_job_level, role):
    """
    Predict the GMM cluster for one individual and return the gender gap score
    for that cluster from the saved gender_gap_scores.csv.
      current_job_level : 'Entry', 'Mid', 'Senior', or 'Executive'
    Returns (cluster, gap_score).
    """
    level_enc  = LEVEL_ORDER[current_job_level]
    row        = np.array([[age, university_gpa, internships_completed,
                            networking_score, starting_salary, level_enc]], dtype=float)
    cluster    = int(gmm.predict(scaler.transform(row))[0])

    scores_path = OUT_DIR / 'gender_gap_scores.csv'
    scores    = pd.read_csv(scores_path, index_col=0)
    gap_score   = round(float(scores.loc[cluster, 'gap_score']), 4)
    base_prob   = curr_probability(role) #custom function 

    female_prob = round(float(np.clip(0.7 * base_prob - 0.3 * gap_score, 0.0, 1.0)), 4)
    male_prob   = round(float(np.clip(0.7 * base_prob + 0.3 * gap_score, 0.0, 1.0)), 4)

    return {'female': {'cluster': cluster, 'base_salary': starting_salary, 'gap_score': gap_score, 'promotion_prob': female_prob},
            'male': {'cluster': cluster, 'base_salary': starting_salary, 'gap_score': gap_score, 'promotion_prob': male_prob}}

def promotion_chain(role, gmm, scaler, age, university_gpa, internships_completed,
                    networking_score, starting_salary, current_job_level):
    """
    Walk the most likely promotion path from role (highest-frequency next role at each step)
    where promotion_prob >= 0.8. Returns a flat list: [{'from', 'to', 'female_prob', 'male_prob'}, ...]
    """
    it_df   = pd.read_csv("data/US_information_technology.csv")
    chain   = []
    visited = set()
    current = role

    while current not in visited:
        role_df = it_df[(it_df["from"] == current) & (it_df["promotion_prob"] >= 0.8)]
        if role_df.empty:
            break
        visited.add(current)
        next_role = role_df.loc[role_df["frequency"].idxmax(), "to"]
        probs     = predict_single(gmm, scaler, age, university_gpa, internships_completed,
                                   networking_score, starting_salary, current_job_level, current)
        chain.append({
            'from':        current,
            'to':          next_role,
            'female_prob': probs['female']['promotion_prob'],
            'male_prob':   probs['male']['promotion_prob'],
        })
        current = next_role

    return chain


def career_timeline(role, gmm, scaler, age, university_gpa, internships_completed,
                    networking_score, starting_salary, current_job_level, years=20):
    """
    Project a year-by-year career trajectory for one person over `years` years.

    Promotion probability is converted to expected years-in-role via 1/avg_prob
    (geometric distribution). Salary grows 4%/yr within a role; +15% on promotion.
    Gap score splits female vs male annual raise so the salary gap widens over time.

    Returns list of dicts, one per year:
      year, age, role, female_salary, male_salary,
      female_promotion_prob, male_promotion_prob, gap_score
    """
    ANNUAL_RAISE = 0.04
    PROMO_BUMP   = 0.15

    chain = promotion_chain(role, gmm, scaler, age, university_gpa,
                            internships_completed, networking_score,
                            starting_salary, current_job_level)

    def _yrs(prob):
        # higher prob → promoted sooner; range 2–8 yrs
        return max(2, min(8, round(3 / prob))) if prob > 0 else years

    # Separate tenure per gender per step
    steps = [{**s, 'f_yrs': _yrs(s['female_prob']), 'm_yrs': _yrs(s['male_prob'])}
             for s in chain]

    start_probs  = predict_single(gmm, scaler, age, university_gpa, internships_completed,
                                  networking_score, starting_salary, current_job_level, role)
    gap_score_f  = start_probs['female']['gap_score']
    gap_score_m  = gap_score_f

    salary_f, salary_m   = float(starting_salary), float(starting_salary)
    f_step, m_step       = 0, 0
    f_years_in, m_years_in = 0, 0
    f_role, m_role       = role, role
    female, male         = [], []

    for year in range(1, years + 1):
        salary_f   *= (1 + ANNUAL_RAISE * (1 - 0.5 * gap_score_f))
        salary_m   *= (1 + ANNUAL_RAISE * (1 + 0.5 * gap_score_m))
        f_years_in += 1
        m_years_in += 1

        f_promoted = f_step < len(steps) and f_years_in >= steps[f_step]['f_yrs']
        m_promoted = m_step < len(steps) and m_years_in >= steps[m_step]['m_yrs']

        if f_promoted:
            salary_f  *= (1 + PROMO_BUMP)
            f_role     = steps[f_step]['to']
            f_step    += 1
            f_years_in = 0
            gap_score_f = predict_single(gmm, scaler, age + year - 1, university_gpa,
                                         internships_completed, networking_score,
                                         round(salary_f), current_job_level, f_role)['female']['gap_score']

        if m_promoted:
            salary_m  *= (1 + PROMO_BUMP)
            m_role     = steps[m_step]['to']
            m_step    += 1
            m_years_in = 0
            gap_score_m = predict_single(gmm, scaler, age + year - 1, university_gpa,
                                         internships_completed, networking_score,
                                         round(salary_m), current_job_level, m_role)['male']['gap_score']

        female.append({'year': year, 'salary': round(salary_f, 2),
                       **({'role': f_role} if f_promoted else {})})
        male.append  ({'year': year, 'salary': round(salary_m, 2),
                       **({'role': m_role} if m_promoted else {})})

    return female, male


def cluster_probabilities(gmm, scaler, age, university_gpa, internships_completed,
                          networking_score, starting_salary, current_job_level):
    """Return soft assignment probabilities across all clusters for one individual."""
    level_enc = LEVEL_ORDER[current_job_level]
    row       = np.array([[age, university_gpa, internships_completed,
                           networking_score, starting_salary, level_enc]], dtype=float)
    probs = gmm.predict_proba(scaler.transform(row))[0]
    return {f"Cluster {i}": round(float(p), 4) for i, p in enumerate(probs)}


def user_summary(gmm, scaler, age, university_gpa, internships_completed,
                 networking_score, starting_salary, current_job_level, role):
    """
    Returns (female_dict, male_dict), each with:
      prob        — promotion probability factoring in cluster gap score
      base_salary — cluster-average starting salary for that gender
    """
    result  = predict_single(gmm, scaler, age, university_gpa, internships_completed,
                             networking_score, starting_salary, current_job_level, role)
    cluster = result['female']['cluster']

    avg     = pd.read_csv(OUT_DIR / 'cluster_avg_salary.csv', index_col=0)
    f_sal   = round(float(avg.loc[cluster, 'Female']), 2)
    m_sal   = round(float(avg.loc[cluster, 'Male']),   2)

    return (
        {'prob': result['female']['promotion_prob'], 'base_salary': f_sal},
        {'prob': result['male']['promotion_prob'],   'base_salary': m_sal},
    )


# ── Cluster characterisation ──────────────────────────────────────────────────

_FEATURE_LABELS = {
    'Starting_Salary':        ('High Income',    'Low Income'),
    'University_GPA':         ('High GPA',       'Low GPA'),
    'Networking_Score':       ('Well Connected', 'Low Network'),
    'Internships_Completed':  ('Experienced',    'Less Exp.'),
    'Current_Job_Level':      ('Senior Level',   'Entry Level'),
    'Age':                    ('Older',          'Younger'),
}

def cluster_descriptors(df, labels, n_tags=2):
    """
    Return a dict {cluster_id: 'Tag1 · Tag2'} describing each cluster
    by its most distinctive features (highest absolute z-score vs overall mean).
    """
    tagged = df.copy()
    tagged['Current_Job_Level'] = tagged['Current_Job_Level'].map(LEVEL_ORDER)
    tagged['Cluster'] = labels
    features = list(_FEATURE_LABELS.keys())

    overall_mean = tagged[features].mean()
    overall_std  = tagged[features].std().replace(0, 1)

    descriptors = {}
    for k in sorted(tagged['Cluster'].unique()):
        cluster_mean = tagged[tagged['Cluster'] == k][features].mean()
        z = (cluster_mean - overall_mean) / overall_std
        top = z.abs().nlargest(n_tags).index
        tags = []
        for feat in top:
            hi, lo = _FEATURE_LABELS[feat]
            tags.append(hi if z[feat] > 0 else lo)
        descriptors[k] = ' · '.join(tags)
    return descriptors


# ── Analysis ──────────────────────────────────────────────────────────────────

def gender_gap_analysis(df, gender_raw, labels):
    """
    Compute salary gap between Male and Female per cluster.
    Normalizes the absolute gap to a 0–1 score and saves to output/gender_gap_scores.csv.
    Returns (gap_df, all_clusters, gap_scores).
    """
    gap_df = df.copy()
    gap_df['Gender']  = gender_raw.values
    gap_df['Cluster'] = labels

    all_clusters = sorted(gap_df['Cluster'].unique())

    salary_by_gender = (
        gap_df.groupby(['Cluster', 'Gender'])['Starting_Salary']
        .mean()
        .unstack()
        .reindex(all_clusters)
    )

    salary_by_gender['raw_gap'] = (
        salary_by_gender.get('Male', pd.Series(dtype=float)) -
        salary_by_gender.get('Female', pd.Series(dtype=float))
    ).abs()

    gap_min = salary_by_gender['raw_gap'].min()
    gap_max = salary_by_gender['raw_gap'].max()
    if gap_max > gap_min:
        normalized = (salary_by_gender['raw_gap'] - gap_min) / (gap_max - gap_min)
        salary_by_gender['gap_score'] = 0.05 + normalized * 0.95
    else:
        salary_by_gender['gap_score'] = 0.05

    OUT_DIR.mkdir(exist_ok=True)
    scores_path = OUT_DIR / 'gender_gap_scores.csv'
    salary_by_gender.round(4).to_csv(scores_path)

    avg_salary_path = OUT_DIR / 'cluster_avg_salary.csv'
    salary_by_gender[['Female', 'Male']].round(2).to_csv(avg_salary_path)

    print(f"\nGender gap scores saved → {scores_path}")
    print(salary_by_gender[['raw_gap', 'gap_score']].round(4).to_string())

    return gap_df, all_clusters, salary_by_gender[['raw_gap', 'gap_score']]

# ── Main (training + diagnostics only) ───────────────────────────────────────

if __name__ == '__main__':
    import helpers

    df                    = load_data()
    X, scaler, gender_raw = preprocess(df)
    gmm, results_df       = load_or_train(X, scaler)

    labels   = predict_batch(X, gmm)
    best_row = results_df.iloc[0]
    helpers.plot_pca(X, labels, gmm, best_row, OUT_DIR, df=df)

    gap_df, all_clusters, gap_scores = gender_gap_analysis(df, gender_raw, labels)
    helpers.plot_gender_gap(gap_df, all_clusters, gap_scores, OUT_DIR)

