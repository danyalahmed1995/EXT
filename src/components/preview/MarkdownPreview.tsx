import React, { useEffect, useState, useRef, useCallback, useMemo, UIEvent } from 'react';
import DOMPurify from 'dompurify';
import { convertFileSrc } from '@tauri-apps/api/core';
import MarkdownWorker from '../../workers/markdown.worker?worker';
import type { SourceBlock } from '../../utils/blockIndexer';
import 'katex/dist/katex.min.css';
import './MarkdownPreview.css';

// --- Global Shared Worker ---
let globalWorker: Worker | null = null;
try {
  globalWorker = new MarkdownWorker();
} catch {
  // Worker not available (test environment)
}
let globalRenderIdCounter = 0;
let globalIndexIdCounter = 0;

// ── Constants ────────────────────────────────────────

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1','h2','h3','h4','h5','h6','p','br','hr',
    'strong','em','del','s','a','img',
    'ul','ol','li','table','thead','tbody','tr','th','td',
    'pre','code','blockquote','input','span','div',
    'math','annotation','semantics','mrow','mi','mn','mo','ms',
    'mspace','mtext','menclose','merror','mpadded','mphantom',
    'mroot','msqrt','msub','msup','msubsup','mmultiscripts',
    'mover','munder','munderover','mtable','mtr','mtd',
  ],
  ALLOWED_ATTR: [
    'href','src','alt','title','target',
    'type','checked','disabled','class','style','aria-hidden',
    'mathvariant','encoding','display','xmlns',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|asset|tauri):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

const MAX_RENDERED_BLOCKS = 150;
const SCROLL_SPEED_THRESHOLD = 3;
const SCROLL_SETTLE_DELAY = 150;
const USER_ACTIVITY_PAUSE_MS = 250; 
const CHUNK_SIZE = 100; // Blocks per virtualized chunk

// Polyfill for requestIdleCallback
const requestIdle = window.requestIdleCallback || ((cb: any) => window.setTimeout(() => cb({ timeRemaining: () => 50 }), 1));

// ── Helpers ──────────────────────────────────────────

const processLocalImages = (html: string, basePath?: string): string => {
  if (!basePath || !html.includes('<img')) return html;
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');
  images.forEach((img) => {
    const src = img.getAttribute('src');
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      const isWin = basePath.includes('\\');
      const sep = isWin ? '\\' : '/';
      const dirPath = basePath.substring(0, basePath.lastIndexOf(sep));
      let resultPath = dirPath;
      for (const part of src.split('/')) {
        if (part === '.') continue;
        if (part === '..') {
          const idx = resultPath.lastIndexOf(sep);
          if (idx > 0) resultPath = resultPath.substring(0, idx);
        } else if (part) {
          resultPath += sep + part;
        }
      }
      img.setAttribute('src', convertFileSrc(resultPath));
    }
  });
  return doc.body.innerHTML;
};

// ── Types ────────────────────────────────────────────

interface MarkdownPreviewProps {
  content: string;
  absolutePath?: string;
  isActive?: boolean;
}

interface Chunk {
  id: number;
  blocks: SourceBlock[];
  estimatedHeight: number;
}

// ── Chunked Virtualization Components ────────────────

// A global observer for chunks to avoid prop drilling complex refs
let chunkObserver: IntersectionObserver | null = null;
const initChunkObserver = () => {
  if (chunkObserver) return;
  chunkObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.dispatchEvent(new CustomEvent('chunk-visible'));
      } else {
        e.target.dispatchEvent(new CustomEvent('chunk-hidden'));
      }
    });
  }, { rootMargin: '3000px' }); // Render chunks well before they enter viewport
};

