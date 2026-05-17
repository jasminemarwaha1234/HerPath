import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
from sklearn.decomposition import PCA

_PALETTE = [
    '#FF6B9D', '#C77DFF', '#48CAE4', '#F4A261', '#57CC99',
    '#FFD166', '#EF476F',
]


def _gauss_pdf_2d(xy_flat, mean, cov):
    diff = xy_flat - mean
    inv  = np.linalg.inv(cov)
    exp  = -0.5 * np.einsum('ni,ij,nj->n', diff, inv, diff)
    det  = np.linalg.det(cov)
    return np.exp(exp) / (2 * np.pi * np.sqrt(np.abs(det)))


# ── New: user summary bar chart ───────────────────────────────────────────────

def plot_user_summary_bar(female_summary: dict, male_summary: dict, out_dir: Path) -> Path:
    """
    Bar chart comparing female vs male base salary and promotion probability
    for the user's cluster. Returns the saved image path.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    width = 0.35
    fig, axes = plt.subplots(1, 2, figsize=(10, 5))
    fig.patch.set_facecolor('white')

    # --- salary ---
    ax = axes[0]
    ax.set_facecolor('#f7f7fb')
    ax.bar(-width / 2, female_summary['base_salary'], width, color='#FF6B9D', label='Female')
    ax.bar( width / 2, male_summary['base_salary'],   width, color='#48CAE4', label='Male')
    ax.set_title('Base Salary by Gender', color='#111')
    ax.set_ylabel('USD')
    ax.set_xticks([0])
    ax.set_xticklabels(['Your Cluster'])
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'${v:,.0f}'))
    ax.legend()
    ax.grid(True, axis='y', color='#ddd', linewidth=0.5)
    for spine in ax.spines.values():
        spine.set_edgecolor('#ccc')

    # --- promotion probability ---
    ax = axes[1]
    ax.set_facecolor('#f7f7fb')
    ax.bar(-width / 2, female_summary['prob'] * 100, width, color='#FF6B9D', label='Female')
    ax.bar( width / 2, male_summary['prob']   * 100, width, color='#48CAE4', label='Male')
    ax.set_title('Promotion Probability by Gender', color='#111')
    ax.set_ylabel('Probability (%)')
    ax.set_xticks([0])
    ax.set_xticklabels(['Your Cluster'])
    ax.set_ylim(0, 105)
    ax.legend()
    ax.grid(True, axis='y', color='#ddd', linewidth=0.5)
    for spine in ax.spines.values():
        spine.set_edgecolor('#ccc')

    plt.suptitle('Gender Gap Summary — Your Cluster', fontsize=13, color='#111')
    plt.tight_layout()
    out_path = out_dir / 'user_summary_bar.png'
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    return out_path


# ── New: career timeline line chart ──────────────────────────────────────────

def plot_career_timeline_line(female_timeline: list, male_timeline: list,
                               current_role: str, out_dir: Path) -> Path:
    """
    Line chart of projected salary over 20 years for female vs male.
    Role changes are annotated with dashed vertical lines. Returns image path.
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    f_years  = [e['year']   for e in female_timeline]
    f_salary = [e['salary'] for e in female_timeline]
    m_years  = [e['year']   for e in male_timeline]
    m_salary = [e['salary'] for e in male_timeline]

    fig, ax = plt.subplots(figsize=(12, 6))
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#f7f7fb')

    ax.plot(f_years, f_salary, color='#FF6B9D', linewidth=2.5, label='Female', zorder=3)
    ax.plot(m_years, m_salary, color='#48CAE4', linewidth=2.5, label='Male',   zorder=3)

    for timeline, color in [(female_timeline, '#FF6B9D'), (male_timeline, '#48CAE4')]:
        for entry in timeline:
            if 'role' in entry:
                ax.axvline(entry['year'], color=color, linewidth=0.8, linestyle='--', alpha=0.5)
                ax.annotate(
                    entry['role'], xy=(entry['year'], entry['salary']),
                    fontsize=7, color=color, rotation=45, ha='left', va='bottom',
                    xytext=(4, 4), textcoords='offset points',
                )

    ax.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'${v:,.0f}'))
    ax.set_xlabel('Year', color='#333', fontsize=11)
    ax.set_ylabel('Salary (USD)', color='#333', fontsize=11)
    ax.set_title(f'20-Year Career Salary Trajectory — starting as {current_role}',
                 color='#111', fontsize=13, pad=14)
    ax.legend(fontsize=10)
    ax.grid(True, color='#ddd', linewidth=0.5, alpha=0.8)
    for spine in ax.spines.values():
        spine.set_edgecolor('#ccc')

    plt.tight_layout()
    out_path = out_dir / 'career_timeline_line.png'
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    return out_path


# ── Cluster image (user position stamped on PCA plot) ────────────────────────

