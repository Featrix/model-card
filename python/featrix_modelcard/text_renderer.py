#!/usr/bin/env python3
"""
Plain text renderer for Featrix Model Card JSON.

Provides both brief and detailed versions matching the current JSON schema
(model_identification, embedding_space, best_epochs, class_imbalance,
training_optimization, training_dataset, disk_usage).
"""

import json
import re
from typing import Any, Dict, Optional


def format_value(value: Any, precision: int = 4) -> str:
    """Format a value for display."""
    if value is None:
        return "N/A"
    if isinstance(value, float):
        return f"{value:.{precision}f}".rstrip("0").rstrip(".")
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (list, dict)):
        return json.dumps(value, indent=2)
    return str(value)


def format_pct(value: Optional[float]) -> str:
    """Format a 0-1 float as a percentage (for accuracy only)."""
    if value is None:
        return "N/A"
    return f"{value * 100:.1f}%"


def format_metric(value: Optional[float]) -> str:
    """Format a 0-1 float as a raw decimal (for AUC, F1, precision, recall, etc.)."""
    if value is None:
        return "N/A"
    return f"{value:.4f}"


def format_large_number(value) -> str:
    """Format large numbers (e.g. 264925317 -> 265.0M)."""
    if value is None:
        return "N/A"
    if value >= 1_000_000_000:
        return f"{value / 1_000_000_000:.1f}B"
    if value >= 1_000_000:
        return f"{value / 1_000_000:.1f}M"
    if value >= 1_000:
        return f"{value / 1_000:.1f}K"
    return f"{value:,}"


_PREDICTOR_KIND_RE = re.compile(r"^Foundation\s*\+\s*(.+)", re.IGNORECASE)

# Covers every real target_col_type, not just set/scalar — see targets/registry.py
# CANONICAL_INPUT_TYPES in taco-fixes.
_TASK_LABELS_BY_TARGET_TYPE = {
    "scalar": "Regression",
    "ordinal": "Ordinal Classifier",
    "multi_label": "Multi-Label Classifier",
    "ranking": "Ranking Model",
    "free_string": "Free-Text Predictor",
}


def _map_model_type(mi: dict, is_multiclass_fallback: bool = False) -> str:
    """Map model_type + target_column_type to display string.

    Keyed off target_column_type (authoritative — present whenever there's a target,
    regardless of exact model_type wording), not on model_type matching a literal "Single
    Predictor"/"SP" string: production cards say things like "Foundation + Neural Predictor" /
    "Foundation + Nearest-Neighbor Predictor", which used to fall straight through to the
    raw-string fallback and lose the task-type classification entirely.

    'set' covers both binary and multiclass targets — num_classes/class_labels (once the
    backend emits them) decide which; until then, is_multiclass_fallback (derived from
    whether the best_epochs data itself looks multiclass) is used instead.
    """
    model_type = mi.get("model_type", "")
    target_type = (mi.get("target_column_type") or "").lower()
    mt = model_type.lower()

    if not target_type and mt in ("embedding space", "es", "foundation"):
        return "Foundational Embedding Space"
    if target_type == "set" or target_type in _TASK_LABELS_BY_TARGET_TYPE:
        # Which predictor head was actually selected (Neural/Linear/XGBoost/Nearest-
        # Neighbor/...) is real, useful info — surface it alongside the task type, not instead
        # of it. Extract "everything after Foundation + " rather than matching a hardcoded
        # list of kind names, so a new predictor kind on the backend doesn't need a matching
        # renderer update to show up correctly.
        predictor_match = _PREDICTOR_KIND_RE.match(model_type)
        predictor_kind = predictor_match.group(1).strip() if predictor_match else None
        if target_type == "set":
            num_classes = mi.get("num_classes") or (len(mi["class_labels"]) if mi.get("class_labels") else None)
            is_multiclass = num_classes > 2 if num_classes is not None else is_multiclass_fallback
            task_label = "Multiclass Classifier" if is_multiclass else "Binary Classifier"
        else:
            task_label = _TASK_LABELS_BY_TARGET_TYPE[target_type]
        return f"{predictor_kind} • {task_label}" if predictor_kind else task_label
    return model_type or "N/A"


def _parse_model_path(path: Optional[str]) -> tuple:
    """Extract session ID and job ID from best_model_path."""
    if not path:
        return None, None
    parts = path.split("/")
    session_id = None
    job_id = None
    for part in parts:
        if part.startswith("predictor-"):
            session_id = part[: len(part) - 37] if len(part) > 37 else part
        if part.startswith("train_single_predictor_") or part.startswith("train_"):
            job_id = part
    return session_id, job_id


# ---------------------------------------------------------------------------
# Brief renderer
# ---------------------------------------------------------------------------


