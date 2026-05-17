import matplotlib
matplotlib.use('Agg')
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
    print(f"\nGender gap scores saved → {scores_path}")
    print(salary_by_gender[['raw_gap', 'gap_score']].round(4).to_string())

    return gap_df, all_clusters, salary_by_gender[['raw_gap', 'gap_score']]

# ── Plots ─────────────────────────────────────────────────────────────────────

# Soft palette — works on dark background
_PALETTE = [
    '#FF6B9D', '#C77DFF', '#48CAE4', '#F4A261', '#57CC99',
    '#FFD166', '#EF476F',
]


def _gauss_pdf_2d(xy_flat, mean, cov):
    """Evaluate 2-D Gaussian PDF on a flat (N,2) grid."""
    diff = xy_flat - mean
    inv  = np.linalg.inv(cov)
    exp  = -0.5 * np.einsum('ni,ij,nj->n', diff, inv, diff)
    det  = np.linalg.det(cov)
    return np.exp(exp) / (2 * np.pi * np.sqrt(np.abs(det)))


def plot_pca(X, labels, gmm, best_row, df=None):
    from matplotlib.colors import LinearSegmentedColormap

    pca        = PCA(n_components=2)
    X_2d       = pca.fit_transform(X)
    centers_2d = pca.transform(gmm.means_)
    W          = pca.components_

    n_clusters = int(best_row.n_components)
    colors     = _PALETTE[:n_clusters]

    # Build a dense grid over the PCA plane
    pad  = 0.8
    x_lo, x_hi = X_2d[:, 0].min() - pad, X_2d[:, 0].max() + pad
    y_lo, y_hi = X_2d[:, 1].min() - pad, X_2d[:, 1].max() + pad
    gx, gy     = np.meshgrid(np.linspace(x_lo, x_hi, 400),
                              np.linspace(y_lo, y_hi, 400))
    grid       = np.column_stack([gx.ravel(), gy.ravel()])

    fig, ax = plt.subplots(figsize=(11, 8))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#f7f7fb')

    # --- per-cluster smooth density fill + contour lines ---
    for k in range(n_clusters):
        hex_col = colors[k]
        r, g, b = tuple(int(hex_col.lstrip('#')[i:i+2], 16) / 255 for i in (0, 2, 4))

        cov_full = (
            gmm.covariances_[k]                        if gmm.covariance_type == 'full'      else
            np.diag(gmm.covariances_[k])               if gmm.covariance_type == 'diag'      else
            gmm.covariances_[k] * np.eye(X.shape[1])  if gmm.covariance_type == 'spherical' else
            gmm.covariances_ * np.eye(X.shape[1])
        )
        cov_2d = W @ cov_full @ W.T
        pdf    = _gauss_pdf_2d(grid, centers_2d[k], cov_2d).reshape(gx.shape)
        pdf    = pdf / pdf.max()  # normalise to [0,1] per cluster

        # transparent-to-color fill
        cmap_k = LinearSegmentedColormap.from_list(
            f'c{k}', [(r, g, b, 0.0), (r, g, b, 0.38)], N=256)
        ax.contourf(gx, gy, pdf, levels=30, cmap=cmap_k, zorder=1)

        # glowing vine contour lines
        for lev, lw, alpha in [(0.25, 0.6, 0.35), (0.55, 1.0, 0.6), (0.82, 1.6, 0.9)]:
            ax.contour(gx, gy, pdf, levels=[lev],
                       colors=[hex_col], linewidths=lw, alpha=alpha, zorder=2)

    # --- scatter points ---
    descs = cluster_descriptors(df, labels) if df is not None else {}
    for k in range(n_clusters):
        mask = labels == k
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1],
                   color=colors[k], s=120, alpha=0.12, zorder=3, linewidths=0)
        label = f'Cluster {k}' + (f'  {descs[k]}' if k in descs else '')
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1],
                   color=colors[k], s=28, edgecolors='white', linewidths=0.3,
                   alpha=0.85, label=label, zorder=4)


    # --- styling ---
    ax.tick_params(color='#aaa', labelsize=9, labelcolor='#444')
    ax.set_xlabel(f"PC1  ({pca.explained_variance_ratio_[0]*100:.1f}% var)", color='#333', fontsize=11)
    ax.set_ylabel(f"PC2  ({pca.explained_variance_ratio_[1]*100:.1f}% var)", color='#333', fontsize=11)
    ax.set_title(f"GMM Clusters — PCA projection  ·  n={n_clusters}, cov={best_row.covariance_type}",
                 color='#111', fontsize=13, pad=14)
    for spine in ax.spines.values():
        spine.set_edgecolor('#ccc')

    ax.legend(loc='upper left', fontsize=8, framealpha=0.7,
              facecolor='white', edgecolor='#ccc', labelcolor='#222',
              markerscale=1.2)
    ax.grid(True, color='#ddd', linewidth=0.5, alpha=0.8)
    ax.set_xlim(x_lo, x_hi)
    ax.set_ylim(y_lo, y_hi)

    plt.tight_layout()
    out_path = OUT_DIR / 'clusters_pca.png'
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    print(f"Cluster plot saved → {out_path}")


