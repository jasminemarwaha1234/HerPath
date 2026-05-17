import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import joblib
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
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
                    networking_score, starting_salary, current_job_level, years=10):
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

    # Annotate each chain step with how many years the person stays in that role.
    steps = []
    for step in chain:
        avg_prob = (step['female_prob'] + step['male_prob']) / 2
        yrs = max(1, round(1 / avg_prob)) if avg_prob > 0 else years
        steps.append({**step, 'years_in_role': yrs})

    start_probs = predict_single(gmm, scaler, age, university_gpa, internships_completed,
                                 networking_score, starting_salary, current_job_level, role)
    gap_score    = start_probs['female']['gap_score']
    salary_f     = float(starting_salary)
    salary_m     = float(starting_salary)
    current_role = role
    step_idx     = 0
    years_in_current = 0
    timeline     = []

    for year in range(1, years + 1):
        if step_idx < len(steps):
            f_prob = steps[step_idx]['female_prob']
            m_prob = steps[step_idx]['male_prob']
        elif steps:
            f_prob = steps[-1]['female_prob']
            m_prob = steps[-1]['male_prob']
        else:
            f_prob = m_prob = 0.5

        # Gap widens raise rates: females get slightly less, males slightly more.
        salary_f *= (1 + ANNUAL_RAISE * (1 - 0.5 * gap_score))
        salary_m *= (1 + ANNUAL_RAISE * (1 + 0.5 * gap_score))
        years_in_current += 1

        timeline.append({
            'year':                  year,
            'age':                   age + year - 1,
            'role':                  current_role,
            'female_salary':         round(salary_f, 2),
            'male_salary':           round(salary_m, 2),
            'female_promotion_prob': round(f_prob, 4),
            'male_promotion_prob':   round(m_prob, 4),
            'gap_score':             round(gap_score, 4),
        })

        # Advance role when the expected tenure expires.
        if step_idx < len(steps) and years_in_current >= steps[step_idx]['years_in_role']:
            salary_f     *= (1 + PROMO_BUMP)
            salary_m     *= (1 + PROMO_BUMP)
            current_role  = steps[step_idx]['to']
            step_idx     += 1
            years_in_current = 0
            new_probs    = predict_single(gmm, scaler, age + year - 1, university_gpa,
                                          internships_completed, networking_score,
                                          round(salary_f), current_job_level, current_role)
            gap_score    = new_probs['female']['gap_score']

    return timeline


def cluster_probabilities(gmm, scaler, age, university_gpa, internships_completed,
                          networking_score, starting_salary, current_job_level):
    """Return soft assignment probabilities across all clusters for one individual."""
    level_enc = LEVEL_ORDER[current_job_level]
    row       = np.array([[age, university_gpa, internships_completed,
                           networking_score, starting_salary, level_enc]], dtype=float)
    probs = gmm.predict_proba(scaler.transform(row))[0]
    return {f"Cluster {i}": round(float(p), 4) for i, p in enumerate(probs)}



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
    print(f"\nGender gap scores saved → {scores_path}")
    print(salary_by_gender[['raw_gap', 'gap_score']].round(4).to_string())

    return gap_df, all_clusters, salary_by_gender[['raw_gap', 'gap_score']]

# ── Plots ─────────────────────────────────────────────────────────────────────

def plot_pca(X, labels, gmm, best_row):
    pca        = PCA(n_components=2)
    X_2d       = pca.fit_transform(X)
    centers_2d = pca.transform(gmm.means_)

    plt.figure(figsize=(8, 6))
    sc = plt.scatter(X_2d[:, 0], X_2d[:, 1], c=labels, cmap='tab10',
                     s=50, edgecolor='k', linewidth=0.3, alpha=0.8)
    plt.scatter(centers_2d[:, 0], centers_2d[:, 1],
                s=300, c='red', marker='X', label='Centers', zorder=5)
    plt.colorbar(sc, label='Cluster')
    plt.title(f"GMM Clustering — PCA projection\n"
              f"n={int(best_row.n_components)}, cov={best_row.covariance_type}")
    plt.xlabel(f"PC1 ({pca.explained_variance_ratio_[0]*100:.1f}% var)")
    plt.ylabel(f"PC2 ({pca.explained_variance_ratio_[1]*100:.1f}% var)")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()


def plot_bic_aic(results_df):
    _, axes = plt.subplots(1, 2, figsize=(12, 4))
    for ax, metric in zip(axes, ['bic', 'aic']):
        for cov in PARAM_GRID['covariance_type']:
            subset  = results_df[results_df['covariance_type'] == cov]
            grouped = subset.groupby('n_components')[metric].min()
            ax.plot(grouped.index, grouped.values, marker='o', label=cov)
        ax.set_title(f"{metric.upper()} vs n_components")
        ax.set_xlabel("n_components")
        ax.set_ylabel(metric.upper())
        ax.legend()
        ax.grid(True)
    plt.tight_layout()
    plt.show()


def plot_gender_gap(gap_df, all_clusters, gap_scores):
    _, axes = plt.subplots(1, 3, figsize=(16, 5))

    for (gender, color), ax in zip([('Female', 'salmon'), ('Male', 'steelblue')], axes[:2]):
        means = (
            gap_df[gap_df['Gender'] == gender]
            .groupby('Cluster')['Starting_Salary']
            .mean()
            .reindex(all_clusters, fill_value=0)
        )
        ax.bar(means.index, means.values, color=color)
        ax.set_title(f"Avg Starting Salary — {gender}")
        ax.set_xlabel("Cluster")
        ax.set_ylabel("Starting Salary (USD)")
        ax.set_xticks(all_clusters)
        ax.grid(True, axis='y')

    # gap score per cluster
    axes[2].bar(gap_scores.index, gap_scores['gap_score'], color='mediumpurple')
    axes[2].set_title("Gender Gap Score (0–1 normalized)")
    axes[2].set_xlabel("Cluster")
    axes[2].set_ylabel("Gap Score")
    axes[2].set_xticks(all_clusters)
    axes[2].set_ylim(0, 1.05)
    axes[2].grid(True, axis='y')

    plt.suptitle("Gender Salary Gap Across Clusters", fontsize=13)
    plt.tight_layout()
    plt.show()


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    df                    = load_data()
    X, scaler, gender_raw = preprocess(df)
    gmm, _                = load_or_train(X, scaler)

    sample = {
        'age': 23,
        'university_gpa': 3.5,
        'internships_completed': 2,
        'networking_score': 7,
        'starting_salary': 72000,
        'current_job_level': 'Mid',
        'role': 'Software Engineer',
    }

    timeline = career_timeline(sample['role'], gmm, scaler,
                               **{k: v for k, v in sample.items() if k != 'role'})
    for pt in timeline:
        print(pt)