def render_brief_text(data: Dict[str, Any]) -> str:
    """Render a compact one-screen summary of the model card."""
    mi = data.get("model_identification", {})
    be = data.get("best_epochs", {})
    ci = data.get("class_imbalance") or {}
    es = data.get("embedding_space", {})

    # Best metrics — prefer best_roc_auc/best_pr_auc if present (binary cards); otherwise fall
    # back to whichever best_epochs entry matches the checkpoint metric (multiclass cards).
    # num_classes/class_labels (once the backend emits them) is the authoritative multiclass
    # signal — a multiclass target still gets a real "auc" (macro one-vs-rest), so "both
    # roc_auc and pr_auc are None" is NOT reliable by itself; it's only the fallback for old
    # cards that predate num_classes.
    roc_auc = _get_metric_value(be, "best_roc_auc", "auc")
    pr_auc = _get_metric_value(be, "best_pr_auc", "pr_auc")
    f1 = _get_metric_value(be, "best_roc_auc", "f1")
    acc = _get_metric_value(be, "best_roc_auc", "accuracy")
    r2 = _get_regression_metric_value(be, "best_r2", "r2")
    rmse = _get_regression_metric_value(be, "best_r2", "rmse")
    checkpoint_metric = ((data.get("training_optimization") or {}).get("checkpoint_metric"))
    num_classes = mi.get("num_classes") or (len(mi["class_labels"]) if mi.get("class_labels") else None)
    is_regression = r2 is not None or rmse is not None
    want_multiclass = not is_regression and (num_classes > 2 if num_classes is not None else (roc_auc is None and pr_auc is None))
    multiclass_key = _resolve_multiclass_epoch_key(be, checkpoint_metric) if want_multiclass else None

    model_name = mi.get("name", "Model Card")
    model_type = _map_model_type(mi, is_multiclass_fallback=multiclass_key is not None)
    status = (mi.get("status") or "N/A").upper()
    if status == "DONE":
        status = "READY"

    lines = [
        f"MODEL CARD: {model_name}",
        "=" * 60,
        "",
        f"Target:     {mi.get('target_column', 'N/A')}",
        f"Type:       {model_type}",
        f"Status:     {status}",
        f"Trained:    {mi.get('training_date', 'N/A')}",
    ]

    lines.append("")
    if is_regression:
        skill = _get_regression_skill(be, "best_r2")
        line = f"R²: {format_metric(r2)}  RMSE: {format_metric(rmse)}"
        if skill and skill.get("text"):
            line += f"  ({skill['text']})"
        lines.append(line)
    elif multiclass_key:
        acc = _get_metric_value(be, multiclass_key, "accuracy")
        if checkpoint_metric and checkpoint_metric != "accuracy" and _get_metric_value(be, multiclass_key, checkpoint_metric) is not None:
            headline_key = checkpoint_metric
        else:
            headline_key = next(
                (k for k in ("macro_f1", "weighted_f1", "cross_entropy", "log_loss", "macro_auc_ovr")
                 if _get_metric_value(be, multiclass_key, k) is not None),
                None,
            )
        headline_val = _get_metric_value(be, multiclass_key, headline_key) if headline_key else None
        lines.append(
            f"Accuracy: {format_pct(acc)}  "
            f"{_format_metric_name(headline_key)}: {format_metric(headline_val)}"
        )
    elif want_multiclass:
        lines.append(f"Accuracy: {format_pct(acc)}")
    else:
        lines.append(
            f"Accuracy: {format_pct(acc)}  "
            f"AUC: {format_metric(roc_auc)}  "
            f"PR-AUC: {format_metric(pr_auc)}  "
            f"F1: {format_metric(f1)}"
        )

    # Class imbalance summary
    if ci.get("total_samples"):
        if ci.get("imbalance_ratio") is not None:
            lines.append(f"Samples: {ci['total_samples']:,}  Imbalance: {ci['imbalance_ratio']}:1")
        elif isinstance(ci.get("class_distribution"), list):
            lines.append(f"Samples: {ci['total_samples']:,}  Classes: {len(ci['class_distribution'])}")
        else:
            lines.append(f"Samples: {ci['total_samples']:,}")

    # Model stack summary
    if es:
        lines.append(
            f"Foundation: {format_large_number(es.get('num_parameters'))} params, "
            f"d_model={es.get('d_model', 'N/A')}"
        )

    # Selective prediction summary
    sp_summary = (data.get("coverage") or data.get("selective_prediction") or {}).get("summary")
    if sp_summary and sp_summary.get("demur_error_capture") is not None:
        dec = sp_summary["demur_error_capture"]
        baseline = sp_summary.get("demur_random_baseline", 0.0)
        coverage_pct = (sp_summary.get("coverage") or 0.0) * 100
        lines.append(
            f"Selective: demur_capture={dec:.4f} (vs {baseline:.2f} random), "
            f"covered_auc={sp_summary.get('covered_auc', 0.0):.4f}, coverage={coverage_pct:.1f}%"
        )

    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Detailed renderer
# ---------------------------------------------------------------------------


def render_detailed_text(data: Dict[str, Any]) -> str:
    """Render a full detailed text model card."""
    sections = [
        _render_model_identification(data),
        _render_model_fit(data),
        _render_model_stack(data),
        _render_best_epochs(data),
        _render_selective_prediction(data),
        _render_training_optimization(data),
        _render_training_dataset(data),
        _render_data_processing_notes(data),
    ]
    return "\n".join(s for s in sections if s)


