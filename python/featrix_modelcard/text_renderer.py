#!/usr/bin/env python3
"""
Plain text renderer for Featrix Sphere Model Card JSON.
Provides both brief and detailed versions.
"""

import json
from typing import Dict, Any, Optional


def format_value(value: Any, precision: int = 4) -> str:
    """Format a value for display."""
    if value is None:
        return 'N/A'
    if isinstance(value, float):
        formatted = f"{value:.{precision}f}".rstrip('0').rstrip('.')
        return formatted
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (list, dict)):
        return json.dumps(value, indent=2)
    return str(value)


def format_percentage(value: Optional[float]) -> str:
    """Format a percentage value."""
    if value is None:
        return 'N/A'
    return f"{value * 100:.2f}%"


def render_brief_model_identification(data: Dict[str, Any]) -> str:
    """Render brief model identification."""
    mi = data.get('model_identification', {})
    lines = [
        f"Model: {mi.get('name', 'N/A')}",
        f"Type: {mi.get('model_type', 'N/A')}",
        f"Status: {mi.get('status', 'N/A')}",
        f"Session: {mi.get('session_id', 'N/A')[:30]}...",
    ]
    return '\n'.join(lines)


def render_detailed_model_identification(data: Dict[str, Any]) -> str:
    """Render detailed model identification."""
    mi = data.get('model_identification', {})
    lines = [
        "=" * 60,
        "MODEL IDENTIFICATION",
        "=" * 60,
        f"Session ID:     {mi.get('session_id', 'N/A')}",
        f"Job ID:          {mi.get('job_id', 'N/A')}",
        f"Name:            {mi.get('name', 'N/A')}",
        f"Model Type:      {mi.get('model_type', 'N/A')}",
        f"Status:          {mi.get('status', 'N/A')}",
        f"Target Column:   {mi.get('target_column', 'N/A')}",
        f"Target Type:     {mi.get('target_column_type', 'N/A')}",
        f"Compute Cluster: {mi.get('compute_cluster', 'N/A')}",
        f"Training Date:   {mi.get('training_date', 'N/A')}",
        f"Framework:       {mi.get('framework', 'N/A')}",
        "",
    ]
    return '\n'.join(lines)


def render_brief_training_dataset(data: Dict[str, Any]) -> str:
    """Render brief training dataset."""
    td = data.get('training_dataset', {})
    return f"Training: {td.get('train_rows', 0):,} rows, {td.get('total_features', 0)} features"


def render_detailed_training_dataset(data: Dict[str, Any]) -> str:
    """Render detailed training dataset."""
    td = data.get('training_dataset', {})
    lines = [
        "=" * 60,
        "TRAINING DATASET",
        "=" * 60,
        f"Training Rows:    {td.get('train_rows', 0):,}",
        f"Validation Rows:  {td.get('val_rows', 0):,}",
        f"Total Rows:       {td.get('total_rows', 0):,}",
        f"Total Features:   {td.get('total_features', 0)}",
        f"Target Column:    {td.get('target_column', 'N/A')}",
        "",
        "Feature Names:",
    ]
    
    feature_names = td.get('feature_names', [])
    for i, name in enumerate(feature_names, 1):
        lines.append(f"  {i:2d}. {name}")
    
    lines.append("")
    return '\n'.join(lines)


def render_brief_training_metrics(data: Dict[str, Any]) -> str:
    """Render brief training metrics."""
    tm = data.get('training_metrics', {})
    model_type = data.get('model_identification', {}).get('model_type', '')
    
    lines = []
    
    if model_type == 'Single Predictor':
        cm = tm.get('classification_metrics')
        if cm:
            lines.append(f"Accuracy: {format_percentage(cm.get('accuracy'))}, "
                        f"F1: {format_percentage(cm.get('f1'))}, "
                        f"AUC: {format_percentage(cm.get('auc'))}")
    else:
        best_epoch = tm.get('best_epoch', {})
        if best_epoch.get('val_loss') is not None:
            lines.append(f"Best Val Loss: {format_value(best_epoch.get('val_loss'))}")
    
    return '\n'.join(lines) if lines else "N/A"


