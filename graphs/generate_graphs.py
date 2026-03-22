import pandas as pd
import matplotlib.pyplot as plt
import os
import sys

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "resultados", "resultados_benchmark.csv")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

PROTOCOL_ORDER = ["WS", "TCP_RAW", "GRPC", "WT"]
STRATEGY_ORDER = ["STATE", "OPERATION", "DELTA"]
LATENCY_ORDER = ["LOCAL", "REGIONAL", "INTERCONTINENTAL"]

PROTOCOL_LABELS = {"WS": "WebSocket", "TCP_RAW": "Raw TCP", "GRPC": "gRPC", "WT": "WebTransport"}
STRATEGY_LABELS = {"STATE": "State-based", "OPERATION": "Op-based", "DELTA": "Delta-based"}
LATENCY_LABELS = {"LOCAL": "Local (0 ms)", "REGIONAL": "Regional (900–1000 ms)", "INTERCONTINENTAL": "Intercont. (1–2 s)"}

PROTOCOL_COLORS = {"WS": "#1f77b4", "TCP_RAW": "#ff7f0e", "GRPC": "#2ca02c", "WT": "#d62728"}
STRATEGY_COLORS = {"STATE": "#1f77b4", "OPERATION": "#ff7f0e", "DELTA": "#2ca02c"}

PROTOCOL_MARKERS = {"WS": "o", "TCP_RAW": "s", "GRPC": "^", "WT": "D"}
STRATEGY_MARKERS = {"STATE": "o", "OPERATION": "s", "DELTA": "^"}

plt.rcParams.update({
    "font.family": "serif",
    "font.size": 9,
    "axes.labelsize": 10,
    "legend.fontsize": 8,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "figure.dpi": 150,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.05,
})


def load_data() -> pd.DataFrame:
    if not os.path.exists(CSV_PATH):
        print(f"CSV not found: {CSV_PATH}")
        sys.exit(1)
    df = pd.read_csv(CSV_PATH)
    df["LatencyScenario"] = pd.Categorical(df["LatencyScenario"], categories=LATENCY_ORDER, ordered=True)
    df["Protocol"] = pd.Categorical(df["Protocol"], categories=PROTOCOL_ORDER, ordered=True)
    df["Strategy"] = pd.Categorical(df["Strategy"], categories=STRATEGY_ORDER, ordered=True)
    return df


def save(fig: plt.Figure, name: str):
    fig.savefig(os.path.join(OUTPUT_DIR, name), format="pdf")
    plt.close(fig)
    print(f"  {name}")


def _lineplot_grid(df: pd.DataFrame, y_col: str, y_label: str, row_col: str, col_col: str,
                   hue_col: str, colors: dict, markers: dict, labels: dict,
                   row_labels: dict, col_labels: dict, filename: str):
    row_vals = df[row_col].cat.categories
    col_vals = df[col_col].cat.categories
    nrows, ncols = len(row_vals), len(col_vals)

    fig, axes = plt.subplots(nrows, ncols, figsize=(3.2 * ncols, 2.5 * nrows), sharex=True, sharey="row", squeeze=False)

    hue_vals = df[hue_col].cat.categories

    for r, rv in enumerate(row_vals):
        for c, cv in enumerate(col_vals):
            ax = axes[r][c]
            subset = df[(df[row_col] == rv) & (df[col_col] == cv)]

            for hv in hue_vals:
                data = subset[subset[hue_col] == hv]
                if data.empty:
                    continue
                grouped = data.groupby("Bots")[y_col]
                mean = grouped.mean()
                ci_lo = grouped.quantile(0.025)
                ci_hi = grouped.quantile(0.975)

                ax.plot(mean.index, mean.values, color=colors[hv], marker=markers[hv],
                        markersize=4, linewidth=1.2, label=labels[hv])
                ax.fill_between(mean.index, ci_lo.values, ci_hi.values, color=colors[hv], alpha=0.15)

            if r == nrows - 1:
                ax.set_xlabel("Number of bots")
            if c == 0:
                ax.set_ylabel(y_label)

            if r == 0:
                ax.annotate(col_labels[cv], xy=(0.5, 1.08), xycoords="axes fraction", ha="center", fontsize=9, fontweight="bold")
            if c == ncols - 1:
                ax.annotate(row_labels[rv], xy=(1.04, 0.5), xycoords="axes fraction", ha="left", va="center",
                            fontsize=9, rotation=-90)

    handles, lbls = axes[0][0].get_legend_handles_labels()
    fig.legend(handles, lbls, loc="lower center", ncol=len(hue_vals), frameon=False,
               bbox_to_anchor=(0.5, -0.02))
    fig.subplots_adjust(hspace=0.3, wspace=0.15)
    save(fig, filename)