def _render_model_identification(data: dict) -> str:
    mi = data.get("model_identification", {})
    du = data.get("disk_usage", {})
    es = data.get("embedding_space", {})
    be = data.get("best_epochs", {})
    ci = data.get("class_imbalance") or {}

    model_name = mi.get("name", "Model Card")
    status = (mi.get("status") or "N/A").upper()
    if status == "DONE":
        status = "READY"

    session_id, job_id = _parse_model_path(du.get("best_model_path"))
    model_id = session_id or (mi.get("session_id", "N/A")[:20] if mi.get("session_id") else "N/A")

    framework = mi.get("framework", "N/A")
    framework = re.sub(r"\s+unknown$", "", framework, flags=re.IGNORECASE).strip() or "N/A"

    # Best metrics — regression targets (best_r2) get R²/RMSE instead of ROC/PR-AUC,
    # which are classification-only and always N/A for a regression target.
    roc_auc = _get_metric_value(be, "best_roc_auc", "auc")
    pr_auc = _get_metric_value(be, "best_pr_auc", "pr_auc")
    r2 = _get_regression_metric_value(be, "best_r2", "r2")
    rmse = _get_regression_metric_value(be, "best_r2", "rmse")
    r2_skill = _get_regression_skill(be, "best_r2")
    is_regression = r2 is not None or rmse is not None

    # Multiclass hero metrics. num_classes/class_labels (once the backend emits them) is the
    # authoritative multiclass signal — a multiclass target still gets a real "auc" (macro
    # one-vs-rest), so "both roc_auc and pr_auc are None" is NOT reliable by itself; it's only
    # the fallback for old cards that predate num_classes. See _resolve_multiclass_epoch_key
    # for why best_roc_auc is still a fair epoch source (its classification_metrics carries
    # accuracy/macro_f1 too, not just auc).
    checkpoint_metric = ((data.get("training_optimization") or {}).get("checkpoint_metric"))
    num_classes = mi.get("num_classes") or (len(mi["class_labels"]) if mi.get("class_labels") else None)
    is_multiclass = False
    mc_accuracy = None
    mc_headline_key = None
    mc_headline_val = None
    want_multiclass = not is_regression and (num_classes > 2 if num_classes is not None else (roc_auc is None and pr_auc is None))
    if want_multiclass:
        mc_epoch_key = _resolve_multiclass_epoch_key(be, checkpoint_metric)
        if mc_epoch_key:
            mc_accuracy = _get_metric_value(be, mc_epoch_key, "accuracy")
            if checkpoint_metric and checkpoint_metric != "accuracy" and _get_metric_value(be, mc_epoch_key, checkpoint_metric) is not None:
                mc_headline_key = checkpoint_metric
            else:
                mc_headline_key = next(
                    (k for k in ("macro_f1", "weighted_f1", "cross_entropy", "log_loss", "macro_auc_ovr")
                     if _get_metric_value(be, mc_epoch_key, k) is not None),
                    None,
                )
            mc_headline_val = _get_metric_value(be, mc_epoch_key, mc_headline_key) if mc_headline_key else None
            is_multiclass = mc_accuracy is not None or mc_headline_val is not None

    model_type = _map_model_type(mi, is_multiclass_fallback=is_multiclass)

    # PR-AUC lift
    prevalence = None
    if ci.get("minority_class_count") and ci.get("total_samples"):
        prevalence = ci["minority_class_count"] / ci["total_samples"]
    pr_auc_lift = (pr_auc / prevalence) if (pr_auc and prevalence) else None

    ui = mi.get("user_intent")
    encoding_intent = mi.get("encoding_intent")

    lines = [
        f"MODEL CARD: {model_name}",
        "=" * 80,
        "",
        "MODEL IDENTIFICATION",
        "-" * 60,
    ]

    if ui:
        objective_display = ui.get("objective", "").replace("_", " ").title()
        source_display = (ui.get("source") or "").replace("_", " ")
        lines.append(f"  Objective:      {objective_display}  ({ui.get('task', 'N/A')})"
                     + (f"  [{source_display}]" if source_display else ""))

    lines += [
        f"  Target Column:  {mi.get('target_column', 'N/A')}",
        f"  Model Type:     {model_type}",
    ]
    if is_regression:
        lines.append(f"  Best R²:        {format_metric(r2)}")
        lines.append(f"  Best RMSE:      {format_metric(rmse)}"
                     + (f"  [{r2_skill['text']}]" if r2_skill and r2_skill.get("text") else ""))
    elif is_multiclass:
        lines.append(f"  {'Best Accuracy:':16s}{format_pct(mc_accuracy)}")
        lines.append(f"  {('Best ' + _format_metric_name(mc_headline_key) + ':'):16s}{format_metric(mc_headline_val)}")
    else:
        lines.append(f"  Best ROC-AUC:   {format_metric(roc_auc)}")
        lines.append(f"  Best PR-AUC:    {format_metric(pr_auc)}"
                     + (f"  [{pr_auc_lift:.1f}x lift]" if pr_auc_lift else ""))
    lines += [
        "",
        f"  Status:         {status}",
        f"  Training Date:  {mi.get('training_date', 'N/A')}",
        f"  Model ID:       {model_id}",
        f"  Cluster:        {(mi.get('compute_cluster') or 'N/A').upper()}",
        f"  Dims:           {es.get('d_model', 'N/A')}",
        f"  Framework:      {framework}",
    ]

    if encoding_intent:
        lines.append(f"  Encoding:       {encoding_intent}")

    lines.append("")
    return "\n".join(lines)


def _render_model_stack(data: dict) -> str:
    es = data.get("embedding_space")
    if not es:
        return ""

    sp = data.get("single_predictor") or data.get("predictor") or {}
    ma = data.get("model_architecture") or {}
    ms = (data.get("model_stack") or [{}])[0] if data.get("model_stack") else {}
    ci = data.get("class_imbalance") or {}

    sp_rows = ci.get("total_samples") or ms.get("rows") or sp.get("num_rows", 0)
    sp_layers = ms.get("layers") or ma.get("predictor_layers") or sp.get("num_layers", 0)
    sp_params = ms.get("parameters") or ma.get("predictor_parameters") or sp.get("num_parameters", 0)

    lines = [
        "MODEL STACK",
        "-" * 60,
        f"  {'':18s} {'Labeled':>8s} {'Rows':>10s} {'Layers':>10s} {'Parameters':>12s}",
        f"  {'Predictor':18s} {'Yes':>8s} {sp_rows:>10,} {format_large_number(sp_layers):>10s} {format_large_number(sp_params):>12s}",
        f"  {'Foundation':18s} {'No':>8s} {es.get('num_rows', 0):>10,} {format_large_number(es.get('num_layers')):>10s} {format_large_number(es.get('num_parameters')):>12s}",
        "",
    ]
    return "\n".join(lines)


_EPOCH_METRIC_LABELS = {
    "roc_auc": "ROC-AUC", "pr_auc": "PR-AUC", "macro_f1": "Macro-F1", "weighted_f1": "Weighted-F1",
    "macro_auc_ovr": "Macro-AUC (OvR)", "log_loss": "Log-Loss", "cross_entropy": "Cross-Entropy",
    "accuracy": "Accuracy", "f1": "F1", "r2": "R²",
}
_EPOCH_ORDER_PREFERENCE = ["best_pr_auc", "best_roc_auc"]

_REGRESSION_METRIC_ORDER = ["r2", "nrmse", "rmse", "mae", "spearman", "smape", "median_ae", "max_error"]
_REGRESSION_METRIC_LABELS = {
    "r2": "R²", "nrmse": "NRMSE", "rmse": "RMSE", "mae": "MAE",
    "spearman": "Spearman", "smape": "sMAPE", "median_ae": "Median AE", "max_error": "Max Error",
}


def _format_metric_name(key: Optional[str]) -> str:
    if not key:
        return ""
    return _EPOCH_METRIC_LABELS.get(key, key.replace("_", " ").title())