def render_detailed_training_metrics(data: Dict[str, Any]) -> str:
    """Render detailed training metrics."""
    tm = data.get('training_metrics', {})
    model_type = data.get('model_identification', {}).get('model_type', '')
    
    lines = [
        "=" * 60,
        "TRAINING METRICS",
        "=" * 60,
    ]
    
    # Best epoch
    best_epoch = tm.get('best_epoch', {})
    lines.extend([
        "Best Epoch:",
        f"  Epoch:          {best_epoch.get('epoch', 'N/A')}",
        f"  Validation Loss: {format_value(best_epoch.get('validation_loss'))}",
        f"  Train Loss:      {format_value(best_epoch.get('train_loss'))}",
    ])
    
    if best_epoch.get('spread_loss') is not None:
        lines.extend([
            f"  Spread Loss:    {format_value(best_epoch.get('spread_loss'))}",
            f"  Joint Loss:     {format_value(best_epoch.get('joint_loss'))}",
            f"  Marginal Loss:  {format_value(best_epoch.get('marginal_loss'))}",
        ])
    
    lines.append("")
    
    # Classification metrics (Single Predictor)
    if model_type == 'Single Predictor':
        cm = tm.get('classification_metrics')
        if cm:
            lines.extend([
                "Classification Metrics:",
                f"  Accuracy:  {format_percentage(cm.get('accuracy'))}",
                f"  Precision: {format_percentage(cm.get('precision'))}",
                f"  Recall:    {format_percentage(cm.get('recall'))}",
                f"  F1 Score:  {format_percentage(cm.get('f1'))}",
                f"  AUC:       {format_percentage(cm.get('auc'))}",
                f"  Binary:    {cm.get('is_binary', False)}",
                "",
            ])
        
        # Optimal threshold
        opt_thresh = tm.get('optimal_threshold')
        if opt_thresh:
            lines.extend([
                "Optimal Threshold:",
                f"  Threshold: {format_value(opt_thresh.get('optimal_threshold'))}",
                f"  Pos Label: {opt_thresh.get('pos_label', 'N/A')}",
                f"  F1:        {format_percentage(opt_thresh.get('optimal_threshold_f1'))}",
                f"  Accuracy:  {format_percentage(opt_thresh.get('accuracy_at_optimal_threshold'))}",
                "",
            ])
        
        # Argmax metrics
        argmax = tm.get('argmax_metrics')
        if argmax:
            lines.extend([
                "Argmax Metrics:",
                f"  Accuracy:  {format_percentage(argmax.get('accuracy'))}",
                f"  Precision: {format_percentage(argmax.get('precision'))}",
                f"  Recall:    {format_percentage(argmax.get('recall'))}",
                f"  F1 Score:  {format_percentage(argmax.get('f1'))}",
                "",
            ])
    
    # Loss progression (Embedding Space)
    if model_type == 'Embedding Space':
        loss_prog = tm.get('loss_progression')
        if loss_prog:
            lines.extend([
                "Loss Progression:",
                f"  Initial Train Loss: {format_value(loss_prog.get('initial_train'))}",
                f"  Initial Val Loss:   {format_value(loss_prog.get('initial_val'))}",
                f"  Improvement %:      {format_value(loss_prog.get('improvement_pct'))}",
                "",
            ])
        
        final_epoch = tm.get('final_epoch')
        if final_epoch:
            lines.extend([
                "Final Epoch:",
                f"  Epoch:      {final_epoch.get('epoch', 'N/A')}",
                f"  Train Loss: {format_value(final_epoch.get('train_loss'))}",
                f"  Val Loss:   {format_value(final_epoch.get('val_loss'))}",
                "",
            ])
    
    return '\n'.join(lines)


def render_brief_model_quality(data: Dict[str, Any]) -> str:
    """Render brief model quality."""
    mq = data.get('model_quality', {})
    lines = []
    
    assessment = mq.get('assessment')
    if assessment:
        lines.append(f"Quality: {assessment}")
    
    warnings = mq.get('warnings', [])
    if warnings:
        lines.append(f"Warnings: {len(warnings)}")
    
    return '\n'.join(lines) if lines else "N/A"


