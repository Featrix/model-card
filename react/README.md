# @featrix/modelcard

React component for rendering Featrix Sphere Model Cards with interactive charts.

## Installation

```bash
npm install @featrix/modelcard recharts
# or
yarn add @featrix/modelcard recharts
```

## Usage

```tsx
import React from 'react';
import ModelCard, { ModelCardData } from '@featrix/modelcard';

function App() {
  const modelCard: ModelCardData = {
    model_identification: {
      session_id: '...',
      job_id: '...',
      name: 'my-model',
      // ... etc
    },
    // ... rest of model card JSON
  };

  return <ModelCard data={modelCard} />;
}
```

## Features

- Interactive collapsible sections
- Dynamic charts using Recharts:
  - Feature type distribution (pie chart)
  - Classification metrics (bar chart)
  - Column statistics (bar chart)
- Expand/Collapse all functionality
- TypeScript support with full type definitions
- Responsive design

## Props

```typescript
interface ModelCardProps {
  data: ModelCardData;
  className?: string;
}
```

## Dependencies

- React (^16.8.0 || ^17.0.0 || ^18.0.0)
- Recharts (^2.0.0)

## Example

See `example/App.tsx` for a complete example.

