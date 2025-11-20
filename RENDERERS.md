# Model Card Renderers Overview

This directory contains three renderers for Featrix Sphere Model Card JSON:

## File Structure

```
renderers/
├── __init__.py              # Package initialization
├── html_renderer.py         # Static HTML renderer
├── text_renderer.py         # Plain text renderer (brief & detailed)
├── ModelCard.tsx           # React component with charts
├── ModelCardExample.tsx    # Example React usage
├── package.json            # React component dependencies
└── README.md               # Detailed documentation

example_usage.py            # Python usage examples
```

## Quick Start

### HTML Renderer

```python
from renderers import render_html_to_file
import json

with open('model_card.json') as f:
    data = json.load(f)

render_html_to_file(data, 'output.html')
```

**Features:**
- ✅ Uses `<details>` and `<summary>` for collapsible sections
- ✅ "Expand All" / "Collapse All" buttons
- ✅ Print-friendly CSS (formats nicely on 1 page)
- ✅ Color-coded status badges and warnings

### Text Renderer

```python
from renderers import render_text_to_file

# Detailed version
render_text_to_file(data, 'detailed.txt', detailed=True)

# Brief version
render_text_to_file(data, 'brief.txt', detailed=False)
```

**Features:**
- ✅ Brief summary format
- ✅ Detailed full format
- ✅ Clean, readable plain text

### React Component

```tsx
import ModelCard, { ModelCardData } from './renderers/ModelCard';

function App() {
  const modelCard: ModelCardData = { /* ... */ };
  return <ModelCard data={modelCard} />;
}
```

**Features:**
- ✅ Interactive collapsible sections
- ✅ Dynamic charts (Recharts):
  - Feature type distribution (pie chart)
  - Classification metrics (bar chart)
  - Column statistics (bar chart)
- ✅ Expand/Collapse all functionality
- ✅ TypeScript support with full types

## Installation

### Python Renderers

No additional dependencies required (uses standard library).

### React Component

```bash
npm install recharts
# or
yarn add recharts
```

## Example Outputs

Run the example script to generate sample outputs:

```bash
python example_usage.py
```

This will generate:
- `example_model_card.html` - HTML output
- `example_model_card_detailed.txt` - Detailed text output
- `example_model_card_brief.txt` - Brief text output

## Model Card JSON Format

All renderers expect the Featrix Sphere Model Card JSON format with these sections:

- `model_identification` - Basic metadata
- `training_dataset` - Dataset info
- `feature_inventory` - Feature details
- `training_configuration` - Hyperparameters
- `training_metrics` - Performance metrics
- `model_architecture` - Network structure
- `model_quality` - Quality assessments
- `technical_details` - Technical info
- `provenance` - Creation metadata
- `column_statistics` - Column stats (Embedding Space only)

See the specification document for complete details.