def render_detailed_model_quality(data: Dict[str, Any]) -> str:
    """Render detailed model quality."""
    mq = data.get('model_quality', {})
    
    lines = [
        "=" * 60,
        "MODEL QUALITY",
        "=" * 60,
    ]
    
    assessment = mq.get('assessment')
    if assessment:
        lines.extend([
            f"Assessment: {assessment}",
            "",
        ])
    
    recommendations = mq.get('recommendations', [])
    if recommendations:
        lines.append("Recommendations:")
        for i, rec in enumerate(recommendations, 1):
            lines.extend([
                f"  {i}. Issue: {rec.get('issue', 'N/A')}",
                f"     Suggestion: {rec.get('suggestion', 'N/A')}",
                "",
            ])
    
    warnings = mq.get('warnings', [])
    if warnings:
        lines.append("Warnings:")
        for i, warning in enumerate(warnings, 1):
            lines.extend([
                f"  {i}. [{warning.get('severity', 'UNKNOWN')}] {warning.get('type', 'N/A')}",
                f"     {warning.get('message', 'N/A')}",
            ])
            if warning.get('recommendation'):
                lines.append(f"     Recommendation: {warning.get('recommendation')}")
            details = warning.get('details')
            if details:
                lines.append(f"     Details: {json.dumps(details, indent=6)}")
            lines.append("")
    
    training_quality_warning = mq.get('training_quality_warning')
    if training_quality_warning:
        lines.extend([
            "Training Quality Warning:",
            f"  {training_quality_warning}",
            "",
        ])
    
    return '\n'.join(lines)


def render_brief_text(model_card_json: Dict[str, Any]) -> str:
    """Render brief plain text model card."""
    model_name = model_card_json.get('model_identification', {}).get('name', 'Model Card')
    
    lines = [
        f"MODEL CARD: {model_name}",
        "=" * 60,
        "",
        render_brief_model_identification(model_card_json),
        "",
        render_brief_training_dataset(model_card_json),
        "",
        render_brief_training_metrics(model_card_json),
        "",
        render_brief_model_quality(model_card_json),
        "",
    ]
    
    return '\n'.join(lines)