const ChunkComponent = React.memo(({ chunk, blockObserver, previewInstanceId }: { chunk: Chunk, blockObserver: IntersectionObserver | null, previewInstanceId: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    initChunkObserver();
    const el = ref.current;
    if (!el) return;
    
    const onVis = () => setIsVisible(true);
    const onHid = () => setIsVisible(false);
    
    el.addEventListener('chunk-visible', onVis);
    el.addEventListener('chunk-hidden', onHid);
    
    chunkObserver?.observe(el);
    return () => {
      chunkObserver?.unobserve(el);
      el.removeEventListener('chunk-visible', onVis);
      el.removeEventListener('chunk-hidden', onHid);
    };
  }, []);

  // When blocks render, we must register them with the blockObserver
  useEffect(() => {
    if (isVisible && blockObserver && ref.current) {
      const blocks = ref.current.querySelectorAll('[data-block-id]');
      blocks.forEach(b => blockObserver.observe(b));
      return () => {
        blocks.forEach(b => blockObserver.unobserve(b));
      };
    }
  }, [isVisible, blockObserver, chunk.blocks]);

  if (!isVisible) {
    return <div ref={ref} data-chunk-id={`${previewInstanceId}-${chunk.id}`} style={{ minHeight: chunk.estimatedHeight }} className="preview-chunk preview-chunk--placeholder" />;
  }

  return (
    <div ref={ref} data-chunk-id={`${previewInstanceId}-${chunk.id}`} className="preview-chunk">
      {chunk.blocks.map(block => (
        <div
          key={block.id}
          data-block-id={`${previewInstanceId}-${block.id}`}
          className="preview-block preview-block--placeholder"
          style={{ minHeight: block.estimatedHeight }}
        />
      ))}
    </div>
  );
});