def plot_cluster_image(X, labels, gmm, scaler, best_row,
                       age, university_gpa, internships_completed,
                       networking_score, starting_salary, current_job_level_enc: int,
                       out_dir: Path, df=None) -> tuple[Path, int]:
    """
    Render the PCA cluster plot with an X marker at the user's position.
    Returns (image_path, cluster_id).
    """
    from matplotlib.colors import LinearSegmentedColormap
    from gmm import cluster_descriptors

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    pca        = PCA(n_components=2)
    X_2d       = pca.fit_transform(X)
    centers_2d = pca.transform(gmm.means_)
    W          = pca.components_

    user_raw     = np.array([[age, university_gpa, internships_completed,
                               networking_score, starting_salary, current_job_level_enc]], dtype=float)
    user_scaled  = scaler.transform(user_raw)
    user_cluster = int(gmm.predict(user_scaled)[0])
    user_2d      = pca.transform(user_scaled)[0]

    n_clusters = int(best_row.n_components)
    colors     = _PALETTE[:n_clusters]

    pad  = 0.8
    x_lo, x_hi = X_2d[:, 0].min() - pad, X_2d[:, 0].max() + pad
    y_lo, y_hi = X_2d[:, 1].min() - pad, X_2d[:, 1].max() + pad
    gx, gy     = np.meshgrid(np.linspace(x_lo, x_hi, 400),
                              np.linspace(y_lo, y_hi, 400))
    grid = np.column_stack([gx.ravel(), gy.ravel()])

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
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1], color=colors[k], s=120, alpha=0.12, zorder=3, linewidths=0)
        label = f'Cluster {k}' + (f'  {descs[k]}' if k in descs else '')
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1], color=colors[k], s=28, edgecolors='white',
                   linewidths=0.3, alpha=0.85, label=label, zorder=4)

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
    out_path = out_dir / 'cluster_image.png'
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    return out_path, user_cluster


# ── Training-time plots (kept for __main__ in gmm.py) ────────────────────────

def plot_pca(X, labels, gmm, best_row, out_dir: Path, df=None):
    from matplotlib.colors import LinearSegmentedColormap
    from gmm import cluster_descriptors

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    pca        = PCA(n_components=2)
    X_2d       = pca.fit_transform(X)
    centers_2d = pca.transform(gmm.means_)
    W          = pca.components_

    n_clusters = int(best_row.n_components)
    colors     = _PALETTE[:n_clusters]

    pad  = 0.8
    x_lo, x_hi = X_2d[:, 0].min() - pad, X_2d[:, 0].max() + pad
    y_lo, y_hi = X_2d[:, 1].min() - pad, X_2d[:, 1].max() + pad
    gx, gy     = np.meshgrid(np.linspace(x_lo, x_hi, 400),
                              np.linspace(y_lo, y_hi, 400))
    grid = np.column_stack([gx.ravel(), gy.ravel()])

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
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1], color=colors[k], s=120, alpha=0.12, zorder=3, linewidths=0)
        label = f'Cluster {k}' + (f'  {descs[k]}' if k in descs else '')
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1], color=colors[k], s=28, edgecolors='white',
                   linewidths=0.3, alpha=0.85, label=label, zorder=4)

    ax.tick_params(color='#aaa', labelsize=9, labelcolor='#444')
    ax.set_xlabel(f"PC1  ({pca.explained_variance_ratio_[0]*100:.1f}% var)", color='#333', fontsize=11)
    ax.set_ylabel(f"PC2  ({pca.explained_variance_ratio_[1]*100:.1f}% var)", color='#333', fontsize=11)
    ax.set_title(f"GMM Clusters — PCA projection  ·  n={n_clusters}, cov={best_row.covariance_type}",
                 color='#111', fontsize=13, pad=14)
    for spine in ax.spines.values():
        spine.set_edgecolor('#ccc')
    ax.legend(loc='upper left', fontsize=8, framealpha=0.7,
              facecolor='white', edgecolor='#ccc', labelcolor='#222', markerscale=1.2)
    ax.grid(True, color='#ddd', linewidth=0.5, alpha=0.8)
    ax.set_xlim(x_lo, x_hi)
    ax.set_ylim(y_lo, y_hi)

    plt.tight_layout()
    out_path = out_dir / 'clusters_pca.png'
    plt.savefig(out_path, dpi=150, facecolor=fig.get_facecolor())
    plt.close()
    print(f"Cluster plot saved → {out_path}")


def plot_gender_gap(gap_df, all_clusters, gap_scores, out_dir: Path):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

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

    axes[2].bar(gap_scores.index, gap_scores['gap_score'], color='mediumpurple')
    axes[2].set_title("Gender Gap Score (0–1 normalized)")
    axes[2].set_xlabel("Cluster")
    axes[2].set_ylabel("Gap Score")
    axes[2].set_xticks(all_clusters)
    axes[2].set_ylim(0, 1.05)
    axes[2].grid(True, axis='y')

    plt.suptitle("Gender Salary Gap Across Clusters", fontsize=13)
    plt.tight_layout()
    out_path = out_dir / 'gender_gap_bar.png'
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"Gender gap bar chart saved → {out_path}")