# ── Fig 1: Convergence by Protocol ──────────────────────────────────

def fig01_convergence_by_protocol(df: pd.DataFrame):
    _lineplot_grid(df, "ConvergenceTimeMs", "Convergence time (ms)",
                   row_col="LatencyScenario", col_col="Strategy", hue_col="Protocol",
                   colors=PROTOCOL_COLORS, markers=PROTOCOL_MARKERS, labels=PROTOCOL_LABELS,
                   row_labels=LATENCY_LABELS, col_labels=STRATEGY_LABELS,
                   filename="fig01_convergence_by_protocol.pdf")


# ── Fig 2: Convergence by Strategy ──────────────────────────────────

def fig02_convergence_by_strategy(df: pd.DataFrame):
    _lineplot_grid(df, "ConvergenceTimeMs", "Convergence time (ms)",
                   row_col="LatencyScenario", col_col="Protocol", hue_col="Strategy",
                   colors=STRATEGY_COLORS, markers=STRATEGY_MARKERS, labels=STRATEGY_LABELS,
                   row_labels=LATENCY_LABELS, col_labels=PROTOCOL_LABELS,
                   filename="fig02_convergence_by_strategy.pdf")


# ── Fig 3: Network Overhead ─────────────────────────────────────────

def fig03_network_overhead(df: pd.DataFrame):
    latencies = df["LatencyScenario"].cat.categories
    ncols = len(latencies)
    fig, axes = plt.subplots(1, ncols, figsize=(3.2 * ncols, 2.8), sharey=True, squeeze=False)

    for i, lat in enumerate(latencies):
        ax = axes[0][i]
        subset = df[df["LatencyScenario"] == lat]

        for s in STRATEGY_ORDER:
            data = subset[subset["Strategy"] == s]
            grouped = data.groupby("Bots")["NetworkBytes"]
            mean = grouped.mean() / 1024
            ci_lo = grouped.quantile(0.025) / 1024
            ci_hi = grouped.quantile(0.975) / 1024

            ax.plot(mean.index, mean.values, color=STRATEGY_COLORS[s], marker=STRATEGY_MARKERS[s],
                    markersize=4, linewidth=1.2, label=STRATEGY_LABELS[s])
            ax.fill_between(mean.index, ci_lo.values, ci_hi.values, color=STRATEGY_COLORS[s], alpha=0.15)

        ax.set_xlabel("Number of bots")
        if i == 0:
            ax.set_ylabel("Network traffic (KB)")
        ax.annotate(LATENCY_LABELS[lat], xy=(0.5, 1.06), xycoords="axes fraction", ha="center", fontsize=9, fontweight="bold")

    handles, lbls = axes[0][0].get_legend_handles_labels()
    fig.legend(handles, lbls, loc="lower center", ncol=3, frameon=False, bbox_to_anchor=(0.5, -0.12))
    fig.subplots_adjust(wspace=0.1, bottom=0.18)
    save(fig, "fig03_network_overhead.pdf")


# ── Fig 4: Memory Usage ─────────────────────────────────────────────

