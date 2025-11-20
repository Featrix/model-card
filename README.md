# Featrix Model Card Renderers

Render Featrix Sphere Model Card JSON to HTML, plain text, or React components.

## Overview

This repository contains three renderers for Featrix Sphere Model Card JSON:

1. **Python Package** (`python/`) - For pip installation
2. **JavaScript** (`javascript/`) - Standalone JS for `<script>` tag usage
3. **React Component** (`react/`) - For npm installation

## Quick Start

### Python Package

```bash
pip install featrix-modelcard
```

```python
from featrix_modelcard import render_html, render_detailed_text, print_text
import json

# Load model card JSON
with open('model_card.json') as f:
    model_card = json.load(f)

# Print brief summary to console
print_text(model_card, detailed=False)

# Generate HTML file
from featrix_modelcard import render_html_to_file
render_html_to_file(model_card, 'output.html')

# Get HTML as string
html = render_html(model_card)
```

### JavaScript (Standalone)

```html
<script src="model-card.js"></script>
<script>
    const html = FeatrixModelCard.renderHTML(modelCardJson);
    document.getElementById('container').innerHTML = html;
    FeatrixModelCard.attachEventListeners(document.getElementById('container'));
</script>
```

### React Component

```bash
npm install @featrix/modelcard recharts
```

```tsx
import ModelCard, { ModelCardData } from '@featrix/modelcard';

function App() {
  const modelCard: ModelCardData = { /* ... */ };
  return <ModelCard data={modelCard} />;
}
```

## File Structure

```
model-card/
├── python/              # Python package for pip
│   ├── setup.py
│   ├── publish.sh
│   ├── featrix_modelcard/
│   │   ├── __init__.py
│   │   ├── html_renderer.py
│   │   └── text_renderer.py
│   └── README.md
├── javascript/          # Standalone JS for <script> tag
│   ├── model-card.js
│   ├── index.html
│   └── README.md
└── react/              # React component for npm
    ├── package.json
    ├── publish.sh
    ├── src/
    │   └── ModelCard.tsx
    └── README.md
```

## Features

### HTML Renderer
- ✅ Uses `<details>` and `<summary>` for collapsible sections
- ✅ "Expand All" / "Collapse All" buttons
- ✅ Print-friendly CSS (formats nicely on 1 page)
- ✅ Black & white aesthetic with color-coded status indicators
- ✅ Courier New monospace font
- ✅ Clean, minimal design

### Text Renderer
- ✅ Brief summary format
- ✅ Detailed full format
- ✅ Clean, readable plain text

### React Component
- ✅ Interactive collapsible sections
- ✅ Dynamic charts using Recharts:
  - Feature type distribution (pie chart)
  - Classification metrics (bar chart)
  - Column statistics (bar chart)
- ✅ Expand/Collapse all functionality
- ✅ TypeScript support with full type definitions

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

## Publishing

### PyPI (Python Package)

```bash
cd python
./publish.sh
```

The package will be published as `featrix-modelcard` on PyPI.

### NPM (React Component)

```bash
cd react
./publish.sh
```

The package will be published as `@featrix/modelcard` on npm.

See [PUBLISH.md](PUBLISH.md) for detailed publishing instructions.

## License

MIT