def _render_matrix_ascii(labels: list, matrix: list) -> list:
    """N×N confusion matrix as ASCII — shared by the main confusion matrix and (in the
    selective prediction section) the declined-rows breakdown."""
    row_label_w = 16
    col_w = max(6, max(len(l) for l in labels) + 2)
    lines = ["", "    Confusion Matrix (rows=actual, cols=predicted):"]
    lines.append("      " + "Actual\\Pred".ljust(row_label_w) + "".join(f"{l:>{col_w}}" for l in labels))
    for i, row_label in enumerate(labels):
        row = (matrix[i] if i < len(matrix) else []) or []
        cells = "".join(f"{(row[j] if j < len(row) else 0):>{col_w}}" for j in range(len(labels)))
        lines.append("      " + row_label.ljust(row_label_w) + cells)
    return lines


def _render_per_class_metrics_ascii(metrics: dict) -> list:
    per_class = metrics.get("per_class")
    if not per_class:
        return []
    lines = ["", "    Per-Class Metrics:"]
    lines.append(f"      {'Class':<20} {'Precision':>10} {'Recall':>8} {'F1':>8} {'Support':>10}")
    for c in per_class:
        name = f"{c['label']} - {c['display_name']}" if c.get("display_name") else c.get("label", "")
        lines.append(
            f"      {name:<20} {c.get('precision', 0):>10.3f} {c.get('recall', 0):>8.3f} "
            f"{c.get('f1', 0):>8.3f} {c.get('support', 0):>10,}"
        )
    avg = metrics.get("averaging") or {}
    support = avg.get("support")
    support_str = f"{support:,}" if support is not None else "N/A"
    if avg.get("macro"):
        m = avg["macro"]
        lines.append(f"      {'Macro avg':<20} {m.get('precision', 0):>10.3f} {m.get('recall', 0):>8.3f} {m.get('f1', 0):>8.3f} {support_str:>10}")
    if avg.get("weighted"):
        w = avg["weighted"]
        lines.append(f"      {'Weighted avg':<20} {w.get('precision', 0):>10.3f} {w.get('recall', 0):>8.3f} {w.get('f1', 0):>8.3f} {support_str:>10}")
    return lines


def _render_best_epochs(data: dict) -> str:
    be = data.get("best_epochs")
    if not be:
        return ""

    epoch_keys = [k for k, v in be.items() if not k.startswith("_") and v]
    if not epoch_keys:
        return ""

    def _sort_key(k):
        try:
            return (0, _EPOCH_ORDER_PREFERENCE.index(k))
        except ValueError:
            return (1, epoch_keys.index(k))

    epoch_keys = sorted(epoch_keys, key=_sort_key)

    to = data.get("training_optimization") or {}
    checkpoint_metric = to.get("checkpoint_metric")

    lines = [
        "MODEL DETAILS",
        "-" * 60,
    ]
    if checkpoint_metric:
        lines.append(f"  Optimized for: {_format_metric_name(checkpoint_metric).upper()}")

    for key in epoch_keys:
        epoch_data = be.get(key)
        if not epoch_data:
            continue

        label = "Best " + _format_metric_name(key[len("best_"):] if key.startswith("best_") else key)

        # Regression (scalar target): R²/RMSE/MAE table + skill verdict — no confusion
        # matrix, no per-row correct/wrong (that tracking is classification-only today).
        rdm = epoch_data.get("regression_display_metadata")
        if rdm:
            epoch_num = epoch_data.get("epoch") or rdm.get("epoch", "N/A")
            reg_metrics = rdm.get("regression_metrics") or {}
            lines.append(f"\n  {label} -- Epoch {epoch_num}")
            lines.append(f"  {'~' * 40}")
            for mkey in _REGRESSION_METRIC_ORDER:
                m = reg_metrics.get(mkey)
                if not m or not isinstance(m.get("value"), (int, float)):
                    continue
                val = f"{m['value']:.2f}%" if mkey == "smape" else format_metric(m["value"])
                quality = f"  [{m['quality']}]" if m.get("quality") else ""
                mlabel = _REGRESSION_METRIC_LABELS.get(mkey, mkey).upper()
                lines.append(f"    {mlabel:16s} {val}{quality}")
            skill = rdm.get("skill")
            if skill and skill.get("text"):
                lines.append(f"\n    {skill['text']}")
            lines.append("")
            continue

        cdm = epoch_data.get("classification_display_metadata") or {}
        epoch_num = epoch_data.get("epoch") or cdm.get("epoch", "N/A")
        metrics = cdm.get("classification_metrics") or {}

        lines.append(f"\n  {label} -- Epoch {epoch_num}")
        lines.append(f"  {'~' * 40}")

        # Metrics table
        for mkey in ["accuracy", "auc", "pr_auc", "f1", "macro_f1", "weighted_f1", "macro_auc_ovr", "log_loss"]:
            m = metrics.get(mkey)
            if not m:
                continue
            val = format_pct(m.get("value")) if mkey == "accuracy" else format_metric(m.get("value"))
            mlabel = _EPOCH_METRIC_LABELS.get(mkey, mkey.replace("_", " ")).upper()
            lines.append(f"    {mlabel:16s} {val}")

        # Confusion matrix — N×N when the backend supplies one, else the legacy binary 2×2
        cm = cdm.get("confusion_matrix")
        if cm and isinstance(cm.get("matrix"), list) and cm.get("class_labels"):
            lines.extend(_render_matrix_ascii(cm["class_labels"], cm["matrix"]))
            lines.extend(_render_per_class_metrics_ascii(metrics))
        elif cm:
            tp, fn, fp, tn = cm.get("tp", 0), cm.get("fn", 0), cm.get("fp", 0), cm.get("tn", 0)
            total_pos = tp + fn
            total_neg = tn + fp

            lines.append("")
            lines.append("    Confusion Matrix:")
            lines.append(f"                  Pred Pos   Pred Neg")
            lines.append(f"      Actual Pos    {tp:>5d}      {fn:>5d}")
            lines.append(f"      Actual Neg    {fp:>5d}      {tn:>5d}")

            # Derived metrics
            hit_rate = tp / total_pos if total_pos > 0 else 0
            miss_rate = fn / total_pos if total_pos > 0 else 0
            specificity = tn / total_neg if total_neg > 0 else 0
            fpr = fp / total_neg if total_neg > 0 else 0
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0

            lines.append("")
            lines.append(f"    Hit Rate (Recall):  {hit_rate:.4f}   TP/(TP+FN)")
            lines.append(f"    Miss Rate:          {miss_rate:.4f}   FN/(TP+FN)")
            lines.append(f"    Specificity (TNR):  {specificity:.4f}   TN/(TN+FP)")
            lines.append(f"    False Alarm (FPR):  {fpr:.4f}   FP/(TN+FP)")
            lines.append(f"    Precision (PPV):    {precision:.4f}   TP/(TP+FP)")

        lines.append("")

    return "\n".join(lines)


