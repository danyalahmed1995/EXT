const fs = require('fs');
const path = require('path');

const dir = 'd:\\AI Work\\EXT_Example_Workspace';

const heavyMdContent = `# Heavy Content Performance Test

This file is designed to be intentionally **massive** and filled with dense content to test the real-time rendering, smooth scrolling, and highlighting engine in EXT.

## 1. Highlighting Engine Showcase

EXT handles rich syntax highlighting incredibly fast. Scroll down to see massive blocks of syntax highlighting across various languages.

### Advanced Rust Concurrency
\`\`\`rust
use std::sync::{Arc, Mutex};
use std::thread;

pub struct ThreadPool {
    workers: Vec<Worker>,
    sender: Option<mpsc::Sender<Job>>,
}

type Job = Box<dyn FnOnce() + Send + 'static>;

impl ThreadPool {
    pub fn new(size: usize) -> ThreadPool {
        assert!(size > 0);
        let (sender, receiver) = mpsc::channel();
        let receiver = Arc::new(Mutex::new(receiver));
        let mut workers = Vec::with_capacity(size);

        for id in 0..size {
            workers.push(Worker::new(id, Arc::clone(&receiver)));
        }

        ThreadPool {
            workers,
            sender: Some(sender),
        }
    }

    pub fn execute<F>(&self, f: F)
    where
        F: FnOnce() + Send + 'static,
    {
        let job = Box::new(f);
        self.sender.as_ref().unwrap().send(job).unwrap();
    }
}
\`\`\`

### Advanced TypeScript React Patterns
\`\`\`tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';

type ComplexData = {
  id: string;
  payload: Record<string, any>;
  timestamp: number;
};

interface Props {
  data: ComplexData[];
  onAction: (id: string) => void;
}

export const DataGrid: React.FC<Props> = ({ data, onAction }) => {
  const [filter, setFilter] = useState('');

  const filteredData = useMemo(() => {
    if (!filter) return data;
    return data.filter(d => d.id.includes(filter));
  }, [data, filter]);

  const handleRowClick = useCallback((id: string) => {
    console.log('Action on', id);
    onAction(id);
  }, [onAction]);

  return (
    <div className="grid-container">
      <input type="text" value={filter} onChange={e => setFilter(e.target.value)} />
      {filteredData.map(item => (
        <div key={item.id} onClick={() => handleRowClick(item.id)}>
          {item.timestamp}: {JSON.stringify(item.payload)}
        </div>
      ))}
    </div>
  );
};
\`\`\`

## 2. Image Rendering Showcase

Here is a showcase of how EXT beautifully renders local images in the preview mode. You can drag and drop images or reference them via local relative paths!

![Beautiful Futuristic Cover Art](./cover.png)

> **Note:** The image above is loaded directly from your local workspace (\`cover.png\`). EXT parses local relative paths correctly inside the workspace sandbox!

## 3. Massive Text Payload

To truly stress-test the editor's scroll and syntax highlighting engine, here is a massive payload of repetitive content:

` + Array(50).fill(`### Section {i}
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

\`\`\`javascript
function test{i}() {
  for (let x = 0; x < 1000; x++) {
    console.log("EXT is blazing fast. Testing iteration", x, "in block {i}");
  }
}
\`\`\`
`).map((text, i) => text.replace(/\{i\}/g, i)).join('\n') + `

---
**End of Heavy File**
`;

const imagesAndHighlightingMd = `# Images and Highlight Section

This document specifically highlights two core features:
1. **Local Image Previews**
2. **Text & Syntax Highlighting**

## Local Image Preview

If you place an image in the same directory as your markdown file, you can preview it instantly:

![Cover Image](./cover.png)

## The Highlight Engine

EXT includes custom editor themes \`extEditorTheme\` and \`extHighlightStyle\` using the \`@codemirror/language-data\` pack to colorize text seamlessly.

**Python Highlight Test:**
\`\`\`python
class NeuralNetwork:
    def __init__(self, layers):
        self.layers = layers
        self.weights = [np.random.randn(y, x) for x, y in zip(layers[:-1], layers[1:])]
        
    def forward(self, a):
        for w in self.weights:
            a = sigmoid(np.dot(w, a))
        return a
\`\`\`

**HTML/CSS Highlight Test:**
\`\`\`html
<style>
  .btn-primary {
    background: linear-gradient(135deg, #FF6B6B, #C06C84);
    border-radius: 8px;
    padding: 12px 24px;
    color: white;
    font-weight: 600;
  }
</style>
<button class="btn-primary">Click Me</button>
\`\`\`

*EXT keeps everything smooth!*
`;

// Helper to ensure CRLF line endings
const ensureCRLF = (str) => str.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

fs.writeFileSync(path.join(dir, 'Heavy_Content_Performance.md'), ensureCRLF(heavyMdContent));
fs.writeFileSync(path.join(dir, 'Images_and_Highlighting.md'), ensureCRLF(imagesAndHighlightingMd));

console.log('Heavy workspace examples populated!');