def render_detailed_text(model_card_json: Dict[str, Any]) -> str:
    """Render detailed plain text model card."""
    model_name = model_card_json.get('model_identification', {}).get('name', 'Model Card')
    
    lines = [
        f"MODEL CARD: {model_name}",
        "=" * 80,
        "",
        render_detailed_model_identification(model_card_json),
        render_detailed_training_dataset(model_card_json),
        render_detailed_training_metrics(model_card_json),
        render_detailed_model_quality(model_card_json),
    ]
    
    # Add training configuration
    tc = model_card_json.get('training_configuration', {})
    if tc:
        lines.extend([
            "=" * 60,
            "TRAINING CONFIGURATION",
            "=" * 60,
            f"Total Epochs:    {tc.get('epochs_total', 'N/A')}",
            f"Best Epoch:      {tc.get('best_epoch', 'N/A')}",
            f"d_model:         {tc.get('d_model', 'N/A')}",
            f"Batch Size:      {tc.get('batch_size', 'N/A')}",
            f"Learning Rate:  {format_value(tc.get('learning_rate'))}",
            f"Optimizer:       {tc.get('optimizer', 'N/A')}",
        ])
        dropout = tc.get('dropout_schedule')
        if dropout:
            lines.extend([
                "",
                "Dropout Schedule:",
                f"  Enabled: {dropout.get('enabled', False)}",
                f"  Initial: {format_value(dropout.get('initial'))}",
                f"  Final:   {format_value(dropout.get('final'))}",
            ])
        lines.append("")
    
    # Add feature inventory
    features = model_card_json.get('feature_inventory', [])
    if features:
        lines.extend([
            "=" * 60,
            "FEATURE INVENTORY",
            "=" * 60,
        ])
        for feat in features:
            name = feat.get('name', 'N/A')
            feat_type = feat.get('type', 'N/A')
            encoder = feat.get('encoder_type', 'N/A')
            unique_vals = feat.get('unique_values')
            sample_vals = feat.get('sample_values', [])
            stats = feat.get('statistics')
            
            lines.extend([
                f"Feature: {name}",
                f"  Type:          {feat_type}",
                f"  Encoder:       {encoder}",
                f"  Unique Values: {unique_vals if unique_vals is not None else 'N/A'}",
            ])
            
            if sample_vals:
                lines.append(f"  Sample Values: {', '.join([str(v) for v in sample_vals[:5]])}")
                if len(sample_vals) > 5:
                    lines.append(f"                 (+{len(sample_vals) - 5} more)")
            
            if stats:
                lines.extend([
                    "  Statistics:",
                    f"    Min:    {format_value(stats.get('min'))}",
                    f"    Max:    {format_value(stats.get('max'))}",
                    f"    Mean:   {format_value(stats.get('mean'))}",
                    f"    Std:    {format_value(stats.get('std'))}",
                    f"    Median: {format_value(stats.get('median'))}",
                ])
            lines.append("")
    
    # Add model architecture
    ma = model_card_json.get('model_architecture', {})
    if ma:
        lines.extend([
            "=" * 60,
            "MODEL ARCHITECTURE",
            "=" * 60,
        ])
        if ma.get('predictor_layers') is not None:
            lines.append(f"Predictor Layers: {ma.get('predictor_layers')}")
        if ma.get('predictor_parameters') is not None:
            lines.append(f"Predictor Parameters: {ma.get('predictor_parameters'):,}")
        if ma.get('embedding_space_d_model') is not None:
            lines.append(f"Embedding Space d_model: {ma.get('embedding_space_d_model')}")
        lines.append("")
    
    # Add technical details
    td = model_card_json.get('technical_details', {})
    if td:
        lines.extend([
            "=" * 60,
            "TECHNICAL DETAILS",
            "=" * 60,
            f"PyTorch Version: {td.get('pytorch_version', 'N/A')}",
            f"Device:          {td.get('device', 'N/A')}",
            f"Precision:       {td.get('precision', 'N/A')}",
            f"Loss Function:   {td.get('loss_function', 'N/A')}",
        ])
        if td.get('normalization'):
            lines.append(f"Normalization:   {td.get('normalization')}")
        lines.append("")
    
    # Add provenance
    prov = model_card_json.get('provenance', {})
    if prov:
        lines.extend([
            "=" * 60,
            "PROVENANCE",
            "=" * 60,
            f"Created At: {prov.get('created_at', 'N/A')}",
        ])
        if prov.get('training_duration_minutes') is not None:
            duration = prov.get('training_duration_minutes')
            hours = int(duration // 60)
            minutes = int(duration % 60)
            lines.append(f"Training Duration: {hours}h {minutes}m ({duration:.2f} minutes)")
        version_info = prov.get('version_info')
        if version_info:
            lines.append(f"Version Info: {json.dumps(version_info, indent=2)}")
        lines.append("")
    
    # Add column statistics (Embedding Space only)
    cs = model_card_json.get('column_statistics', {})
    if cs:
        lines.extend([
            "=" * 60,
            "COLUMN STATISTICS",
            "=" * 60,
        ])
        for col_name, stats in cs.items():
            lines.extend([
                f"Column: {col_name}",
                f"  Mutual Information (bits): {format_value(stats.get('mutual_information_bits'))}",
                f"  Marginal Loss:            {format_value(stats.get('marginal_loss'))}",
                "",
            ])
    
    return '\n'.join(lines)


def render_to_file(model_card_json: Dict[str, Any], output_path: str, detailed: bool = True) -> str:
    """Render model card JSON to text file."""
    if detailed:
        text = render_detailed_text(model_card_json)
    else:
        text = render_brief_text(model_card_json)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(text)
    return output_path