def _render_training_optimization(data: dict) -> str:
    to = data.get("training_optimization")
    if not to:
        return ""

    lines = [
        "TRAINING OPTIMIZATION",
        "-" * 60,
    ]

    if to.get("optimization_description"):
        lines.append(f"  Strategy: {to['optimization_description']}")
        lines.append("")

    lines.append(f"  Loss Function:         {to.get('loss_function', 'N/A')}")
    lines.append(f"  Optimization Priority: {(to.get('optimization_priority') or 'N/A').capitalize()}")

    checkpoint = to.get("checkpoint_metric", "")
    if checkpoint and checkpoint.lower() != "none":
        lines.append(f"  Checkpoint Metric:     {checkpoint.upper().replace('_', '-')}")
    else:
        lines.append(f"  Checkpoint Metric:     Default")

    if to.get("focal_gamma") is not None or to.get("focal_alpha") is not None:
        lines.append(f"  Focal Loss:            gamma={to.get('focal_gamma', 'N/A')}, alpha={to.get('focal_alpha', 'N/A')}")

    if to.get("class_weights"):
        lines.append(f"  Class Weights:         [{', '.join(str(w) for w in to['class_weights'])}]")

    cs = to.get("cost_sensitive")
    if cs:
        lines.append(f"  Cost-Sensitive:        FP={cs.get('cost_false_positive', 1.0)}, FN={cs.get('cost_false_negative', 1.0)}")

    if to.get("adaptive_loss") is not None:
        adj = f" ({to['gamma_adjustments']} adjustments)" if to.get("gamma_adjustments") else ""
        lines.append(f"  Adaptive Loss:         {'Yes' if to['adaptive_loss'] else 'No'}{adj}")

    if to.get("checkpoint_value") is not None:
        lines.append(f"  Best Checkpoint:       {to['checkpoint_value']:.4f} at epoch {to.get('checkpoint_epoch', 'N/A')}")

    if to.get("positive_class") is not None:
        lines.append(f"  Positive Class:        \"{to['positive_class']}\"")

    lines.append("")
    return "\n".join(lines)


def _render_training_dataset(data: dict) -> str:
    ci = data.get("class_imbalance") or {}
    td = data.get("training_dataset") or {}

    if not ci and not td:
        return ""

    lines = [
        "TRAINING DATASET",
        "-" * 60,
    ]

    # Base row/feature counts -- always present (ES, SP, regression, multiclass alike),
    # unlike the class-imbalance breakdown below, which only exists for classification SP
    # cards. A regression or Embedding Space card has no class_imbalance at all, so without
    # this the section fell back to a bare "Training rows: N" line even though
    # val_rows/total_rows/total_features were sitting right there in training_dataset.
    if td.get("total_rows") is not None:
        lines.append(f"  {'Total Rows':14s} {td.get('total_rows', 0):>10,}")
        lines.append(f"  {'Train Rows':14s} {td.get('train_rows', 0):>10,}")
        lines.append(f"  {'Val Rows':14s} {td.get('val_rows', 0):>10,}")
        features = td.get("total_features")
        lines.append(f"  {'Features':14s} {features if features is not None else 'N/A':>10}")
        lines.append("")
        for note in td.get("validation_notes") or []:
            lines.append(f"  - {note}")
        if td.get("validation_notes"):
            lines.append("")

    class_distribution = ci.get("class_distribution")
    if isinstance(class_distribution, list) and class_distribution:
        # N-class distribution table — one column per class, driven by class_distribution
        # rather than assuming exactly two (minority/majority). Array shape only: some existing
        # cards send class_distribution as a legacy {label: count} dict, handled below unchanged.
        train_dist = ci.get("train_distribution") or {}
        val_dist = ci.get("val_distribution") or {}
        col_w = max(10, max(len(c.get("label", "")) for c in class_distribution) + 2)

        header = "  " + "".ljust(12) + "".join(f"{c['label']:>{col_w}}" for c in class_distribution) + f"{'Total':>10}"
        lines.append(header)

        total_train = total_val = total_all = 0
        train_cells = ""
        val_cells = ""
        total_cells = ""
        for c in class_distribution:
            tv = train_dist.get(c["label"], 0)
            vv = val_dist.get(c["label"], 0)
            av = c.get("count", tv + vv)
            total_train += tv
            total_val += vv
            total_all += av
            train_cells += f"{tv:>{col_w},}"
            val_cells += f"{vv:>{col_w},}"
            total_cells += f"{av:>{col_w},}"

        lines.append(f"  {'Train':12s}{train_cells}{total_train:>10,}")
        lines.append(f"  {'Validation':12s}{val_cells}{total_val:>10,}")
        lines.append(f"  {'Total':12s}{total_cells}{total_all:>10,}")
        lines.append("")

        if all(c.get("pct") is not None for c in class_distribution):
            min_c = min(class_distribution, key=lambda c: c["pct"])
            max_c = max(class_distribution, key=lambda c: c["pct"])
            lines.append(
                f"  Class balance: {min_c['label']} is {min_c['pct']:.1f}% of data, "
                f"{max_c['label']} is {max_c['pct']:.1f}%"
            )
    elif ci.get("train_distribution") or ci.get("class_distribution") or ci.get("minority_class") or ci.get("majority_class"):
        # Legacy binary distribution table (also covers the legacy dict-shaped class_distribution).
        minority = ci.get("minority_class", "1")
        majority = ci.get("majority_class", "0")
        train0 = (ci.get("train_distribution") or {}).get(majority, (ci.get("train_distribution") or {}).get("0", 0))
        train1 = (ci.get("train_distribution") or {}).get(minority, (ci.get("train_distribution") or {}).get("1", 0))
        val0 = (ci.get("val_distribution") or {}).get(majority, (ci.get("val_distribution") or {}).get("0", 0))
        val1 = (ci.get("val_distribution") or {}).get(minority, (ci.get("val_distribution") or {}).get("1", 0))
        total_train = train0 + train1
        total_val = val0 + val1
        total = ci.get("total_samples") or td.get("train_rows") or (total_train + total_val)

        lines.append(f"  {'':12s} Class \"{minority}\"  Class \"{majority}\"  Total")
        lines.append(f"  {'Train':12s} {train1:>10,}  {train0:>12,}  {total_train:>8,}")
        lines.append(f"  {'Validation':12s} {val1:>10,}  {val0:>12,}  {total_val:>8,}")
        lines.append(f"  {'Total':12s} {ci.get('minority_class_count', train1 + val1):>10,}  {ci.get('majority_class_count', train0 + val0):>12,}  {total:>8,}")
        lines.append("")

        if ci.get("imbalance_ratio"):
            minority_pct = (ci.get("minority_class_count", 0) / total * 100) if total else 0
            lines.append(f"  Imbalance ratio: {ci['imbalance_ratio']}:1 (minority is {minority_pct:.1f}% of data)")
    elif td.get("train_rows") and td.get("total_rows") is None:
        # Old cards with train_rows but no total_rows -- the block above already covers
        # anything with total_rows, this is just the pre-total_rows fallback.
        lines.append(f"  Training rows: {td['train_rows']:,}")

    lines.append("")
    return "\n".join(lines)