// ── Main Component ───────────────────────────────────

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = React.memo(({ content, absolutePath, isActive = true }) => {
  const isMountedRef = useRef(true);
  const previewInstanceId = useMemo(() => Math.random().toString(36).substring(2, 10), []);

  // Async Indexing State (Defers heavy synchronous work to unblock tab switch)
  const [blocks, setBlocks] = useState<SourceBlock[]>([]);
  const [isIndexing, setIsIndexing] = useState(true);

  // Math-heavy detection — short-circuit for large files to avoid O(n) regex on 5MB strings during render
  const isHeavy = useMemo(() => {
    if (content.length > 500000) return true;
    // For smaller files, count $ signs efficiently
    let count = 0;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 36) count++; // '$' = 36
      if (count > 200) return true;
    }
    return false;
  }, [content]);
  
  const maxInFlight = isHeavy ? 1 : 4;

  // UI State
  const [isManualMode, setIsManualMode] = useState(isHeavy);
  const [hasStartedRender, setHasStartedRender] = useState(!isHeavy);
  const [isFastScrolling, setIsFastScrolling] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [uiPaused, setUiPaused] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [cachedCount, setCachedCount] = useState(0);

  // Refs
  const previewRef      = useRef<HTMLDivElement>(null);
  const renderIdRef     = useRef(++globalRenderIdCounter);
  const pendingRef      = useRef(new Set<number>());
  const observerRef     = useRef<IntersectionObserver | null>(null);
  const [observerInstance, setObserverInstance] = useState<IntersectionObserver | null>(null);
  
  const visibleBlocksRef     = useRef(new Set<number>());
  const lastScrollRef        = useRef({ top: 0, time: performance.now() });
  const scrollSettleTimerRef = useRef<number | null>(null);

  const renderedRef     = useRef<Map<number, string>>(new Map());
  const blocksRef       = useRef(blocks);
  const isFastScrollingRef = useRef(isFastScrolling);
  const isEditorFocusedRef = useRef(isEditorFocused);
  const isActiveRef = useRef(isActive);

  blocksRef.current   = blocks;
  isFastScrollingRef.current = isFastScrolling;
  isEditorFocusedRef.current = isEditorFocused;
  isActiveRef.current = isActive;

  // Keyboard navigation for preview scrolling
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const activeTag = document.activeElement?.tagName;
        const isEditorFocused = document.activeElement?.closest('.cm-editor');
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || isEditorFocused) {
          return;
        }

        if (e.key === 'PageDown' || e.key === 'PageUp') {
          e.preventDefault();
          const scrollAmount = window.innerHeight * 0.8;
          previewRef.current?.scrollBy({
            top: e.key === 'PageDown' ? scrollAmount : -scrollAmount,
            behavior: 'smooth'
          });
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const scrollAmount = 60;
          previewRef.current?.scrollBy({
            top: e.key === 'ArrowDown' ? scrollAmount : -scrollAmount,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  // Lifecycle Mounted Status & Scroll Reset
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = 0;
    }
  }, [absolutePath]);

  // Async Indexing — runs in the markdown worker so preview never scans a full document on the navigation path.
  const indexVersionRef = useRef(0);
  const indexBytesRef = useRef(0);
  useEffect(() => {
    const indexId = ++globalIndexIdCounter;
    indexVersionRef.current = indexId;
    indexBytesRef.current = content.length;
    renderIdRef.current = ++globalRenderIdCounter;
    pendingRef.current.clear();
    setIsIndexing(true);

    if (!content) {
      setBlocks([]);
      setIsIndexing(false);
      return;
    }

    if (!globalWorker) {
      console.warn('[NavigationPerf] preview worker unavailable; skipping async block indexing');
      setBlocks([]);
      setIsIndexing(false);
      return;
    }

    globalWorker.postMessage({
      type: 'index-blocks',
      indexId,
      content,
    });

    return () => {
      if (indexVersionRef.current === indexId) {
        indexVersionRef.current = ++globalIndexIdCounter;
      }
    };
  }, [content]);

  const chunks = useMemo(() => {
    const result: Chunk[] = [];
    for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
      const chunkBlocks = blocks.slice(i, i + CHUNK_SIZE);
      const height = chunkBlocks.reduce((sum, b) => sum + b.estimatedHeight, 0);
      result.push({ id: Math.floor(i / CHUNK_SIZE), blocks: chunkBlocks, estimatedHeight: height });
    }
    return result;
  }, [blocks]);

  /* ── User Activity & Focus Tracking ──────────── */
  const isUserActiveRef = useRef(false);
  const activityTimerRef = useRef<number | null>(null);

  /* ── Direct DOM Injection (O(1) updates) ──────── */
  const injectBlockHtml = useCallback((blockId: number, safeHtml: string) => {
    if (!isMountedRef.current) return;
    renderedRef.current.set(blockId, safeHtml);
    
    // LRU Eviction
    if (renderedRef.current.size > MAX_RENDERED_BLOCKS) {
      const keys = [...renderedRef.current.keys()];
      const excess = keys.length - MAX_RENDERED_BLOCKS;
      for (let i = 0; i < excess; i++) {
        const dropId = keys[i];
        renderedRef.current.delete(dropId);
        const dropEl = document.querySelector(`[data-block-id="${previewInstanceId}-${dropId}"]`) as HTMLElement;
        if (dropEl) {
          dropEl.innerHTML = '';
          dropEl.classList.remove('preview-block--rendered');
          dropEl.classList.add('preview-block--placeholder');
          const b = blocksRef.current[dropId];
          if (b) dropEl.style.minHeight = `${b.estimatedHeight}px`;
        }
      }
    }
    setCachedCount(renderedRef.current.size);

    const el = document.querySelector(`[data-block-id="${previewInstanceId}-${blockId}"]`) as HTMLElement;
    if (el) {
      el.innerHTML = safeHtml;
      el.classList.remove('preview-block--placeholder');
      el.classList.add('preview-block--rendered');
      el.style.minHeight = '';
    }
  }, [previewInstanceId]);

  /* ── Worker Backpressure & Request Management ── */
  const requestQueueRef = useRef<number[]>([]);
  const inFlightRef = useRef(new Set<number>());

  const pumpWorkerQueue = useCallback(() => {
    if (!isMountedRef.current || !globalWorker || !isActiveRef.current) return;
    
    while (inFlightRef.current.size < maxInFlight && requestQueueRef.current.length > 0) {
      const blockId = requestQueueRef.current.shift()!;
      if (inFlightRef.current.has(blockId)) continue;
      
      const block = blocksRef.current[blockId];
      if (!block) continue;
      
      inFlightRef.current.add(blockId);
      globalWorker.postMessage({
        type: 'render-block',
        renderId: renderIdRef.current,
        blockId,
        source: block.source,
      });
    }
  }, [maxInFlight]);

  const requestBlock = useCallback((blockId: number) => {
    if (!isMountedRef.current || !isActiveRef.current || pendingRef.current.has(blockId)) return;
    if (renderedRef.current.has(blockId)) {
      const html = renderedRef.current.get(blockId);
      const el = document.querySelector(`[data-block-id="${previewInstanceId}-${blockId}"]`) as HTMLElement;
      if (el && el.innerHTML === '' && html) {
        el.innerHTML = html;
        el.classList.remove('preview-block--placeholder');
        el.classList.add('preview-block--rendered');
        el.style.minHeight = '';
      }
      return;
    }

    pendingRef.current.add(blockId);
    setPendingCount(pendingRef.current.size);
    
    if (!requestQueueRef.current.includes(blockId)) {
      requestQueueRef.current.push(blockId);
    }
    pumpWorkerQueue();
  }, [pumpWorkerQueue, previewInstanceId]);

  const evaluateVisibleBlocks = useCallback(() => {
    if (!isMountedRef.current || !isActiveRef.current) return;
    visibleBlocksRef.current.forEach(id => {
      requestBlock(id);
    });
  }, [requestBlock]);

  /* ── Async Purify Queue (Idle + Input-Aware) ──── */
  const purifyQueueRef = useRef<{ blockId: number; html: string }[]>([]);
  const isPurifyingRef = useRef(false);

  const processPurifyQueue = useCallback(() => {
    if (!isMountedRef.current || !isActiveRef.current || purifyQueueRef.current.length === 0) {
      isPurifyingRef.current = false;
      return;
    }
    
    if (isUserActiveRef.current || isFastScrollingRef.current) {
      isPurifyingRef.current = false;
      return; // Paused.
    }
    
    isPurifyingRef.current = true;
    
    requestIdle((deadline: any) => {
      if (!isMountedRef.current || !isActiveRef.current || !renderedRef.current) {
        isPurifyingRef.current = false;
        return; // unmounted or paused
      }
      
      let blocksProcessed = 0;
      
      while (purifyQueueRef.current.length > 0) {
        if (!isMountedRef.current || !isActiveRef.current || isUserActiveRef.current || isFastScrollingRef.current) break; // Pause instantly on input
        if (blocksProcessed > 0 && deadline.timeRemaining() < 5) break;   // Yield if frame budget is low
        
        const { blockId, html } = purifyQueueRef.current.shift()!;
        
        const t0 = performance.now();
        const safe = DOMPurify.sanitize(
          processLocalImages(html, absolutePath),
          PURIFY_CONFIG,
        );
        const t1 = performance.now();
        
        const injectT0 = performance.now();
        injectBlockHtml(blockId, safe);
        const injectT1 = performance.now();
        
        blocksProcessed++;
        
        const totalMs = t1 - t0 + injectT1 - injectT0;
        if (totalMs > 16) {
          console.warn(`[Preview Performance] Block ${blockId} took ${totalMs.toFixed(1)}ms (Sanitize: ${(t1-t0).toFixed(1)}ms, Inject: ${(injectT1-injectT0).toFixed(1)}ms). Expected dropping frames.`);
        }
      }
      
      if (!isMountedRef.current) {
        isPurifyingRef.current = false;
        return;
      }
      
      if (purifyQueueRef.current.length > 0 && !(isUserActiveRef.current || isFastScrollingRef.current)) {
        processPurifyQueue(); // Yield to next frame
      } else {
        isPurifyingRef.current = false;
      }
    }, { timeout: 1000 });
  }, [absolutePath, injectBlockHtml]);

  /* ── Global Activity & Focus Tracking ────────── */
  useEffect(() => {
    // Check if CodeMirror has focus natively
    const checkFocus = () => {
      if (!isMountedRef.current) return;
      const ae = document.activeElement;
      const isCmFocused = ae ? !!ae.closest('.cm-editor') : false;
      if (isEditorFocusedRef.current !== isCmFocused) {
        setIsEditorFocused(isCmFocused);
        if (!isCmFocused && !isPurifyingRef.current && purifyQueueRef.current.length > 0) {
          processPurifyQueue();
        }
      }
    };

    const onActivity = () => {
      if (!isMountedRef.current) return;
      if (!isUserActiveRef.current) {
        isUserActiveRef.current = true;
        setUiPaused(true);
      }
      if (activityTimerRef.current) window.clearTimeout(activityTimerRef.current);
      activityTimerRef.current = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        isUserActiveRef.current = false;
        setUiPaused(false);
        checkFocus(); // update focus state after activity settles
        if (!isPurifyingRef.current && purifyQueueRef.current.length > 0) {
          processPurifyQueue();
        }
        if (!isFastScrollingRef.current) {
          evaluateVisibleBlocks();
          pumpWorkerQueue();
        }
      }, USER_ACTIVITY_PAUSE_MS);
    };
    
    window.addEventListener('keydown', onActivity, true);
    window.addEventListener('mousedown', onActivity, true);
    window.addEventListener('wheel', onActivity, true);
    window.addEventListener('touchstart', onActivity, true);
    document.addEventListener('focusin', checkFocus, true);
    document.addEventListener('focusout', checkFocus, true);
    
    // Initial check
    checkFocus();
    
    return () => {
      window.removeEventListener('keydown', onActivity, true);
      window.removeEventListener('mousedown', onActivity, true);
      window.removeEventListener('wheel', onActivity, true);
      window.removeEventListener('touchstart', onActivity, true);
      document.removeEventListener('focusin', checkFocus, true);
      document.removeEventListener('focusout', checkFocus, true);
      if (activityTimerRef.current) window.clearTimeout(activityTimerRef.current);
    };
  }, [processPurifyQueue]);

  // Restart processing if tab becomes active
  useEffect(() => {
    if (!isMountedRef.current) return;
    if (isActive && !isPurifyingRef.current && purifyQueueRef.current.length > 0) {
      processPurifyQueue();
    }
    if (isActive && !isFastScrolling) {
      evaluateVisibleBlocks();
      pumpWorkerQueue();
    }
  }, [isActive, processPurifyQueue, evaluateVisibleBlocks, pumpWorkerQueue, isFastScrolling]);

  /* ── Lifecycle & Workers ─────────────────────── */
  const onMessageRef = useRef<((e: MessageEvent) => void) | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const { type, indexId, blocks, indexMs, error } = e.data;
      if (type === 'index-result' || type === 'index-error') {
        if (!isMountedRef.current || indexId !== indexVersionRef.current) {
          const navPerf = (window as any).__NAV_PERF;
          if (navPerf) navPerf.staleJobsDiscarded = (navPerf.staleJobsDiscarded || 0) + 1;
          console.log(`[NavigationPerf] stale preview index discarded: ${indexId}`);
          return;
        }

        if (type === 'index-error') {
          console.error('Preview index error:', error);
          setBlocks([]);
          setIsIndexing(false);
          return;
        }

        if (indexMs > 16) {
          console.log(
            `[NavigationPerf] preview index worker: worker=${indexMs.toFixed(1)}ms blocks=${blocks.length} size=${(indexBytesRef.current / 1024).toFixed(0)}KB`,
          );
        }
        setBlocks(blocks);
        setIsIndexing(false);
        return;
      }

      onMessageRef.current?.(e);
    };
    globalWorker?.addEventListener('message', handler);
    return () => globalWorker?.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (blocks.length === 0) return;

    renderIdRef.current = ++globalRenderIdCounter;
    pendingRef.current.clear();
    setPendingCount(0);
    renderedRef.current.clear();
    setCachedCount(0);
    visibleBlocksRef.current.clear();
    purifyQueueRef.current = [];
    isPurifyingRef.current = false;
    requestQueueRef.current = [];
    inFlightRef.current.clear();

    setIsManualMode(isHeavy);
    setHasStartedRender(!isHeavy);

    onMessageRef.current = (e: MessageEvent) => {
      if (!isMountedRef.current) return;
      const { type, renderId, blockId, html, error } = e.data;
      if (renderId !== renderIdRef.current) return;

      if (type === 'block-result') {
        inFlightRef.current.delete(blockId);
        pendingRef.current.delete(blockId);
        setPendingCount(pendingRef.current.size);
        
        purifyQueueRef.current.push({ blockId, html });
        if (!isPurifyingRef.current) {
          processPurifyQueue();
        }
        pumpWorkerQueue(); // trigger next
      } else if (type === 'block-error') {
        inFlightRef.current.delete(blockId);
        pendingRef.current.delete(blockId);
        setPendingCount(pendingRef.current.size);
        console.error(`Block ${blockId} error:`, error);
        pumpWorkerQueue();
      }
    };

    return () => { 
      purifyQueueRef.current = [];
      requestQueueRef.current = [];
      inFlightRef.current.clear();
      pendingRef.current.clear();
    };
  }, [absolutePath, blocks, isHeavy, processPurifyQueue, pumpWorkerQueue]);

  /* ── IntersectionObserver ────────────────────── */
  useEffect(() => {
    observerRef.current?.disconnect();
    const obs = new IntersectionObserver(
      (entries) => {
        if (!isMountedRef.current) return;
        let changed = false;
        for (const entry of entries) {
          const idAttr = entry.target.getAttribute('data-block-id');
          if (!idAttr) continue;
          // Format is `${previewInstanceId}-${blockId}`
          const id = Number(idAttr.split('-').pop());
          if (Number.isNaN(id)) continue;
          if (entry.isIntersecting) {
            visibleBlocksRef.current.add(id);
            changed = true;
          } else {
            visibleBlocksRef.current.delete(id);
          }
        }
        if (changed && !isFastScrollingRef.current) {
          evaluateVisibleBlocks();
        }
      },
      { rootMargin: '600px' },
    );
    observerRef.current = obs;
    setObserverInstance(obs);
    return () => obs.disconnect();
  }, [evaluateVisibleBlocks]);

  /* ── Scroll handler (throttled block request) ─ */
  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    if (!isMountedRef.current) return;
    const el = e.currentTarget;
    const now = performance.now();
    const currentTop = el.scrollTop;
    
    const { top: lastTop, time: lastTime } = lastScrollRef.current;
    const dt = now - lastTime;
    const dy = Math.abs(currentTop - lastTop);
    
    if (dt > 10) {
      const speed = dy / dt;
      if (speed > SCROLL_SPEED_THRESHOLD) {
        if (!isFastScrollingRef.current) setIsFastScrolling(true);
        
        if (scrollSettleTimerRef.current) window.clearTimeout(scrollSettleTimerRef.current);
        scrollSettleTimerRef.current = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          setIsFastScrolling(false);
        }, SCROLL_SETTLE_DELAY);
      }
      lastScrollRef.current = { top: currentTop, time: now };
    }
  }, []);

  /* ── Status UI computation ──────────────────── */
  let statusText = '';
  let statusClass = 'preview-status-dot';
  if (isIndexing) {
    statusText = 'Indexing blocks...';
    statusClass += ' active';
  } else if (!hasStartedRender) {
    statusText = 'Preview paused for large document';
    statusClass += ' paused';
  } else if (isFastScrolling || uiPaused) {
    statusText = uiPaused ? 'Paused for input...' : 'Catching up after scroll...';
    statusClass += ' paused';
  } else if (pendingCount > 0 || purifyQueueRef.current.length > 0) {
    statusText = `Rendering • ${pendingCount + purifyQueueRef.current.length} queued`;
    statusClass += ' active';
  } else {
    statusText = `Preview ready • ${cachedCount} cached`;
  }
  
  let visibleMin = blocks.length > 0 ? blocks[blocks.length - 1].id : 0;
  let visibleMax = 0;
  if (visibleBlocksRef.current.size > 0) {
    visibleBlocksRef.current.forEach(id => {
      if (id < visibleMin) visibleMin = id;
      if (id > visibleMax) visibleMax = id;
    });
  }

  /* ── Render ─────────────────────────────────── */
  return (
    <div className="markdown-preview-container">
      <div className="markdown-preview" onScroll={handleScroll} ref={previewRef}>
        {isIndexing && (
          <div className="preview-manual-refresh-overlay">
             <span className="preview-refresh-hint">Loading document outline...</span>
          </div>
        )}
        {isManualMode && !hasStartedRender && !isIndexing && (
          <div className="preview-manual-refresh-overlay">
            <button className="preview-refresh-btn" onClick={() => setHasStartedRender(true)}>
              ⟳ Render Preview
            </button>
            <span className="preview-refresh-hint">
              Math-Heavy Document: Live preview paused to protect editor performance.
            </span>
          </div>
        )}

        {hasStartedRender && !isIndexing && (
          <div className="markdown-preview-inner">
            {chunks.map(chunk => (
              <ChunkComponent key={chunk.id} chunk={chunk} blockObserver={observerInstance} previewInstanceId={previewInstanceId} />
            ))}
          </div>
        )}
      </div>

      <div className="preview-status-indicator" title="Preview Status">
        <div className={statusClass}></div>
        <span>{statusText}</span>
        
        {!isIndexing && (
          <div className="preview-status-details">
             <div className="status-detail-row">
               <span className="status-detail-label">Visible Range:</span>
               <span className="status-detail-value">
                 {visibleBlocksRef.current.size > 0 ? `${visibleMin}-${visibleMax}` : 'None'}
               </span>
             </div>
             <div className="status-detail-row">
               <span className="status-detail-label">Total Blocks:</span>
               <span className="status-detail-value">{blocks.length}</span>
             </div>
             <div className="status-detail-row">
               <span className="status-detail-label">Worker Flight:</span>
               <span className="status-detail-value">{inFlightRef.current.size} / {maxInFlight}</span>
             </div>
             <div className="status-detail-row">
               <span className="status-detail-label">Sanitize Queue:</span>
               <span className="status-detail-value">{purifyQueueRef.current.length}</span>
             </div>
             <div className="status-detail-row">
               <span className="status-detail-label">Cache Size:</span>
               <span className="status-detail-value">{cachedCount} / {MAX_RENDERED_BLOCKS}</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
});
