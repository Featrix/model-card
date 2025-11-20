# Featrix Sphere Model Card Renderers

This package provides three renderers for Featrix Sphere Model Card JSON:

1. **HTML Renderer** (`html_renderer.py`) - Static HTML with collapsible sections, expand all functionality, and print-friendly CSS
2. **Text Renderer** (`text_renderer.py`) - Plain text output in both brief and detailed formats
3. **React Component** (`ModelCard.tsx`) - Dynamic React component with interactive charts and graphs

## HTML Renderer

### Features
- Uses `<details>` and `<summary>` elements for collapsible sections
- "Expand All" and "Collapse All" buttons
- Print-friendly CSS that formats nicely on a single page
- Responsive design
- Color-coded status badges, quality assessments, and warning severities

### Usage

```python
from renderers import render_html_to_file
import json

# Load model card JSON
with open('model_card.json', 'r') as f:
    model_card = json.load(f)

# Generate HTML
render_html_to_file(model_card, 'output.html')
```

### Functions
- `render_html(model_card_json: Dict[str, Any]) -> str` - Returns HTML string
- `render_to_file(model_card_json: Dict[str, Any], output_path: str) -> str` - Saves HTML to file

## Text Renderer

### Features
- Brief version: Summary of key information
- Detailed version: Complete model card information
- Clean, readable plain text format

### Usage

```python
from renderers import render_text_to_file
import json

# Load model card JSON
with open('model_card.json', 'r') as f:
    model_card = json.load(f)

# Generate detailed text
render_text_to_file(model_card, 'output_detailed.txt', detailed=True)

# Generate brief text
render_text_to_file(model_card, 'output_brief.txt', detailed=False)
```

### Functions
- `render_brief_text(model_card_json: Dict[str, Any]) -> str` - Returns brief text
- `render_detailed_text(model_card_json: Dict[str, Any]) -> str` - Returns detailed text
- `render_to_file(model_card_json: Dict[str, Any], output_path: str, detailed: bool = True) -> str` - Saves text to file

## React Component

### Features
- Interactive collapsible sections
- Dynamic charts using Recharts:
  - Feature type distribution (pie chart)
  - Classification metrics (bar chart)
  - Column statistics (bar chart for mutual information)
- Expand/Collapse all functionality
- Responsive design
- TypeScript support with full type definitions

### Usage

```tsx
import React from 'react';
import ModelCard, { ModelCardData } from './renderers/ModelCard';

// Load model card JSON
const modelCardData: ModelCardData = {
  // ... model card JSON
};

function App() {
  return <ModelCard data={modelCardData} />;
}
```

### Dependencies

The React component requires:
- React
- Recharts (`npm install recharts`)

### Component Props

```typescript
interface ModelCardProps {
  data: ModelCardData;
  className?: string;
}
```

## Example

See `example_usage.py` for a complete example of using all three renderers.

## Model Card JSON Structure

All renderers expect the Featrix Sphere Model Card JSON format as specified in the documentation. Key sections include:

- `model_identification` - Basic model metadata
- `training_dataset` - Training data information
- `feature_inventory` - Detailed feature information
- `training_configuration` - Hyperparameters
- `training_metrics` - Performance metrics
- `model_architecture` - Neural network structure
- `model_quality` - Quality assessments and warnings
- `technical_details` - Technical implementation details
- `provenance` - Creation metadata
- `column_statistics` - Per-column statistics (Embedding Space only)

## Notes

- All renderers handle `null` values gracefully, displaying "N/A" where appropriate
- Percentages are formatted as decimals (0.0-1.0) in the JSON but displayed as percentages (0-100%) in outputs
- The HTML renderer includes print styles that ensure good formatting when printing to PDF or paper
- The React component is fully typed with TypeScript for better developer experience