_INTENT_DISPLAY = {
    "balanced": "Balanced (default)",
    "only_alert_when_confident": "Only alert when confident",
    "catch_everything": "Catch everything",
    "minimize_cost": "Minimize expected cost",
    "rank": "Ranking — no operating point",
    "predict_probabilities": "Calibrated probabilities — no operating point",
}

# Strategies are rendered from whatever keys are actually present under sp["strategies"] — not a
# fixed set — so per-class strategies (detect_class_P0, ...) show up automatically. Legacy key
# names get their historical labels and order; anything else falls back to entry["label"] (if the
# backend supplied one) or a humanized version of the key.
_LEGACY_STRATEGY_LABELS = {
    "everything": "Always answer", "best_always_answers": "Always answer",
    "only_when_sure": "Balanced demur", "best_balanced_may_demur": "Balanced demur",
    "only_on_strong_positives": "Detect positives", "best_detects_positives_may_demur": "Detect positives",
    "only_on_strong_negatives": "Rule out negatives", "best_rules_out_negatives_may_demur": "Rule out negatives",
}
_LEGACY_STRATEGY_ORDER = [
    "everything", "best_always_answers",
    "only_when_sure", "best_balanced_may_demur",
    "only_on_strong_positives", "best_detects_positives_may_demur",
    "only_on_strong_negatives", "best_rules_out_negatives_may_demur",
]


def _pick_primary_metric(entry: dict) -> tuple:
    """Returns (label, covered, full, lift) — AUC for legacy binary entries, Macro-F1 or
    per-class recall for the corresponding multiclass strategy shapes."""
    if entry.get("target_class") and entry.get("covered_recall_target_class") is not None:
        return (f"Recall ({entry['target_class']})", entry.get("covered_recall_target_class"),
                entry.get("full_recall_target_class"), None)
    if entry.get("covered_macro_f1") is not None or entry.get("full_macro_f1") is not None:
        return ("Macro-F1", entry.get("covered_macro_f1"), entry.get("full_macro_f1"), entry.get("macro_f1_lift"))
    return ("AUC", entry.get("covered_auc"), entry.get("full_auc"), entry.get("auc_lift"))