def plot_user_on_clusters(X, labels, gmm, scaler, best_row,
                          age, university_gpa, internships_completed,
                          networking_score, starting_salary, current_job_level,
                          df=None):
    """
    Re-render the cluster plot and stamp an X at the user's projected PCA position.
    Returns the assigned cluster index.
    """
    from matplotlib.colors import LinearSegmentedColormap

    pca        = PCA(n_components=2)
    X_2d       = pca.fit_transform(X)
    centers_2d = pca.transform(gmm.means_)
    W          = pca.components_

    # project the user
    level_enc = LEVEL_ORDER[current_job_level]
    user_raw  = np.array([[age, university_gpa, internships_completed,
                           networking_score, starting_salary, level_enc]], dtype=float)
    user_scaled = scaler.transform(user_raw)
    user_cluster = int(gmm.predict(user_scaled)[0])
    user_2d      = pca.transform(user_scaled)[0]

    n_clusters = int(best_row.n_components)
    colors     = _PALETTE[:n_clusters]

    pad  = 0.8
    x_lo, x_hi = X_2d[:, 0].min() - pad, X_2d[:, 0].max() + pad
    y_lo, y_hi = X_2d[:, 1].min() - pad, X_2d[:, 1].max() + pad
    gx, gy     = np.meshgrid(np.linspace(x_lo, x_hi, 400),
                              np.linspace(y_lo, y_hi, 400))
    grid       = np.column_stack([gx.ravel(), gy.ravel()])

    fig, ax = plt.subplots(figsize=(11, 8))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#f7f7fb')

    for k in range(n_clusters):
        hex_col = colors[k]
        r, g, b = tuple(int(hex_col.lstrip('#')[i:i+2], 16) / 255 for i in (0, 2, 4))
        cov_full = (
            gmm.covariances_[k]                        if gmm.covariance_type == 'full'      else
            np.diag(gmm.covariances_[k])               if gmm.covariance_type == 'diag'      else
            gmm.covariances_[k] * np.eye(X.shape[1])  if gmm.covariance_type == 'spherical' else
            gmm.covariances_ * np.eye(X.shape[1])
        )
        cov_2d = W @ cov_full @ W.T
        pdf    = _gauss_pdf_2d(grid, centers_2d[k], cov_2d).reshape(gx.shape)
        pdf    = pdf / pdf.max()

        cmap_k = LinearSegmentedColormap.from_list(
            f'c{k}', [(r, g, b, 0.0), (r, g, b, 0.38)], N=256)
        ax.contourf(gx, gy, pdf, levels=30, cmap=cmap_k, zorder=1)
        for lev, lw, alpha in [(0.25, 0.6, 0.35), (0.55, 1.0, 0.6), (0.82, 1.6, 0.9)]:
            ax.contour(gx, gy, pdf, levels=[lev],
                       colors=[hex_col], linewidths=lw, alpha=alpha, zorder=2)

    descs = cluster_descriptors(df, labels) if df is not None else {}
    for k in range(n_clusters):
        mask = labels == k
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1],
                   color=colors[k], s=120, alpha=0.12, zorder=3, linewidths=0)
        label = f'Cluster {k}' + (f'  {descs[k]}' if k in descs else '')
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1],
                   color=colors[k], s=28, edgecolors='white', linewidths=0.3,
                   alpha=0.85, label=label, zorder=4)


    # user X marker
    user_color = colors[user_cluster]
    ax.scatter(*user_2d, s=400, marker='X', color=user_color,
               edgecolors='black', linewidths=1.5, zorder=7)
    ax.annotate(f'You (cluster {user_cluster})', xy=user_2d,
                fontsize=9, color='#111', fontweight='bold',
                xytext=(user_2d[0] + 0.15, user_2d[1] + 0.12), zorder=8)

    ax.tick_params(color='#aaa', labelsize=9, labelcolor='#444')
    ax.set_xlabel(f"PC1  ({pca.explained_variance_ratio_[0]*100:.1f}% var)", color='#333', fontsize=11)
    ax.set_ylabel(f"PC2  ({pca.explained_variance_ratio_[1]*100:.1f}% var)", color='#333', fontsize=11)
    ax.set_title(f"GMM Clusters — your position marked  ·  n={n_clusters}, cov={best_row.covariance_type}",
                 color='#111', fontsize=13, pad=14)
    for spine in ax.spines.values():
        spine.set_edgecolor('#ccc')
    ax.legend(loc='upper left', fontsize=8, framealpha=0.7,
              facecolor='white', edgecolor='#ccc', labelcolor='#222', markerscale=1.2)
    ax.grid(True, color='#ddd', linewidth=0.5, alpha=0.8)
    ax.set_xlim(x_lo, x_hi)
    ax.set_ylim(y_lo, y_hi)

    plt.tight_layout()
    out_path = OUT_DIR / 'clusters_user.png'
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    print(f"User cluster plot saved → {out_path}  (cluster {user_cluster})")
    return user_cluster


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
    out_path = OUT_DIR / 'gender_gap_bar.png'
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Gender gap bar chart saved → {out_path}")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    df                    = load_data()
    X, scaler, gender_raw = preprocess(df)
    gmm, results_df       = load_or_train(X, scaler)

    labels = predict_batch(X, gmm)
    best_row = results_df.iloc[0]
    plot_pca(X, labels, gmm, best_row, df=df)

    gap_df, all_clusters, gap_scores = gender_gap_analysis(df, gender_raw, labels)
    plot_gender_gap(gap_df, all_clusters, gap_scores)

    sample = {
        'age': 23,
        'university_gpa': 3.5,
        'internships_completed': 2,
        'networking_score': 7,
        'starting_salary': 72000,
        'current_job_level': 'Mid',
    }
    plot_user_on_clusters(X, labels, gmm, scaler, best_row, **sample, df=df)

    sample = {
        'age': 23,
        'university_gpa': 3.5,
        'internships_completed': 2,
        'networking_score': 7,
        'starting_salary': 72000,
        'current_job_level': 'Mid',
        'role': 'Software Engineer',
    }

    female, male = career_timeline(sample['role'], gmm, scaler,
                                   **{k: v for k, v in sample.items() if k != 'role'})

