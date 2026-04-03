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


def _map_model_type(mi: dict) -> str:
    """Map model_type + target_column_type to display string."""
    model_type = mi.get("model_type", "")
    target_type = (mi.get("target_column_type") or "").lower()
    mt = model_type.lower()

    if mt in ("embedding space", "es"):
        return "Foundational Embedding Space"
    if mt in ("single predictor", "sp"):
        if target_type == "set":
            return "Binary Classifier"
        if target_type == "scalar":
            return "Regression"
        return "Single Predictor"
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
    ci = data.get("class_imbalance", {})
    es = data.get("embedding_space", {})

    model_name = mi.get("name", "Model Card")
    model_type = _map_model_type(mi)
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

    # Best metrics
    roc_auc = _get_metric_value(be, "best_roc_auc", "auc")
    pr_auc = _get_metric_value(be, "best_pr_auc", "pr_auc")
    f1 = _get_metric_value(be, "best_roc_auc", "f1")
    acc = _get_metric_value(be, "best_roc_auc", "accuracy")

    lines.append("")
    lines.append(
        f"Accuracy: {format_pct(acc)}  "
        f"AUC: {format_metric(roc_auc)}  "
        f"PR-AUC: {format_metric(pr_auc)}  "
        f"F1: {format_metric(f1)}"
    )

    # Class imbalance summary
    if ci.get("total_samples"):
        lines.append(
            f"Samples: {ci['total_samples']:,}  "
            f"Imbalance: {ci.get('imbalance_ratio', 'N/A')}:1"
        )

    # Model stack summary
    if es:
        lines.append(
            f"Foundation: {format_large_number(es.get('num_parameters'))} params, "
            f"d_model={es.get('d_model', 'N/A')}"
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
        _render_model_stack(data),
        _render_best_epochs(data),
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
    ci = data.get("class_imbalance", {})

    model_name = mi.get("name", "Model Card")
    model_type = _map_model_type(mi)
    status = (mi.get("status") or "N/A").upper()
    if status == "DONE":
        status = "READY"

    session_id, job_id = _parse_model_path(du.get("best_model_path"))
    model_id = session_id or (mi.get("session_id", "N/A")[:20] if mi.get("session_id") else "N/A")

    framework = mi.get("framework", "N/A")
    framework = re.sub(r"\s+unknown$", "", framework, flags=re.IGNORECASE).strip() or "N/A"

    # Best metrics
    roc_auc = _get_metric_value(be, "best_roc_auc", "auc")
    pr_auc = _get_metric_value(be, "best_pr_auc", "pr_auc")

    # PR-AUC lift
    prevalence = None
    if ci.get("minority_class_count") and ci.get("total_samples"):
        prevalence = ci["minority_class_count"] / ci["total_samples"]
    pr_auc_lift = (pr_auc / prevalence) if (pr_auc and prevalence) else None

    lines = [
        f"MODEL CARD: {model_name}",
        "=" * 80,
        "",
        "MODEL IDENTIFICATION",
        "-" * 60,
        f"  Target Column:  {mi.get('target_column', 'N/A')}",
        f"  Model Type:     {model_type}",
        f"  Best ROC-AUC:   {format_metric(roc_auc)}",
        f"  Best PR-AUC:    {format_metric(pr_auc)}"
        + (f"  [{pr_auc_lift:.1f}x lift]" if pr_auc_lift else ""),
        "",
        f"  Status:         {status}",
        f"  Training Date:  {mi.get('training_date', 'N/A')}",
        f"  Model ID:       {model_id}",
        f"  Cluster:        {(mi.get('compute_cluster') or 'N/A').upper()}",
        f"  Dims:           {es.get('d_model', 'N/A')}",
        f"  Framework:      {framework}",
        "",
    ]
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


def _render_best_epochs(data: dict) -> str:
    be = data.get("best_epochs")
    if not be:
        return ""

    lines = [
        "MODEL DETAILS",
        "-" * 60,
    ]

    for label, key in [("Best ROC-AUC", "best_roc_auc"), ("Best PR-AUC", "best_pr_auc")]:
        epoch_data = be.get(key)
        if not epoch_data:
            continue

        cdm = epoch_data.get("classification_display_metadata") or {}
        epoch_num = epoch_data.get("epoch") or cdm.get("epoch", "N/A")
        metrics = cdm.get("classification_metrics") or {}

        lines.append(f"\n  {label} -- Epoch {epoch_num}")
        lines.append(f"  {'~' * 40}")

        # Metrics table (top 4)
        for mkey in ["accuracy", "auc", "pr_auc", "f1"]:
            m = metrics.get(mkey)
            if not m:
                continue
            val = format_pct(m.get("value")) if mkey == "accuracy" else format_metric(m.get("value"))
            lines.append(f"    {mkey.upper().replace('_', ' '):12s} {val}")

        # Confusion matrix
        cm = cdm.get("confusion_matrix")
        if cm:
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

    if ci.get("train_distribution") or ci.get("class_distribution"):
        train0 = (ci.get("train_distribution") or {}).get("0", 0)
        train1 = (ci.get("train_distribution") or {}).get("1", 0)
        val0 = (ci.get("val_distribution") or {}).get("0", 0)
        val1 = (ci.get("val_distribution") or {}).get("1", 0)
        total_train = train0 + train1
        total_val = val0 + val1
        total = ci.get("total_samples") or td.get("train_rows") or (total_train + total_val)

        minority = ci.get("minority_class", "1")
        majority = ci.get("majority_class", "0")

        lines.append(f"  {'':12s} Class \"{minority}\"  Class \"{majority}\"  Total")
        lines.append(f"  {'Train':12s} {train1:>10,}  {train0:>12,}  {total_train:>8,}")
        lines.append(f"  {'Validation':12s} {val1:>10,}  {val0:>12,}  {total_val:>8,}")
        lines.append(f"  {'Total':12s} {ci.get('minority_class_count', train1 + val1):>10,}  {ci.get('majority_class_count', train0 + val0):>12,}  {total:>8,}")
        lines.append("")

        if ci.get("imbalance_ratio"):
            minority_pct = (ci.get("minority_class_count", 0) / total * 100) if total else 0
            lines.append(f"  Imbalance ratio: {ci['imbalance_ratio']}:1 (minority is {minority_pct:.1f}% of data)")
    elif td.get("train_rows"):
        lines.append(f"  Training rows: {td['train_rows']:,}")

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


def _get_metric_value(best_epochs: dict, epoch_key: str, metric_key: str):
    """Extract a metric value from best_epochs nested structure."""
    epoch = best_epochs.get(epoch_key) or {}
    cdm = epoch.get("classification_display_metadata") or {}
    metrics = cdm.get("classification_metrics") or {}
    m = metrics.get(metric_key) or {}
    return m.get("value")


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