def _render_selective_prediction(data: dict) -> str:
    sp = data.get("coverage") or data.get("selective_prediction")
    if not sp:
        return ""

    def _demur_badge(value: Optional[float], baseline: float) -> str:
        if value is None:
            return "N/A — answers everything"
        if value == 1.0:
            return "PERFECT ✓"
        if value > baseline + 0.05:
            return "BETTER THAN RANDOM"
        if abs(value - baseline) <= 0.05:
            return "≈ RANDOM"
        return "ANTI-ALIGNED ⚠"

    def _fmt_auc(v: Optional[float]) -> str:
        return f"{v:.4f}" if v is not None else "—"

    def _fmt_pct(v: Optional[float]) -> str:
        return f"{v * 100:.1f}%" if v is not None else "—"

    def _render_entry(label: str, entry: dict) -> list[str]:
        if entry.get("coverage") is None:
            return []

        dec = entry.get("demur_error_capture")
        baseline = entry.get("demur_random_baseline") or 0.0
        coverage = entry.get("coverage") or 0.0
        n_covered = entry.get("n_covered", 0)
        n_total = entry.get("n_total", 0)
        n_demurred = entry.get("n_demurred", 0)
        threshold = entry.get("confidence_threshold")
        tp = entry.get("n_demurred_true_positives", 0)
        fp = entry.get("n_demurred_false_positives", 0)
        fn = entry.get("n_demurred_false_negatives", 0)
        tn = entry.get("n_demurred_true_negatives", 0)
        intent = entry.get("intent")
        source = entry.get("source")
        cal = entry.get("calibration_method")
        declined_matrix = entry.get("declined_matrix")

        intent_label = _INTENT_DISPLAY.get(intent or "", "") or (
            intent.replace("_", " ").title() if intent else "Balanced (default)"
        )
        is_noop = intent in ("rank", "predict_probabilities")
        # is_always_answers is really "did this strategy decline anything" — n_demurred is the
        # ground truth for that. demur_error_capture is a binary-only headline metric on top;
        # its absence (e.g. per-class "detect X" strategies) doesn't mean nothing was declined.
        is_always_answers = n_demurred == 0
        has_demur_badge = dec is not None
        badge = _demur_badge(dec if has_demur_badge else None, baseline) if (is_always_answers or has_demur_badge) else None
        label_m, covered, full, lift = _pick_primary_metric(entry)

        out = [f"\n  {label}"]
        out.append(f"  {'~' * 40}")
        out.append(f"    Optimized for: {intent_label}" + (
            f"  [{source.replace('_', ' ')}{' · ' + cal if cal else ''}]" if source else ""
        ))

        # Intent feasibility banner
        contract_intents = {"only_alert_when_confident", "catch_everything", "catch_everything_aggressive"}
        intent_feasible = entry.get("intent_feasible")
        feasibility_reason = entry.get("intent_feasibility_reason")
        if intent_feasible is False and intent in contract_intents:
            out.append(f"    ⚠ OPERATING POINT FELL BACK TO MAX-AUC")
            out.append(f"    This model was trained with intent={intent}, but no operating point")
            out.append(f"    could meet the requested floor. The highest-AUC fallback was returned.")
            out.append(f"    Deploying will not deliver the requested floor.")
            if feasibility_reason:
                out.append(f"    {feasibility_reason}")
            out.append("")

        if source == "per_epoch":
            out.append("    ⚠ Operating point computed on uncalibrated probabilities")

        if is_noop:
            out.append("    Scoring model — use raw predict_proba() output, no operating point")
            return out

        if is_always_answers:
            out.append(f"    Demur Error Capture: {badge}")
        elif has_demur_badge:
            out.append(f"    Demur Error Capture: {dec:.4f}  [{badge}]  (vs {baseline:.2f} random)")
        elif lift is not None:
            out.append(f"    {label_m} lift vs full: {'+' if lift >= 0 else ''}{lift:.4f}")

        lift_str = (f"{'+' if lift >= 0 else ''}{lift:.4f}") if lift is not None else "—"
        thresh_str = f"{threshold:.2f}" if threshold is not None else "—"
        extra_metric = ""
        if intent == "only_alert_when_confident" and entry.get("covered_precision") is not None:
            extra_metric = f"   Covered Precision: {entry['covered_precision']:.4f}"
        elif intent in ("catch_everything", "catch_everything_aggressive") and entry.get("covered_recall") is not None:
            extra_metric = f"   Covered Recall: {entry['covered_recall']:.4f}"
        out.append(
            f"    Covered {label_m}: {_fmt_auc(covered)}{extra_metric}   "
            f"Full {label_m}: {_fmt_auc(full)}   "
            f"{label_m} Lift: {lift_str}   "
            f"Coverage: {_fmt_pct(coverage)}   Threshold: {thresh_str}"
        )
        if entry.get("confidence_threshold_basis") == "max_softmax_probability":
            out.append("    (Threshold is on max predicted-class probability — top-1 confidence)")

        if not is_always_answers and declined_matrix and declined_matrix.get("class_labels") and declined_matrix.get("matrix"):
            out.append("")
            out.append("    Declined rows — what they would have been:")
            out.extend("    " + l if l else l for l in _render_matrix_ascii(declined_matrix["class_labels"], declined_matrix["matrix"]))
        elif not is_always_answers and n_demurred > 0:
            out.append("")
            out.append("    Declined rows — what they would have been:")
            out.append(f"                       Actual +          Actual −")
            out.append(f"      Would predict +   {tp:>5d} (away)       {fp:>5d} (hidden ✓)")
            out.append(f"      Would predict −   {fn:>5d} (hidden ✓)   {tn:>5d} (away)")

        out.append(f"\n    Answered {n_covered:,}/{n_total:,} ({_fmt_pct(coverage)}) — declined {n_demurred:,}")
        return out

    lines = ["SELECTIVE PREDICTION", "-" * 60]

    summary = sp.get("summary")
    if summary:
        lines.extend(_render_entry("Summary", summary))

    strategies = sp.get("strategies") or {}
    strategy_keys = [k for k in strategies if not k.startswith("_") and strategies.get(k)]

    def _strategy_sort_key(k):
        try:
            return (0, _LEGACY_STRATEGY_ORDER.index(k))
        except ValueError:
            return (1, strategy_keys.index(k))

    strategy_keys = sorted(strategy_keys, key=_strategy_sort_key)
    if strategy_keys:
        lines.append("\n  Strategies")
        for key in strategy_keys:
            entry = strategies[key]
            label = entry.get("label") or _LEGACY_STRATEGY_LABELS.get(key) or key.replace("_", " ").title()
            lines.extend(_render_entry(label, entry))

    history = sp.get("history") or []
    if history:
        lines.append("\n  History")
        lines.append(f"  {'Epoch':>6}  {'Coverage':>9}  {'Covered AUC':>12}  {'Demur Capture':>14}  {'vs Random':>10}")
        for h in history:
            epoch = h.get("epoch", "?")
            cov = _fmt_pct(h.get("coverage"))
            cauc = _fmt_auc(h.get("covered_auc"))
            dec_h = h.get("demur_error_capture")
            dec_str = f"{dec_h:.4f}" if dec_h is not None else "N/A"
            baseline_h = h.get("demur_random_baseline")
            base_str = f"{baseline_h:.2f}" if baseline_h is not None else "—"
            lines.append(f"  {str(epoch):>6}  {cov:>9}  {cauc:>12}  {dec_str:>14}  {base_str:>10}")

    lines.append("")
    return "\n".join(lines)


_INTENT_LABELS = {
    "balanced": "Balanced",
    "only_alert_when_confident": "Only alert when confident",
    "catch_everything": "Catch everything",
    "catch_everything_aggressive": "Catch everything (aggressive)",
    "minimize_cost": "Minimize cost",
    "rank": "Ranking",
    "predict_probabilities": "Calibrated probabilities",
}