def fig04_memory_usage(df: pd.DataFrame):
    latencies = df["LatencyScenario"].cat.categories
    ncols = len(latencies)
    fig, axes = plt.subplots(1, ncols, figsize=(3.2 * ncols, 2.8), sharey=True, squeeze=False)

    for i, lat in enumerate(latencies):
        ax = axes[0][i]
        subset = df[df["LatencyScenario"] == lat]

        for s in STRATEGY_ORDER:
            data = subset[subset["Strategy"] == s]
            grouped = data.groupby("Bots")["MemorySizeBytes"]
            mean = grouped.mean() / 1024
            ci_lo = grouped.quantile(0.025) / 1024
            ci_hi = grouped.quantile(0.975) / 1024

            ax.plot(mean.index, mean.values, color=STRATEGY_COLORS[s], marker=STRATEGY_MARKERS[s],
                    markersize=4, linewidth=1.2, label=STRATEGY_LABELS[s])
            ax.fill_between(mean.index, ci_lo.values, ci_hi.values, color=STRATEGY_COLORS[s], alpha=0.15)

        ax.set_xlabel("Number of bots")
        if i == 0:
            ax.set_ylabel("Memory footprint (KB)")
        ax.annotate(LATENCY_LABELS[lat], xy=(0.5, 1.06), xycoords="axes fraction", ha="center", fontsize=9, fontweight="bold")

    handles, lbls = axes[0][0].get_legend_handles_labels()
    fig.legend(handles, lbls, loc="lower center", ncol=3, frameon=False, bbox_to_anchor=(0.5, -0.12))
    fig.subplots_adjust(wspace=0.1, bottom=0.18)
    save(fig, "fig04_memory_usage.pdf")


# ── Fig 5: Metadata Ratio ───────────────────────────────────────────

def fig05_metadata_ratio(df: pd.DataFrame):
    df_calc = df.copy()
    df_calc["MetadataRatio"] = df_calc["MetadataOverheadBytes"] / df_calc["NetworkBytes"].replace(0, 1) * 100

    bots_list = sorted(df_calc["Bots"].unique())
    ncols = len(bots_list)
    fig, axes = plt.subplots(1, ncols, figsize=(2.5 * ncols, 2.8), sharey=True, squeeze=False)

    for i, bots in enumerate(bots_list):
        ax = axes[0][i]
        subset = df_calc[df_calc["Bots"] == bots]
        grouped = subset.groupby("Strategy", observed=True)["MetadataRatio"].mean()
        grouped = grouped.reindex(STRATEGY_ORDER)

        bars = ax.bar(range(len(STRATEGY_ORDER)), grouped.values,
                      color=[STRATEGY_COLORS[s] for s in STRATEGY_ORDER], width=0.6, edgecolor="white")

        ax.set_xticks(range(len(STRATEGY_ORDER)))
        ax.set_xticklabels([STRATEGY_LABELS[s] for s in STRATEGY_ORDER], rotation=30, ha="right", fontsize=7)
        ax.set_xlabel("")
        if i == 0:
            ax.set_ylabel("Metadata overhead (%)")
        ax.annotate(f"{bots} bots", xy=(0.5, 1.06), xycoords="axes fraction", ha="center", fontsize=9, fontweight="bold")
        ax.set_ylim(bottom=0)

        for bar, val in zip(bars, grouped.values):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
                    f"{val:.1f}%", ha="center", va="bottom", fontsize=7)

    fig.subplots_adjust(wspace=0.12)
    save(fig, "fig05_metadata_ratio.pdf")


# ── Fig 6: Latency Impact ───────────────────────────────────────────

