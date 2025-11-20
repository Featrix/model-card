#!/usr/bin/env python3
"""
Generate professional model card HTML report.
"""

import pandas as pd
import json
import socket
from datetime import datetime
from pathlib import Path

def generate_model_card(csv_file, session_id, output_html='model_card.html', perf_metrics=None):
    """Generate comprehensive professional model card."""
    import hashlib
    import numpy as np
    
    # Chart theme constants
    BG_DARK = '#1a1a1a'
    TEXT_COLOR = '#e0e0e0'
    GRID_COLOR = '#333333'
    ACCENT = '#667eea'
    ACCENT2 = '#f093fb'
    
    if perf_metrics is None:
        perf_metrics = {}
    
    df = pd.read_csv(csv_file)
    
    # Calculate file MD5
    with open(csv_file, 'rb') as f:
        file_md5 = hashlib.md5(f.read()).hexdigest()
    
    # Setup output directory
    output_dir = str(Path(output_html).parent)
    
    # Fetch model metadata
    from featrixsphere import FeatrixSphereClient
    client = FeatrixSphereClient()
    session_info = client._get_json(f"/compute/session/{session_id}")
    
    session_data = session_info.get('session', {})
    schema_meta = session_data.get('schema_metadata', {})
    
    # Extract all metadata
    meta = {
        'session_id': session_id,
        'created_at': session_data.get('created_at', ''),
        'status': session_data.get('status', 'unknown'),
        'compute_cluster': session_data.get('compute_cluster', 'unknown'),
        'training_rows': schema_meta.get('total_rows', 0),
        'training_cols': schema_meta.get('total_columns', 0),
        'features': schema_meta.get('schema_changes', {}).get('final_columns', []),
        'feature_details': schema_meta.get('columns', {}),
        'json_transforms': schema_meta.get('json_transformations', {}),
    }
    
    # Get ES and predictor job IDs
    jobs = session_info.get('jobs', {})
    
    # Find ES training job
    es_job_id = next((k for k in jobs.keys() if 'train_es' in k.lower()), None)
    meta['embedding_space_id'] = es_job_id or 'N/A'
    
    # Find predictor job
    pred_job_id = next((k for k in jobs.keys() if 'predictor' in k.lower()), None)
    meta['predictor_job_id'] = pred_job_id or 'N/A'
    
    pred_job = jobs.get(pred_job_id, {}) if pred_job_id else {}
    if isinstance(pred_job, dict):
        meta['predictor_status'] = pred_job.get('status', 'unknown')
        meta['predictor_created'] = pred_job.get('created_at', '')
    
    # Fetch ACTUAL training metrics
    try:
        metrics_data = client._get_json(f"/compute/session/{session_id}/training_metrics")
        training_metrics = metrics_data.get('training_metrics', {})
        
        # Extract final metrics
        final_metrics = training_metrics.get('final_metrics', {})
        meta['accuracy'] = final_metrics.get('accuracy', None)
        meta['precision'] = final_metrics.get('precision', None)
        meta['recall'] = final_metrics.get('recall', None)
        meta['f1'] = final_metrics.get('f1', None)
        meta['auc'] = final_metrics.get('auc', None)
        
        # Extract training history for loss curves
        training_info = training_metrics.get('training_info', [])
        meta['epochs'] = len(training_info)
        meta['loss_history'] = [epoch.get('loss', 0) for epoch in training_info]
        meta['epoch_metrics'] = training_info
        
        # Extract confusion matrix (TP, TN, FP, FN)
        meta['confusion_matrix'] = {
            'tp': final_metrics.get('tp', 0),
            'tn': final_metrics.get('tn', 0),
            'fp': final_metrics.get('fp', 0),
            'fn': final_metrics.get('fn', 0),
        }
        
        # Extract validation set distribution if available
        meta['validation_distribution'] = None
        
        # Check multiple possible locations for validation data
        # 1. Check validation_metrics directly
        if 'validation_metrics' in training_metrics:
            val_metrics = training_metrics.get('validation_metrics', {})
            if 'class_distribution' in val_metrics:
                meta['validation_distribution'] = val_metrics['class_distribution']
            elif 'predictions' in val_metrics:
                val_preds = val_metrics.get('predictions', [])
                if val_preds:
                    val_df = pd.DataFrame({'predicted': val_preds})
                    val_counts = val_df['predicted'].value_counts().sort_index()
                    meta['validation_distribution'] = val_counts.to_dict()
        
        # 2. Check if validation data is in training_info/epoch_metrics
        if meta['validation_distribution'] is None and training_info:
            # Check last epoch for validation predictions
            for epoch in reversed(training_info):
                if 'validation' in epoch or 'val' in epoch:
                    val_data = epoch.get('validation', epoch.get('val', {}))
                    if 'predictions' in val_data:
                        val_preds = val_data.get('predictions', [])
                        if val_preds:
                            val_df = pd.DataFrame({'predicted': val_preds})
                            val_counts = val_df['predicted'].value_counts().sort_index()
                            meta['validation_distribution'] = val_counts.to_dict()
                            break
                    elif 'class_distribution' in val_data:
                        meta['validation_distribution'] = val_data['class_distribution']
                        break
        
        # 3. Check top-level keys in training_metrics
        if meta['validation_distribution'] is None:
            for key in ['validation', 'val', 'validation_set', 'val_set', 'validation_distribution']:
                if key in training_metrics:
                    val_data = training_metrics[key]
                    if isinstance(val_data, dict):
                        if 'class_distribution' in val_data:
                            meta['validation_distribution'] = val_data['class_distribution']
                            break
                        elif 'predictions' in val_data:
                            val_preds = val_data.get('predictions', [])
                            if val_preds:
                                val_df = pd.DataFrame({'predicted': val_preds})
                                val_counts = val_df['predicted'].value_counts().sort_index()
                                meta['validation_distribution'] = val_counts.to_dict()
                                break
                    elif isinstance(val_data, list):
                        val_df = pd.DataFrame({'predicted': val_data})
                        val_counts = val_df['predicted'].value_counts().sort_index()
                        meta['validation_distribution'] = val_counts.to_dict()
                        break
        
        # Debug: Print available keys in training_metrics
        print(f"   🔍 Training metrics keys: {list(training_metrics.keys())}")
        if meta['validation_distribution']:
            print(f"   ✅ Found validation distribution: {meta['validation_distribution']}")
        else:
            print(f"   ⚠️ No validation distribution found in training_metrics")
        
        # Save FULL metadata as JSON for inspection
        metadata_file = f"{output_dir}/model_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump({
                'session_info': session_info,
                'training_metrics': training_metrics,
                'final_metrics': final_metrics,
            }, f, indent=2, default=str)
        print(f"   ✅ Saved full metadata: {metadata_file}")
        
        print(f"   ✅ Retrieved training metrics: {meta['epochs']} epochs, AUC={meta['auc']:.3f}")
    except Exception as e:
        print(f"   ⚠️ Could not fetch training metrics: {e}")
        meta['accuracy'] = None
        meta['precision'] = None
        meta['recall'] = None
        meta['f1'] = None
        meta['auc'] = None
        meta['epochs'] = None
        meta['loss_history'] = []
        meta['epoch_metrics'] = []
    
    # Get target from single_predictors
    meta['target_column'] = 'is_bad_account'  # Default
    meta['target_type'] = 'categorical'
    
    try:
        single_preds = session_data.get('single_predictors', [])
        if isinstance(single_preds, list) and len(single_preds) > 0:
            pred_info = single_preds[0]
            if isinstance(pred_info, dict):
                meta['target_column'] = pred_info.get('target_column', meta['target_column'])
                meta['target_type'] = pred_info.get('target_column_type', meta['target_type'])
    except Exception:
        pass  # Use defaults
    
    # Calculate statistics for HTML rendering and generate charts
    pred_counts = df['predicted_is_bad_account'].value_counts().sort_index() if 'predicted_is_bad_account' in df.columns else pd.Series()
    cm = meta.get('confusion_matrix', {})
    
    # Calculate confidence distributions for each confusion matrix cell
    cm_confidence_stats = {}
    if 'predicted_is_bad_account' in df.columns:
        prob_cols = [c for c in df.columns if c.startswith('pred_') and not c.startswith('pred_<UNKNOWN>')]
        actual_col = meta.get('target_column', 'is_bad_account')
        
        # Calculate max confidence for each row
        if prob_cols:
            df['max_confidence'] = df[prob_cols].max(axis=1)
            
            # Helper function to calculate confidence interval
            def calc_ci(series, confidence=0.95):
                """Calculate 95% confidence interval for mean"""
                if len(series) == 0:
                    return None, None
                mean = series.mean()
                std = series.std()
                n = len(series)
                if n < 2 or std == 0:
                    return mean, mean
                # Use t-distribution for small samples, normal for large
                from scipy import stats
                if n < 30:
                    t_val = stats.t.ppf((1 + confidence) / 2, n - 1)
                else:
                    t_val = 1.96  # z-score for 95% CI
                margin = t_val * std / np.sqrt(n)
                return mean - margin, mean + margin
            
            # True Negatives: Actual 0, Predicted 0
            if actual_col in df.columns:
                tn_mask = (df[actual_col] == 0) & (df['predicted_is_bad_account'] == 0)
            else:
                # If no actual column, use all predictions where predicted=0 (includes both TN and FN)
                tn_mask = (df['predicted_is_bad_account'] == 0)
            tn_conf = df.loc[tn_mask, 'max_confidence'] if 'max_confidence' in df.columns and tn_mask.any() else pd.Series()
            tn_ci_lower, tn_ci_upper = calc_ci(tn_conf) if len(tn_conf) > 0 else (None, None)
            cm_confidence_stats['tn'] = {
                'mean': tn_conf.mean() if len(tn_conf) > 0 else None,
                'std': tn_conf.std() if len(tn_conf) > 0 else None,
                'min': tn_conf.min() if len(tn_conf) > 0 else None,
                'max': tn_conf.max() if len(tn_conf) > 0 else None,
                'ci_lower': tn_ci_lower,
                'ci_upper': tn_ci_upper,
                'n': len(tn_conf),
            }
            
            # False Positives: Actual 0, Predicted 1
            if actual_col in df.columns:
                fp_mask = (df[actual_col] == 0) & (df['predicted_is_bad_account'] == 1)
            else:
                # If no actual column, use all predictions where predicted=1 (includes both TP and FP)
                fp_mask = (df['predicted_is_bad_account'] == 1)
            fp_conf = df.loc[fp_mask, 'max_confidence'] if 'max_confidence' in df.columns and fp_mask.any() else pd.Series()
            fp_ci_lower, fp_ci_upper = calc_ci(fp_conf) if len(fp_conf) > 0 else (None, None)
            cm_confidence_stats['fp'] = {
                'mean': fp_conf.mean() if len(fp_conf) > 0 else None,
                'std': fp_conf.std() if len(fp_conf) > 0 else None,
                'min': fp_conf.min() if len(fp_conf) > 0 else None,
                'max': fp_conf.max() if len(fp_conf) > 0 else None,
                'ci_lower': fp_ci_lower,
                'ci_upper': fp_ci_upper,
                'n': len(fp_conf),
            }
            
            # False Negatives: Actual 1, Predicted 0 (WORST CASE)
            if actual_col in df.columns:
                fn_mask = (df[actual_col] == 1) & (df['predicted_is_bad_account'] == 0)
            else:
                # If no actual column, use all predictions where predicted=0 (includes both TN and FN)
                fn_mask = (df['predicted_is_bad_account'] == 0)
            fn_conf = df.loc[fn_mask, 'max_confidence'] if 'max_confidence' in df.columns and fn_mask.any() else pd.Series()
            fn_ci_lower, fn_ci_upper = calc_ci(fn_conf) if len(fn_conf) > 0 else (None, None)
            cm_confidence_stats['fn'] = {
                'mean': fn_conf.mean() if len(fn_conf) > 0 else None,
                'std': fn_conf.std() if len(fn_conf) > 0 else None,
                'min': fn_conf.min() if len(fn_conf) > 0 else None,
                'max': fn_conf.max() if len(fn_conf) > 0 else None,
                'ci_lower': fn_ci_lower,
                'ci_upper': fn_ci_upper,
                'n': len(fn_conf),
            }
            
            # True Positives: Actual 1, Predicted 1
            if actual_col in df.columns:
                tp_mask = (df[actual_col] == 1) & (df['predicted_is_bad_account'] == 1)
            else:
                # If no actual column, use all predictions where predicted=1 (includes both TP and FP)
                tp_mask = (df['predicted_is_bad_account'] == 1)
            tp_conf = df.loc[tp_mask, 'max_confidence'] if 'max_confidence' in df.columns and tp_mask.any() else pd.Series()
            tp_ci_lower, tp_ci_upper = calc_ci(tp_conf) if len(tp_conf) > 0 else (None, None)
            cm_confidence_stats['tp'] = {
                'mean': tp_conf.mean() if len(tp_conf) > 0 else None,
                'std': tp_conf.std() if len(tp_conf) > 0 else None,
                'min': tp_conf.min() if len(tp_conf) > 0 else None,
                'max': tp_conf.max() if len(tp_conf) > 0 else None,
                'ci_lower': tp_ci_lower,
                'ci_upper': tp_ci_upper,
                'n': len(tp_conf),
            }
    
    # Initialize charts dictionary
    charts = {}
    
    # 1. Loss curve
    if meta.get('loss_history') and len(meta['loss_history']) > 0:
        try:
            import matplotlib.pyplot as plt
            
            charts['loss_curve'] = f"{output_dir}/loss_curve.png"
            
            fig, ax = plt.subplots(figsize=(11, 2.5), facecolor=BG_DARK)
            fig.patch.set_facecolor(BG_DARK)
            ax.set_facecolor(BG_DARK)
            
            epochs = range(len(meta['loss_history']))
            
            # SHARP high-contrast line
            ax.plot(epochs, meta['loss_history'], color=ACCENT, linewidth=2, alpha=1.0)
            
            # MINIMAL labels
            ax.set_xlabel('Epoch', fontsize=10, color=TEXT_COLOR, family='sans-serif')
            ax.set_ylabel('Loss', fontsize=10, color=TEXT_COLOR, family='sans-serif')
            ax.set_title('Training Loss', fontsize=12, fontweight='600', family='sans-serif', loc='left', pad=8, color=TEXT_COLOR)
            
            # Minimal grid - only horizontal
            ax.grid(True, axis='y', alpha=0.2, linestyle='-', linewidth=0.5, color=GRID_COLOR)
            ax.set_axisbelow(True)
            
            # Remove all spines except bottom
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_visible(False)
            ax.spines['bottom'].set_color(GRID_COLOR)
            ax.spines['bottom'].set_linewidth(0.5)
            
            # Tick colors
            ax.tick_params(colors=TEXT_COLOR, labelsize=9)
            ax.tick_params(axis='y', left=False)
            
            plt.tight_layout()
            plt.savefig(charts['loss_curve'], dpi=200, bbox_inches='tight', facecolor=BG_DARK, edgecolor='none')
            plt.close()
            
            print(f"   ✅ Generated loss curve")
        except Exception as e:
            print(f"   ⚠️ Loss curve failed: {e}")
    
    # 2. Test set distribution - HORIZONTAL SEGMENTED BAR
    prob_cols = [c for c in df.columns if c.startswith('pred_')]
    if 'predicted_is_bad_account' in df.columns:
        try:
            import matplotlib.pyplot as plt
            from matplotlib.patches import Rectangle
            
            charts['pred_dist'] = f"{output_dir}/prediction_distribution.png"
            
            pred_counts = df['predicted_is_bad_account'].value_counts().sort_index()
            total = len(df)
            
            fig, ax = plt.subplots(figsize=(11, 1.2), facecolor=BG_DARK)
            fig.patch.set_facecolor(BG_DARK)
            ax.set_facecolor(BG_DARK)
            
            # Draw segmented bar
            left = 0
            colors = [ACCENT, GRID_COLOR]
            for i, (cls, count) in enumerate(pred_counts.items()):
                width = count / total
                rect = Rectangle((left, 0), width, 1, facecolor=colors[i % len(colors)], edgecolor=TEXT_COLOR, linewidth=1)
                ax.add_patch(rect)
                
                # Add label in center of segment (two separate lines)
                label_x = left + width/2
                ax.text(label_x, 0.65, f'{cls}', 
                       ha='center', va='center', fontsize=13, fontweight='700', family='sans-serif', color='white')
                ax.text(label_x, 0.35, f'{count} ({count/total*100:.0f}%)', 
                       ha='center', va='center', fontsize=10, fontweight='500', family='sans-serif', color='white')
                
                left += width
            
            ax.set_xlim(0, 1)
            ax.set_ylim(0, 1)
            ax.axis('off')
            plt.tight_layout(pad=0)
            plt.savefig(charts['pred_dist'], dpi=200, bbox_inches='tight', facecolor=BG_DARK, edgecolor='none')
            plt.close()
            
            print(f"   ✅ Generated test set distribution")
        except Exception as e:
            print(f"   ⚠️ Test set distribution failed: {e}")
    
    # 3. Confidence histogram
    if prob_cols:
        try:
            import matplotlib.pyplot as plt
            import numpy as np
            
            charts['confidence'] = f"{output_dir}/confidence_distribution.png"
            
            max_conf = df[prob_cols].max(axis=1)
            
            fig, ax = plt.subplots(figsize=(11, 2.5), facecolor=BG_DARK)
            fig.patch.set_facecolor(BG_DARK)
            ax.set_facecolor(BG_DARK)
            
            ax.hist(max_conf, bins=25, range=(0, 1), color=ACCENT, alpha=0.9, edgecolor=TEXT_COLOR, linewidth=0.3)
            ax.set_xlim(0, 1)
            
            ax.set_xlabel('Confidence', fontsize=10, color=TEXT_COLOR, family='sans-serif')
            ax.set_ylabel('Count', fontsize=10, color=TEXT_COLOR, family='sans-serif')
            ax.set_title('Confidence Distribution', fontsize=12, fontweight='600', family='sans-serif', loc='left', pad=8, color=TEXT_COLOR)
            
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_visible(False)
            ax.spines['bottom'].set_color(GRID_COLOR)
            ax.spines['bottom'].set_linewidth(0.5)
            
            ax.grid(axis='y', alpha=0.2, linestyle='-', linewidth=0.5, color=GRID_COLOR)
            ax.set_axisbelow(True)
            ax.tick_params(colors=TEXT_COLOR, labelsize=9)
            ax.tick_params(axis='y', left=False)
            
            plt.tight_layout()
            plt.savefig(charts['confidence'], dpi=200, bbox_inches='tight', facecolor=BG_DARK, edgecolor='none')
            plt.close()
            
            print(f"   ✅ Generated confidence distribution")
        except Exception as e:
            print(f"   ⚠️ Confidence distribution failed: {e}")
    
    # 4. Confusion Matrix visualization
    if meta.get('confusion_matrix'):
        try:
            import matplotlib.pyplot as plt
            import numpy as np
            
            charts['confusion_matrix'] = f"{output_dir}/confusion_matrix.png"
            
            cm = meta['confusion_matrix']
            matrix = np.array([[cm['tn'], cm['fp']], [cm['fn'], cm['tp']]])
            
            fig, ax = plt.subplots(figsize=(5, 4), facecolor='white')
            fig.patch.set_facecolor('white')
            ax.set_facecolor('white')
            
            # Create custom colors for confusion matrix: green for correct, red for errors
            # Matrix layout: [[TN, FP], [FN, TP]]
            colors_matrix = np.array([
                ['#5a8a6a', '#d67a6a'],  # TN (softer green), FP (softer red)
                ['#e67a6a', '#5a8a6a']   # FN (softer bright red), TP (softer green)
            ])
            
            # Draw colored rectangles
            for i in range(2):
                for j in range(2):
                    rect = plt.Rectangle((j-0.5, i-0.5), 1, 1, 
                                        facecolor=colors_matrix[i, j], 
                                        edgecolor='#666', linewidth=2)
                    ax.add_patch(rect)
                    # Text color: white for dark backgrounds
                    text_color = 'white' if colors_matrix[i, j] in ['#5a8a6a', '#d67a6a', '#e67a6a'] else 'black'
                    ax.text(j, i, f'{matrix[i, j]}',
                           ha="center", va="center", color=text_color, fontsize=22, fontweight='bold', family='sans-serif')
            
            ax.set_xlim(-0.5, 1.5)
            ax.set_ylim(-0.5, 1.5)
            ax.set_xticks([0, 1])
            ax.set_yticks([0, 1])
            ax.set_xticklabels(['Pred 0', 'Pred 1'], fontsize=10, fontweight='600', family='sans-serif', color='black')
            ax.set_yticklabels(['Actual 0', 'Actual 1'], fontsize=10, fontweight='600', family='sans-serif', color='black')
            ax.set_title('Confusion Matrix', fontsize=12, fontweight='600', family='sans-serif', loc='left', pad=8, color='black')
            ax.tick_params(colors='black', length=0)
            
            plt.tight_layout()
            plt.savefig(charts['confusion_matrix'], dpi=200, bbox_inches='tight', facecolor='white', edgecolor='none')
            plt.close()
            
            print(f"   ✅ Generated confusion matrix")
        except Exception as e:
            print(f"   ⚠️ Confusion matrix failed: {e}")
    
    # 5. Metrics over epochs (AUC, F1, Precision, Recall)
    if meta.get('epoch_metrics') and len(meta['epoch_metrics']) > 3:
        try:
            import matplotlib.pyplot as plt
            
            charts['metrics_over_epochs'] = f"{output_dir}/metrics_over_epochs.png"
            
            epochs = range(len(meta['epoch_metrics']))
            auc_vals = [e.get('metrics', {}).get('auc', 0) for e in meta['epoch_metrics']]
            f1_vals = [e.get('metrics', {}).get('f1', 0) for e in meta['epoch_metrics']]
            prec_vals = [e.get('metrics', {}).get('precision', 0) for e in meta['epoch_metrics']]
            rec_vals = [e.get('metrics', {}).get('recall', 0) for e in meta['epoch_metrics']]
            
            fig, ax = plt.subplots(figsize=(11, 2.5), facecolor=BG_DARK)
            fig.patch.set_facecolor(BG_DARK)
            ax.set_facecolor(BG_DARK)
            
            ax.plot(epochs, auc_vals, color=ACCENT, linewidth=2, label='AUC', alpha=1.0)
            ax.plot(epochs, f1_vals, color=ACCENT2, linewidth=2, label='F1', alpha=0.9)
            ax.plot(epochs, prec_vals, color='#51cf66', linewidth=1.5, label='Precision', alpha=0.7)
            ax.plot(epochs, rec_vals, color='#ffd43b', linewidth=1.5, label='Recall', alpha=0.7)
            
            ax.set_xlabel('Epoch', fontsize=10, color=TEXT_COLOR, family='sans-serif')
            ax.set_ylabel('Score', fontsize=10, color=TEXT_COLOR, family='sans-serif')
            ax.set_title('Metrics Over Epochs', fontsize=12, fontweight='600', family='sans-serif', loc='left', pad=8, color=TEXT_COLOR)
            ax.legend(fontsize=9, frameon=False, loc='lower right', labelcolor=TEXT_COLOR)
            ax.set_ylim(0, 1.05)
            
            ax.grid(True, axis='y', alpha=0.2, linestyle='-', linewidth=0.5, color=GRID_COLOR)
            ax.set_axisbelow(True)
            
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_visible(False)
            ax.spines['bottom'].set_color(GRID_COLOR)
            ax.spines['bottom'].set_linewidth(0.5)
            
            ax.tick_params(colors=TEXT_COLOR, labelsize=9)
            ax.tick_params(axis='y', left=False)
            
            plt.tight_layout()
            plt.savefig(charts['metrics_over_epochs'], dpi=200, bbox_inches='tight', facecolor=BG_DARK, edgecolor='none')
            plt.close()
            
            print(f"   ✅ Generated metrics over epochs")
        except Exception as e:
            print(f"   ⚠️ Metrics over epochs failed: {e}")
    
    # Calculate prediction statistics
    prob_cols = [c for c in df.columns if c.startswith('pred_')]
    classes = df['predicted_is_bad_account'].unique().tolist() if 'predicted_is_bad_account' in df.columns else []
    
    # Build feature stats table - SORTED alphabetically, target highlighted
    feature_stats_rows = []
    target_col = meta.get('target_column', 'is_bad_account')
    
    # Put target first, then sort rest alphabetically
    features_sorted = sorted([f for f in meta['features'][:50] if f != target_col])
    if target_col in meta['features']:
        features_sorted.insert(0, target_col)
    
    for feat_name in features_sorted:
        feat_info = meta['feature_details'].get(feat_name, {})
        null_ct = feat_info.get('null_count', 0)
        total = meta['training_rows']
        populated = ((total - null_ct) / total * 100) if total > 0 else 0
        
        # Highlight target variable
        highlight_style = 'background: #667eea; color: white; font-weight: bold;' if feat_name == target_col else ''
        
        # Determine if feature is a set or scalar and calculate appropriate stats
        stats_cell = 'N/A'
        if feat_name in df.columns:
            feat_data = df[feat_name].dropna()
            if len(feat_data) > 0:
                unique_count = feat_data.nunique()
                
                # Consider it a set if <= 20 unique values (categorical/discrete)
                # Otherwise treat as scalar (continuous)
                if unique_count <= 20:
                    # SET: Show % of each symbol/value
                    value_counts = feat_data.value_counts().sort_values(ascending=False)
                    total_non_null = len(feat_data)
                    symbol_pcts = []
                    for val, count in value_counts.items():
                        pct = (count / total_non_null * 100) if total_non_null > 0 else 0
                        symbol_pcts.append(f"{val}: {pct:.1f}%")
                    stats_cell = '<br>'.join(symbol_pcts) if symbol_pcts else 'N/A'
                else:
                    # SCALAR: Show Q1, avg (mean), Q3
                    try:
                        q1 = np.percentile(feat_data, 25)
                        q3 = np.percentile(feat_data, 75)
                        mean_val = feat_data.mean()
                        stats_cell = f"Q1: {q1:.2f}<br>Avg: {mean_val:.2f}<br>Q3: {q3:.2f}"
                    except Exception:
                        stats_cell = 'N/A'
        
        feature_stats_rows.append(f"""
        <tr style="{highlight_style}">
            <td>{feat_name}</td>
            <td>{feat_info.get('dtype', 'unknown')}</td>
            <td>{feat_info.get('unique_count', 'N/A')}</td>
            <td>{populated:.1f}%</td>
            <td style="font-size: 14px;">{', '.join([str(v) for v in feat_info.get('sample_values', [])[:3]])}</td>
            <td style="font-size: 13px;">{stats_cell}</td>
        </tr>
        """)
    
    # Format metric values for display
    precision_str = f"{meta.get('precision'):.3f}" if meta.get('precision') is not None else 'N/A'
    recall_str = f"{meta.get('recall'):.3f}" if meta.get('recall') is not None else 'N/A'
    f1_str = f"{meta.get('f1'):.3f}" if meta.get('f1') is not None else 'N/A'
    auc_str = f"{meta.get('auc'):.3f}" if meta.get('auc') is not None else 'N/A'
    
    # Build HTML
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Model Card</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Courier New', monospace; background: #fff; color: #000; line-height: 1.4; }}
        .page {{ max-width: 1400px; margin: 0 auto; padding: 40px; }}
        
        .header {{ border-bottom: 4px solid #000; padding-bottom: 20px; margin-bottom: 30px; }}
        .header h1 {{ font-size: 36px; font-weight: bold; letter-spacing: -1px; }}
        .header .meta {{ font-size: 14px; margin-top: 8px; }}
        
        .section {{ margin: 30px 0; page-break-inside: avoid; }}
        .section-title {{ font-size: 18px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 15px; letter-spacing: 1px; }}
        
        .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 15px 0; }}
        .metric {{ border: 1px solid #000; padding: 12px; }}
        .metric-label {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }}
        .metric-value {{ font-size: 24px; font-weight: bold; }}
        
        table {{ width: 100%; border-collapse: collapse; font-size: 14px; margin: 15px 0; }}
        th {{ background: #000; color: #fff; padding: 10px; text-align: left; font-weight: bold; font-size: 13px; text-transform: uppercase; }}
        td {{ border-bottom: 1px solid #ccc; padding: 8px 10px; }}
        tr:hover {{ background: #f5f5f5; }}
        .technical-appendix tr:hover {{ background: #3a3a3a !important; }}
        
        .stat-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 14px; }}
        .stat-item {{ border-left: 3px solid #000; padding-left: 10px; }}
        .stat-item .label {{ font-weight: bold; }}
        
            @media print {{ 
                @page {{ size: letter; margin: 0.75in; }}
                .page {{ padding: 0; max-width: 100%; }}
                .section {{ page-break-inside: avoid; }}
                
                /* Page breaks for major sections */
                .header {{ page-break-after: always; }}
                .section:has(.section-title:contains("Technical")) {{ page-break-before: always; }}
                
                /* Override dark mode for printing */
                .section[style*="background: #2b2b2b"] {{ background: #fff !important; color: #000 !important; }}
                table[style*="color: #d0d0d0"] {{ color: #000 !important; }}
                th[style*="background: #3a3a3a"] {{ background: #f5f5f5 !important; color: #000 !important; }}
                h3[style*="color: #fff"] {{ color: #000 !important; }}
                .section-title[style*="color: #fff"] {{ color: #000 !important; border-bottom-color: #000 !important; }}
                
                /* Better print layout */
                table {{ font-size: 10pt; }}
                .metric-grid {{ grid-template-columns: repeat(2, 1fr) !important; }}
                .header {{ background: #fff !important; color: #000 !important; padding: 40px 0 !important; }}
                .header h1 {{ color: #000 !important; }}
                .header .subtitle {{ color: #666 !important; }}
            }}
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1>MODEL CARD</h1>
            <div class="meta">
                <strong>Session:</strong> {meta['session_id']} &nbsp;|&nbsp; 
                <strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')} &nbsp;|&nbsp; 
                <strong>Status:</strong> {meta.get('predictor_status', meta['status']).upper()}
            </div>
        </div>
        
        <!-- MODEL IDENTIFICATION -->
        <div class="section">
            <div class="section-title">Model Identification</div>
            <div class="grid">
                <div class="metric">
                    <div class="metric-label">Session ID</div>
                    <div class="metric-value" style="font-size: 18px;">{session_id[:20]}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Compute Cluster</div>
                    <div class="metric-value">{meta['compute_cluster'].upper()}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Training Date</div>
                    <div class="metric-value" style="font-size: 18px;">{meta['created_at'][:10]}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Predictor Status</div>
                    <div class="metric-value">{meta.get('predictor_status', 'DONE').upper()}</div>
                </div>
            </div>
        </div>
        
        <!-- TRAINING DATA -->
        <div class="section">
            <div class="section-title">Training Dataset</div>
            <div class="grid">
                <div class="metric">
                    <div class="metric-label">Training Rows</div>
                    <div class="metric-value">{meta['training_rows']:,}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Total Features</div>
                    <div class="metric-value">{meta['training_cols']}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Target Column</div>
                    <div class="metric-value" style="font-size: 18px;">{meta['target_column']}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Target Type</div>
                    <div class="metric-value">{meta.get('target_type', 'CATEGORICAL').upper()}</div>
                </div>
            </div>
        </div>
        
        <!-- MODEL METRICS -->
        <div class="section">
            <div class="section-title">Model Performance Metrics</div>
            <div class="grid">
                <div class="metric">
                    <div class="metric-label">Precision</div>
                    <div class="metric-value">{precision_str}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Recall</div>
                    <div class="metric-value">{recall_str}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">F1 Score</div>
                    <div class="metric-value">{f1_str}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">AUC</div>
                    <div class="metric-value">{auc_str}</div>
                </div>
            </div>
        </div>
        
        <!-- FEATURE INVENTORY -->
        <div class="section">
            <div class="section-title" style="cursor: pointer;" onclick="toggleFeatures()">
                Feature Inventory (Top 50) <span id="toggle-icon">▼</span>
            </div>
            <div id="feature-table" style="display: none;">
                <table>
                    <thead>
                        <tr>
                            <th>Feature Name</th>
                            <th>Data Type</th>
                            <th>Unique Values</th>
                            <th>Population %</th>
                            <th>Sample Values</th>
                            <th>Statistics</th>
                        </tr>
                    </thead>
                    <tbody>
                        {''.join(feature_stats_rows)}
                    </tbody>
                </table>
            </div>
        </div>
        
        <script>
        function toggleFeatures() {{
            var table = document.getElementById('feature-table');
            var icon = document.getElementById('toggle-icon');
            if (table.style.display === 'none') {{
                table.style.display = 'block';
                icon.textContent = '▲';
            }} else {{
                table.style.display = 'none';
                icon.textContent = '▼';
            }}
        }}
        </script>
        
        <!-- PREDICTION RESULTS -->
        <div class="section">
            <div class="section-title">Prediction Results</div>
            
            <h3 style="margin: 15px 0 10px 0; font-size: 16px;">Prediction Data Provenance</h3>
            <table>
                <tr><th style="width: 250px;">Property</th><th>Value</th></tr>
                <tr><td>Prediction File</td><td>{csv_file}</td></tr>
                <tr><td>File MD5 Hash</td><td style="font-family: monospace; font-size: 14px;">{file_md5}</td></tr>
                <tr><td>Rows</td><td>{len(df)}</td></tr>
                <tr><td>Columns</td><td>{len(df.columns)}</td></tr>
                <tr><td>Column Names</td><td style="font-size: 14px;">{', '.join(df.columns.tolist())}</td></tr>
            </table>
            
            <h3 style="margin: 20px 0 10px 0; font-size: 16px;">Test Set</h3>
            <div class="grid">
                <div class="metric">
                    <div class="metric-label">Total Predictions</div>
                    <div class="metric-value">{len(df)}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Class Vocabulary</div>
                    <div class="metric-value" style="font-size: 14px;">{{{', '.join([str(c) for c in classes])}}}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Avg Confidence</div>
                    <div class="metric-value">{(df[prob_cols].max(axis=1).mean() if prob_cols else 0):.1%}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">High Conf (>80%)</div>
                    <div class="metric-value">{(df[prob_cols].max(axis=1) > 0.8).sum() if prob_cols else 0} / {len(df)}</div>
                </div>
            </div>
        </div>
        
        <!-- CLASS DISTRIBUTION -->
        <div class="section">
            <div class="section-title">TEST SET DISTRIBUTION</div>
            
            <!-- TEST SET Distribution -->
            <div style="margin: 20px 0;">
                <div style="display: flex; height: 80px; border: 1px solid #333;">
                    {f'<div style="flex: {pred_counts.iloc[0] if len(pred_counts) > 0 else 0}; background: #667eea; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; flex-direction: column;"><div>{pred_counts.index[0] if len(pred_counts) > 0 else ""}</div><div style="font-size: 14px;">{pred_counts.iloc[0] if len(pred_counts) > 0 else 0} ({pred_counts.iloc[0]/len(df)*100:.0f}%)</div></div>' if len(pred_counts) > 0 else ''}
                    {f'<div style="flex: {pred_counts.iloc[1] if len(pred_counts) > 1 else 0}; background: #3a3a3a; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; flex-direction: column;"><div>{pred_counts.index[1] if len(pred_counts) > 1 else ""}</div><div style="font-size: 14px;">{pred_counts.iloc[1] if len(pred_counts) > 1 else 0} ({pred_counts.iloc[1]/len(df)*100:.0f}%)</div></div>' if len(pred_counts) > 1 else ''}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Class</th>
                        <th>Count</th>
                        <th>Percentage</th>
                        <th>Avg Confidence</th>
                    </tr>
                </thead>
                <tbody>
"""
    
    # Add class distribution rows for TEST SET
    for cls in classes:
        subset = df[df['predicted_is_bad_account'] == cls]
        prob_col = f'pred_{cls}'
        avg_conf = subset[prob_col].mean() if prob_col in df.columns else 0
        html += f"""
                    <tr>
                        <td><strong>{cls}</strong></td>
                        <td>{len(subset)}</td>
                        <td>{len(subset)/len(df)*100:.1f}%</td>
                        <td>{avg_conf:.1%}</td>
                    </tr>
"""
    
    html += f"""
                </tbody>
            </table>
        </div>
        
        <!-- VALIDATION SET DISTRIBUTION -->
        <div class="section">
            <div class="section-title">Validation Set Distribution</div>
"""
    
    # Add VALIDATION SET distribution if available
    val_dist = meta.get('validation_distribution')
    if val_dist:
        html += f"""
            <div style="margin: 20px 0;">
                <div style="display: flex; height: 80px; border: 1px solid #333;">
"""
        # Calculate total for percentages
        val_total = sum(val_dist.values()) if isinstance(val_dist, dict) else 0
        val_sorted = sorted(val_dist.items()) if isinstance(val_dist, dict) else []
        
        for i, (cls, count) in enumerate(val_sorted):
            pct = (count / val_total * 100) if val_total > 0 else 0
            bg_color = '#667eea' if i == 0 else '#3a3a3a'
            html += f"""
                    <div style="flex: {count}; background: {bg_color}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; flex-direction: column;"><div>{cls}</div><div style="font-size: 14px;">{count} ({pct:.0f}%)</div></div>
"""
        
        html += f"""
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Class</th>
                        <th>Count</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
"""
        for cls, count in val_sorted:
            pct = (count / val_total * 100) if val_total > 0 else 0
            html += f"""
                    <tr>
                        <td><strong>{cls}</strong></td>
                        <td>{count}</td>
                        <td>{pct:.1f}%</td>
                    </tr>
"""
        html += f"""
                </tbody>
            </table>
"""
    else:
        html += f"""
            <p style="margin: 20px 0; font-size: 13px; color: #666; font-style: italic;">
                Validation set distribution not available in training metrics.
            </p>
"""
    
    html += f"""
        </div>
        
        <!-- PROBABILITY STATISTICS -->
        <div class="section">
            <div class="section-title">Probability Statistics by Class</div>
            <div class="stat-grid">
"""
    
    for col in prob_cols:
        vals = df[col].dropna()
        if len(vals) > 0:
            import html as html_escape
            class_name = col.replace('pred_', '')
            class_name_escaped = html_escape.escape(class_name)
            
            html += f"""
                <div class="stat-item">
                    <div class="label">Class {class_name_escaped}:</div>
                    Mean={vals.mean():.3f}, Median={vals.median():.3f}, Std={vals.std():.3f}<br>
                    Min={vals.min():.3f}, Max={vals.max():.3f}, Q25={vals.quantile(0.25):.3f}, Q75={vals.quantile(0.75):.3f}
                </div>
"""
    
    html += f"""
            </div>
        </div>
        
        <!-- CONFUSION MATRIX -->
        <div class="section">
            <div class="section-title">Confusion Matrix</div>
            
            <div style="display: flex; gap: 30px; align-items: flex-start; flex-wrap: wrap;">
                <div style="flex: 0 0 auto;">
                    <table style="width: 450px; text-align: center; font-size: 20px; border: 2px solid #666;">
                        <tr>
                            <th style="padding: 15px; background: #444; color: #fff; border: 1px solid #666; font-size: 16px;"></th>
                            <th style="padding: 15px; background: #444; color: #fff; border: 1px solid #666; font-size: 16px;">TN</th>
                            <th style="padding: 15px; background: #444; color: #fff; border: 1px solid #666; font-size: 16px;">FP</th>
                        </tr>
                        <tr>
                            <th style="padding: 15px; background: #444; color: #fff; border: 1px solid #666; font-size: 16px;">TN</th>
                            <td style="padding: 15px; background: #5a8a6a; color: #fff; font-size: 28px; font-weight: bold; border: 2px solid #666; vertical-align: middle;">
                                <div style="font-size: 36px; margin-bottom: 5px;">{cm.get('tn', 0)}</div>
                                <div style="font-size: 10px; opacity: 0.9; margin-top: 5px; line-height: 1.3;">
                                    {f"Mean: {cm_confidence_stats.get('tn', {}).get('mean', 0):.2f}" if cm_confidence_stats.get('tn', {}).get('mean') is not None else ""}<br>
                                    {f"95% CI: [{cm_confidence_stats.get('tn', {}).get('ci_lower', 0):.2f}, {cm_confidence_stats.get('tn', {}).get('ci_upper', 0):.2f}]" if cm_confidence_stats.get('tn', {}).get('ci_lower') is not None else ""}
                                </div>
                            </td>
                            <td style="padding: 15px; background: #d67a6a; color: #fff; font-size: 28px; font-weight: bold; border: 2px solid #666; vertical-align: middle;">
                                <div style="font-size: 36px; margin-bottom: 5px;">{cm.get('fp', 0)}</div>
                                <div style="font-size: 10px; opacity: 0.9; margin-top: 5px; line-height: 1.3;">
                                    {f"Mean: {cm_confidence_stats.get('fp', {}).get('mean', 0):.2f}" if cm_confidence_stats.get('fp', {}).get('mean') is not None else "Mean: N/A"}<br>
                                    {f"95% CI: [{cm_confidence_stats.get('fp', {}).get('ci_lower', 0):.2f}, {cm_confidence_stats.get('fp', {}).get('ci_upper', 0):.2f}]" if cm_confidence_stats.get('fp', {}).get('ci_lower') is not None else "95% CI: N/A"}
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <th style="padding: 15px; background: #444; color: #fff; border: 1px solid #666; font-size: 16px;">FN</th>
                            <td style="padding: 15px; background: #e67a6a; color: #fff; font-size: 28px; font-weight: bold; border: 2px solid #666; vertical-align: middle;">
                                <div style="font-size: 42px; margin-bottom: 5px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">{cm.get('fn', 0)}</div>
                                <div style="font-size: 10px; opacity: 0.95; margin-top: 5px; font-weight: bold; line-height: 1.3;">
                                    {f"Mean: {cm_confidence_stats.get('fn', {}).get('mean', 0):.2f}" if cm_confidence_stats.get('fn', {}).get('mean') is not None else "Mean: N/A"}<br>
                                    {f"95% CI: [{cm_confidence_stats.get('fn', {}).get('ci_lower', 0):.2f}, {cm_confidence_stats.get('fn', {}).get('ci_upper', 0):.2f}]" if cm_confidence_stats.get('fn', {}).get('ci_lower') is not None else "95% CI: N/A"}
                                </div>
                            </td>
                            <td style="padding: 15px; background: #5a8a6a; color: #fff; font-size: 28px; font-weight: bold; border: 2px solid #666; vertical-align: middle;">
                                <div style="font-size: 36px; margin-bottom: 5px;">{cm.get('tp', 0)}</div>
                                <div style="font-size: 10px; opacity: 0.9; margin-top: 5px; line-height: 1.3;">
                                    {f"Mean: {cm_confidence_stats.get('tp', {}).get('mean', 0):.2f}" if cm_confidence_stats.get('tp', {}).get('mean') is not None else ""}<br>
                                    {f"95% CI: [{cm_confidence_stats.get('tp', {}).get('ci_lower', 0):.2f}, {cm_confidence_stats.get('tp', {}).get('ci_upper', 0):.2f}]" if cm_confidence_stats.get('tp', {}).get('ci_lower') is not None else ""}
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <div style="flex: 1 1 300px; padding: 15px; background: #f9f9f9; border-left: 3px solid #000; font-size: 14px; line-height: 1.6; font-family: 'Courier New', monospace;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; text-transform: uppercase;">Understanding the Confusion Matrix</h3>
                    <p style="margin: 0 0 12px 0; font-size: 14px;">
                        This model predicts binary outcomes for the <strong>{meta.get('target_column', 'is_bad_account')}</strong> target:
                    </p>
                    <ul style="margin: 0 0 12px 0; padding-left: 20px; font-size: 14px;">
                        <li style="font-size: 14px;"><strong>0</strong> = Good account (not flagged as bad)</li>
                        <li style="font-size: 14px;"><strong>1</strong> = Bad account (flagged as high risk)</li>
                    </ul>
                    <p style="margin: 0 0 12px 0; font-size: 14px;">
                        The confusion matrix compares predicted values (columns) against actual values (rows). 
                        <span style="background: #5a8a6a; color: #fff; padding: 2px 4px; font-size: 14px;">Green cells</span> indicate correct predictions, 
                        while <span style="background: #d67a6a; color: #fff; padding: 2px 4px; font-size: 14px;">red cells</span> indicate prediction errors.
                    </p>
                    <p style="margin: 0 0 12px 0; padding: 10px; background: #fff3cd; border-left: 4px solid #e67a6a; font-weight: bold; font-size: 14px;">
                        <strong>Model Context:</strong> Predicting a BAD account as GOOD (False Negatives) represents the highest risk scenario, 
                        as missing high-risk accounts can lead to significant financial exposure.
                    </p>
                    <p style="margin: 0; font-size: 14px;">
                        <strong>True Positives</strong> (bottom-right): Correctly identified bad accounts.<br>
                        <strong>True Negatives</strong> (top-left): Correctly identified good accounts.<br>
                        <strong>False Positives</strong> (top-right): Good accounts incorrectly flagged as bad (less critical).<br>
                        <strong style="color: #e67a6a; font-size: 14px;">False Negatives</strong> (bottom-left): <span style="background: #e67a6a; color: #fff; padding: 2px 4px; font-weight: bold; font-size: 14px;">Bad accounts missed by the model - THIS IS THE WORST CASE</span>
                    </p>
                    <p style="margin: 12px 0 0 0; font-size: 14px; color: #666;">
                        Each cell shows the count and confidence distribution (mean ± std) for predictions in that category.
                    </p>
                </div>
            </div>
        </div>
        
        <!-- CONFIDENCE BREAKDOWN -->
        <div class="section">
            <div class="section-title">Confidence Breakdown</div>
            <table style="border: 2px solid #000; border-collapse: collapse;">
                <thead>
                    <tr>
                        <th style="background: #000; color: #fff; padding: 14px; border: 1px solid #000; font-size: 15px;">Confidence Range</th>
                        <th style="background: #000; color: #fff; padding: 14px; border: 1px solid #000; font-size: 15px;">Count</th>
                        <th style="background: #000; color: #fff; padding: 14px; border: 1px solid #000; font-size: 15px;">Percentage</th>
                    </tr>
                </thead>
                <tbody>
"""
    
    max_conf = df[prob_cols].max(axis=1) if prob_cols else pd.Series([0]*len(df))
    bins = [
        ('90-100%', (max_conf >= 0.9).sum()),
        ('80-90%', ((max_conf >= 0.8) & (max_conf < 0.9)).sum()),
        ('70-80%', ((max_conf >= 0.7) & (max_conf < 0.8)).sum()),
        ('60-70%', ((max_conf >= 0.6) & (max_conf < 0.7)).sum()),
        ('<60% (Low)', (max_conf < 0.6).sum()),
    ]
    
    for i, (label, count) in enumerate(bins):
        row_bg = '#f9f9f9' if i % 2 == 0 else '#ffffff'
        html += f"""
                    <tr style="background: {row_bg};">
                        <td style="padding: 12px; border: 1px solid #000; font-weight: bold; font-size: 15px;">{label}</td>
                        <td style="padding: 12px; border: 1px solid #000; text-align: right; font-size: 15px;">{count}</td>
                        <td style="padding: 12px; border: 1px solid #000; text-align: right; font-size: 15px;">{count/len(df)*100:.1f}%</td>
                    </tr>
"""
    
    html += f"""
                </tbody>
            </table>
        </div>
        
        <!-- TECHNICAL APPENDIX (DARK MODE) -->
        <div class="section" style="margin-top: 50px; border-top: 3px solid #000; padding: 30px; background: #2b2b2b; color: #d0d0d0; font-size: 15px;">
            <style>
                .technical-appendix table tr {{ background: #2b2b2b !important; }}
                .technical-appendix table tr:hover {{ background: #3a3a3a !important; transition: background 0.2s ease; }}
            </style>
            <div class="section-title" style="color: #667eea; border-bottom-color: #667eea; font-size: 20px;">Technical Appendix</div>
            
            <h3 style="margin: 20px 0 10px 0; font-size: 17px; color: #667eea;">Model Architecture</h3>
            <table class="technical-appendix" style="color: #d0d0d0; font-size: 15px;">
                <tr><th style="width: 250px; background: #3a3a3a; color: #fff; font-size: 15px;">Component</th><th style="background: #3a3a3a; color: #fff; font-size: 15px;">Details</th></tr>
                <tr><td>Model Type</td><td>Deep Neural Network (Two-Stage Architecture)</td></tr>
                <tr><td>AI Framework</td><td>FeatrixSphere v0.2.304+</td></tr>
                <tr><td>Embedding Space</td><td>{meta.get('embedding_space_id', 'N/A')}</td></tr>
                <tr><td>Predictor Model</td><td>{meta.get('predictor_job_id', 'N/A')}</td></tr>
            </table>
            
            <h3 style="margin: 20px 0 10px 0; font-size: 17px; color: #667eea;">Training Configuration</h3>
            
            <!-- Charts removed - metrics shown in table below -->
            
            <table class="technical-appendix" style="color: #d0d0d0; font-size: 15px;">
                <tr><th style="width: 250px; background: #3a3a3a; color: #fff; font-size: 15px;">Parameter</th><th style="background: #3a3a3a; color: #fff; font-size: 15px;">Value</th></tr>
                <tr><td>Training Dataset Size</td><td>{meta['training_rows']:,} records</td></tr>
                <tr><td>Features Analyzed</td><td>{meta['training_cols']} data points per record</td></tr>
                <tr><td>Prediction Target</td><td>{meta['target_column']}</td></tr>
                <tr><td>Model Training Date</td><td>{meta['created_at'][:10] if meta.get('created_at') else 'N/A'}</td></tr>
                <tr><td>Training Infrastructure</td><td>Cloud GPU ({meta['compute_cluster'].upper()})</td></tr>
                <tr><td>Hyperparameters</td><td>Auto-determined by FeatrixSphere</td></tr>
                <tr><td>Training Status</td><td>{meta.get('status', 'unknown').upper()}{' (Early stopped - budget limit)' if meta.get('status') != 'done' else ''}</td></tr>
                <tr><td>Total Epochs</td><td>{meta.get('epochs', 0)}</td></tr>
            </table>
            
            <h3 style="margin: 20px 0 10px 0; font-size: 17px; color: #667eea;">Inference Performance</h3>
            <table class="technical-appendix" style="color: #d0d0d0; font-size: 15px;">
                <tr><th style="width: 250px; background: #3a3a3a; color: #fff; font-size: 15px;">Metric</th><th style="background: #3a3a3a; color: #fff; font-size: 15px;">Value</th></tr>
                <tr><td>Prediction Throughput</td><td>{perf_metrics.get('predictions_per_sec', 0):.1f} predictions/second</td></tr>
                <tr><td>Roundtrip Latency</td><td>{perf_metrics.get('prediction_time_sec', 0):.2f} seconds</td></tr>
                <tr><td>Inference Infrastructure</td><td>Cloud GPU ({perf_metrics.get('compute_cluster', 'unknown').upper()})</td></tr>
            </table>
            
            <h3 style="margin: 20px 0 10px 0; font-size: 17px; color: #667eea;">Data Processing Pipeline</h3>
            <table class="technical-appendix" style="color: #d0d0d0; font-size: 15px;">
                <tr><th style="width: 250px; background: #3a3a3a; color: #fff; font-size: 15px;">Stage</th><th style="background: #3a3a3a; color: #fff; font-size: 15px;">Description</th></tr>
                <tr><td>Data Enrichment</td><td>AlphaLoop's Proprietary Multi-Source Data Enrichment</td></tr>
                <tr><td>Feature Engineering</td><td>Advanced statistical feature selection and optimization</td></tr>
                <tr><td>Privacy & Security</td><td>PII removal and data anonymization protocols applied</td></tr>
            </table>
            
            <h3 style="margin: 20px 0 10px 0; font-size: 17px; color: #667eea;">Training Data</h3>
            <table class="technical-appendix" style="color: #d0d0d0; font-size: 15px;">
                <tr><th style="width: 250px; background: #3a3a3a; color: #fff; font-size: 15px;">Dataset</th><th style="background: #3a3a3a; color: #fff; font-size: 15px;">Description</th></tr>
                <tr><td>AI Training Data</td><td>671,000 carrier records with comprehensive operational and safety metrics</td></tr>
                <tr><td>Labels</td><td>dot_number + {meta['target_column']}</td></tr>
            </table>
            
            <h3 style="margin: 20px 0 10px 0; font-size: 17px; color: #667eea;">Model Limitations</h3>
            <table class="technical-appendix" style="color: #d0d0d0; font-size: 15px;">
                <tr><th style="width: 250px; background: #3a3a3a; color: #fff; font-size: 15px;">Limitation</th><th style="background: #3a3a3a; color: #fff; font-size: 15px;">Description</th></tr>
                <tr><td>Training Data Size</td><td>Limited labeled training set - may affect generalization to edge cases</td></tr>
                <tr><td>Data License</td><td>Small subset of AlphaLoop Data Used (AlphaLoop Basic AI License)</td></tr>
                <tr><td>Compute Budget</td><td>Limited training time (500 training credits) - additional training could improve accuracy</td></tr>
            </table>
        </div>
        
        <!-- FOOTER -->
        <div class="section" style="margin-top: 30px; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 15px;">
            <p><strong>Prediction File:</strong> {csv_file} | <strong>Total Predictions:</strong> {len(df)} | <strong>Report Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}</p>
            <p><strong>Model Framework:</strong> FeatrixSphere v0.2.304+ (Neural Embedding + Classification) | <strong>Backend:</strong> PyTorch | <strong>Deployment:</strong> {socket.gethostname()}</p>
        </div>
    </div>
</body>
</html>
"""
    
    with open(output_html, 'w') as f:
        f.write(html)
    
    print(f"✅ Professional model card saved to: {output_html}")
    return output_html


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python3 generate_model_card.py <predictions.csv> <session_id>")
        sys.exit(1)
    
    generate_model_card(sys.argv[1], sys.argv[2])