def _render_model_fit(data: dict) -> str:
    mf = data.get("model_fit")
    if not mf:
        return ""

    lines = [
        "MODEL FIT",
        "=" * 60,
        "",
    ]

    # ── Primary block ──────────────────────────────────────────────────────
    primary = mf.get("primary")
    if primary and primary.get("top_fit"):
        tf = primary["top_fit"]
        score = tf.get("score") or 0.0
        pct = round(score * 100)
        intent = primary.get("intent", "balanced")
        intent_label = _INTENT_LABELS.get(intent, intent)

        if score >= 0.50:
            bar_filled = round(score * 20)
            bar = "█" * bar_filled + "░" * (20 - bar_filled)
            lines.append(f"  {tf.get('label', '').upper()}  ({pct}%)")
            lines.append(f"  [{bar}]  under {intent_label} intent")
            if tf.get("summary"):
                lines.append(f"  {tf['summary']}")
            lines.append("")
            if tf.get("good_fit"):
                lines.append("  Good for:")
                for g in tf["good_fit"]:
                    lines.append(f"    • {g}")
            if tf.get("poor_fit"):
                lines.append("  Watch out:")
                for p in tf["poor_fit"]:
                    lines.append(f"    • {p}")
            if tf.get("target_framing"):
                lines.append(f"  Positive class framing: {tf['target_framing']}")
        else:
            lines.append("  No single clear use-case fit")
            # Show top 3 from per_intent matching primary intent
            primary_entry = next(
                (e for e in (mf.get("per_intent") or []) if e.get("intent") == intent),
                None,
            )
            top_scores = (primary_entry or {}).get("shape_scores", [tf])[:3]
            for s in top_scores:
                pct2 = round((s.get("score") or 0) * 100)
                lines.append(f"    {s.get('label', '—')}  {pct2}%")
        lines.append("")

    # ── Per-intent fits ────────────────────────────────────────────────────
    per_intent = mf.get("per_intent") or []
    if per_intent:
        lines.append("  Per-intent fits")
        lines.append(f"  {'Intent':<38}  {'Top fit':<28}  Score")
        lines.append(f"  {'-'*38}  {'-'*28}  -----")
        for entry in per_intent:
            tf2 = entry.get("top_fit") or {}
            s2 = tf2.get("score") or 0.0
            p2 = round(s2 * 100)
            intent_key = entry.get("intent", "")
            ilabel = _INTENT_LABELS.get(intent_key, intent_key or "—")
            fit_label = tf2.get("label") or "—"
            lines.append(f"  {ilabel:<38}  {fit_label:<28}  {p2}%")
        lines.append("")

    # ── Reference table ────────────────────────────────────────────────────
    reference = mf.get("reference_table") or []
    if reference:
        lines.append("  Shape reference")
        lines.append(f"  {'─' * 56}")
        for shape in reference:
            lines.append(f"  {shape.get('label') or shape.get('id', '')}")
            if shape.get("summary"):
                lines.append(f"    {shape['summary']}")
            if shape.get("good_fit"):
                for g in shape["good_fit"]:
                    lines.append(f"    + {g}")
            if shape.get("poor_fit"):
                for p in shape["poor_fit"]:
                    lines.append(f"    - {p}")
            lines.append("")

    return "\n".join(lines)


def _render_data_processing_notes(data: dict) -> str:
    notes = data.get("data_processing_notes")
    if not notes:
        return ""

    category_labels = {
        "column_dropped": "Column Dropped",
        "rows_filtered": "Rows Filtered",
        "type_detection": "Type Detection",
        "data_transform": "Data Transform",
        "csv_parsing": "CSV Parsing",
        "dataset_sampling": "Dataset Sampling",
    }

    sep = "-" * 60
    lines = [
        "DATA PROCESSING NOTES",
        "=" * 60,
        "",
    ]

    for note in notes:
        sev = (note.get("severity") or "info").upper()
        cat = category_labels.get(note.get("category", ""), note.get("category", "Note"))
        msg = note.get("message", "")

        affected_parts = []
        cols = note.get("columns")
        if cols:
            affected_parts.append("Columns: " + ", ".join(cols))
        rows = note.get("rows_affected")
        if rows is not None:
            affected_parts.append(f"{rows:,} rows affected")

        lines.append(f"  [{sev}] {cat}")
        lines.append(f"    {msg}")
        if affected_parts:
            lines.append(f"    ({'; '.join(affected_parts)})")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_multiclass_epoch_key(best_epochs: dict, checkpoint_metric: Optional[str]) -> Optional[str]:
    """Pick which best_epochs entry backs the multiclass headline metrics: the epoch matching
    training_optimization.checkpoint_metric if present, else the first non-regression key.
    Multiclass targets have no best_roc_auc/best_pr_auc (those are binary-only) — the epoch
    is keyed by whatever metric was actually optimized (best_accuracy, best_macro_f1, ...)."""
    fallback_key = f"best_{checkpoint_metric}" if checkpoint_metric else None
    if fallback_key and best_epochs.get(fallback_key):
        return fallback_key
    return next((k for k in best_epochs if not k.startswith("_") and k != "best_r2" and best_epochs.get(k)), None)


def _get_metric_value(best_epochs: dict, epoch_key: str, metric_key: str):
    """Extract a metric value from best_epochs nested structure."""
    epoch = best_epochs.get(epoch_key) or {}
    cdm = epoch.get("classification_display_metadata") or {}
    metrics = cdm.get("classification_metrics") or {}
    m = metrics.get(metric_key) or {}
    return m.get("value")


def _get_regression_metric_value(best_epochs: dict, epoch_key: str, metric_key: str):
    """Extract a metric value from best_epochs.<epoch_key>.regression_display_metadata."""
    epoch = best_epochs.get(epoch_key) or {}
    rdm = epoch.get("regression_display_metadata") or {}
    metrics = rdm.get("regression_metrics") or {}
    m = metrics.get(metric_key) or {}
    return m.get("value")


def _get_regression_skill(best_epochs: dict, epoch_key: str) -> Optional[dict]:
    """Extract the baseline-relative skill verdict ({tier, text}) for a regression epoch."""
    epoch = best_epochs.get(epoch_key) or {}
    rdm = epoch.get("regression_display_metadata") or {}
    return rdm.get("skill")


def render_to_file(
    model_card_json: Dict[str, Any],
    output_path: str,
    detailed: bool = True,
) -> str:
    """Render model card JSON to text file."""
    text = render_detailed_text(model_card_json) if detailed else render_brief_text(model_card_json)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    return output_path
