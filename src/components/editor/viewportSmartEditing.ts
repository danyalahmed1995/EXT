import { ViewPlugin, ViewUpdate, EditorView } from '@codemirror/view';
import { workerManager } from '../../workers/workerManager';
import type { RangeResult } from '../../workers/workerTypes';

// Exported for autocomplete to consume
export let cachedViewportMetadata: RangeResult | null = null;

export interface ViewportPluginOptions {
  debounceMs: number;
  bufferSize: number;
}

export function createViewportSmartEditingPlugin(fileId: string, options: ViewportPluginOptions) {
  return ViewPlugin.fromClass(class {
    private timeout: ReturnType<typeof setTimeout> | null = null;
    private currentVersion = 0;
    
    constructor(view: EditorView) {
      this.scheduleAnalysis(view);
    }
    
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.currentVersion++;
      }
      
      if (update.docChanged || update.viewportChanged) {
        this.scheduleAnalysis(update.view);
      }
    }
    
    private scheduleAnalysis(view: EditorView) {
      if (this.timeout) clearTimeout(this.timeout);
      
      this.timeout = setTimeout(() => {
        this.analyze(view);
      }, options.debounceMs);
    }
    
    private async analyze(view: EditorView) {
      const { from, to } = view.viewport;
      
      const start = Math.max(0, from - options.bufferSize);
      const end = Math.min(view.state.doc.length, to + options.bufferSize);
      const text = view.state.sliceDoc(start, end);
      
      const captureVersion = this.currentVersion;
      
      try {
        const result = await workerManager.analyzeRange(fileId, captureVersion, text, start, end);
        
        // Stale check
        if (this.currentVersion === captureVersion && result.fileId === fileId) {
          cachedViewportMetadata = result;
        }
      } catch (err) {
        // Ignored or logged
      }
    }
    
    destroy() {
      if (this.timeout) clearTimeout(this.timeout);
      cachedViewportMetadata = null;
    }
  });
}