def fig06_latency_impact(df: pd.DataFrame):
    max_bots = df["Bots"].max()
    subset = df[df["Bots"] == max_bots]

    grouped = subset.groupby(["LatencyScenario", "Protocol", "Strategy"], observed=True)["ConvergenceTimeMs"]
    mean = grouped.mean().reset_index()
    std = grouped.std().reset_index()
    mean["std"] = std["ConvergenceTimeMs"]

    mean["Combo"] = mean["Protocol"].astype(str).map(PROTOCOL_LABELS) + " + " + mean["Strategy"].astype(str).map(STRATEGY_LABELS)

    combos = []
    for p in PROTOCOL_ORDER:
        for s in STRATEGY_ORDER:
            combos.append(PROTOCOL_LABELS[p] + " + " + STRATEGY_LABELS[s])

    fig, ax = plt.subplots(figsize=(10, 4))

    x = range(len(combos))
    width = 0.25
    lat_colors = {"LOCAL": "#4daf4a", "REGIONAL": "#ff7f00", "INTERCONTINENTAL": "#e41a1c"}

    for j, lat in enumerate(LATENCY_ORDER):
        vals = []
        errs = []
        for combo in combos:
            row = mean[(mean["Combo"] == combo) & (mean["LatencyScenario"] == lat)]
            vals.append(row["ConvergenceTimeMs"].values[0] if len(row) > 0 else 0)
            errs.append(row["std"].values[0] if len(row) > 0 else 0)

        positions = [xi + (j - 1) * width for xi in x]
        ax.bar(positions, vals, width, yerr=errs, color=lat_colors[lat],
               label=LATENCY_LABELS[lat], edgecolor="white", capsize=2, error_kw={"linewidth": 0.8})

    ax.set_xticks(x)
    ax.set_xticklabels(combos, rotation=45, ha="right", fontsize=7)
    ax.set_ylabel("Convergence time (ms)")
    ax.legend(frameon=False, fontsize=8)
    fig.subplots_adjust(bottom=0.35)
    save(fig, "fig06_latency_impact.pdf")


# ── Fig 7: Convergence Boxplot ───────────────────────────────────────

def fig07_convergence_boxplot(df: pd.DataFrame):
    bots_list = sorted(df["Bots"].unique())
    ncols = len(bots_list)
    fig, axes = plt.subplots(1, ncols, figsize=(3 * ncols, 3), sharey=True, squeeze=False)

    for i, bots in enumerate(bots_list):
        ax = axes[0][i]
        subset = df[df["Bots"] == bots]

        plot_data = []
        plot_labels = []
        plot_colors = []
        for p in PROTOCOL_ORDER:
            data = subset[subset["Protocol"] == p]["ConvergenceTimeMs"]
            plot_data.append(data.values)
            plot_labels.append(PROTOCOL_LABELS[p])
            plot_colors.append(PROTOCOL_COLORS[p])

        bp = ax.boxplot(plot_data, tick_labels=plot_labels, patch_artist=True, widths=0.6,
                        medianprops={"color": "black", "linewidth": 1.2},
                        flierprops={"markersize": 3, "alpha": 0.5})

        for patch, color in zip(bp["boxes"], plot_colors):
            patch.set_facecolor(color)
            patch.set_alpha(0.6)

        ax.set_xticklabels(plot_labels, rotation=30, ha="right", fontsize=7)
        if i == 0:
            ax.set_ylabel("Convergence time (ms)")
        ax.annotate(f"{bots} bots", xy=(0.5, 1.06), xycoords="axes fraction", ha="center", fontsize=9, fontweight="bold")

    fig.subplots_adjust(wspace=0.1)
    save(fig, "fig07_convergence_boxplot.pdf")


# ── Main ─────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    df = load_data()

    print(f"Loaded {len(df)} records from CSV")
    print(f"Generating graphs to {OUTPUT_DIR}/\n")

    fig01_convergence_by_protocol(df)
    fig02_convergence_by_strategy(df)
    fig03_network_overhead(df)
    fig04_memory_usage(df)
    fig05_metadata_ratio(df)
    fig06_latency_impact(df)
    fig07_convergence_boxplot(df)

    print(f"\nDone. {len(os.listdir(OUTPUT_DIR))} files generated.")


if __name__ == "__main__":
    main()
