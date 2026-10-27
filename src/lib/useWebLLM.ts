import { useState, useCallback, useEffect } from 'react';
import { CreateWebWorkerMLCEngine, InitProgressCallback, MLCEngineInterface, ChatCompletionMessageParam, hasModelInCache } from '@mlc-ai/web-llm';

// Default: Qwen 2.5 3B (f16) - better multilingual reasoning than Llama 1B,
// chosen by the maintainer (2026-08-22). The f16 build uses about half the VRAM
// of the Llama-3B *f32* build that once crashed WebGPU; the 1B fallback stays
// available in the picker (stored in localStorage).
export const WEBLLM_MODELS = [
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 3B (f16)', size: '~1.9 Go', note: 'recommandé, GPU récent' },
  { id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 Coder 1.5B', size: '~1 Go', note: 'orienté SQL, plus léger' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B', size: '~1 Go', note: 'léger' },
  { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', label: 'Llama 3.2 1B', size: '~850 Mo', note: 'ancien défaut, compatible partout' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', label: 'Llama 3.2 3B (f16)', size: '~1.8 Go', note: 'GPU récent' },
];
export const MODEL_STORAGE_KEY = 'ibb_webllm_model';
export const DEFAULT_MODEL = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';
export const getPreferredModel = () =>
  (typeof localStorage !== 'undefined' && localStorage.getItem(MODEL_STORAGE_KEY)) || DEFAULT_MODEL;

export interface GenerateOptions {
  /** Defaults to 0: deterministic, which is what SQL generation wants. */
  temperature?: number;
  /** Caps generation. A SELECT is short; without this the model rambles on. */
  maxTokens?: number;
  /** Sequences that end generation early — the main latency win. */
  stop?: string[];
}

export function useWebLLM() {
  const [engine, setEngine] = useState<MLCEngineInterface | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    hasModelInCache(getPreferredModel()).then((cached) => setIsCached(cached)).catch(() => setIsCached(false));
  }, []);

  const init = useCallback(async (modelId: string = getPreferredModel()) => {
    if (engine) return;
    setLoading(true);
    setProgressText('Initialisation...');
    
    const initProgressCallback: InitProgressCallback = (initProgress) => {
      setProgressText(initProgress.text);
      setProgressPercent(Math.round(initProgress.progress * 100));
    };

    try {
      const worker = new Worker(new URL('./webllmWorker.ts', import.meta.url), { type: 'module' });
      const newEngine = await CreateWebWorkerMLCEngine(
        worker,
        modelId,
        { initProgressCallback }
      );
      setEngine(newEngine);
    } catch (error) {
      console.error("Failed to initialize WebLLM engine:", error);
      setProgressText('Erreur lors du chargement du modèle.');
    } finally {
      setLoading(false);
      setProgressText('');
    }
  }, [engine]);

  const generate = useCallback(async (
    messages: ChatCompletionMessageParam[],
    systemPrompt?: string,
    onUpdate?: (currentText: string) => void,
    options?: GenerateOptions
  ) => {
    if (!engine) throw new Error("L'IA n'est pas encore initialisée.");

    const fullMessages: ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      fullMessages.push({ role: 'system', content: systemPrompt });
    }
    fullMessages.push(...messages);

    // Greedy by default. For SQL there is one right answer, and sampling only
    // buys invented column names.
    const temperature = options?.temperature ?? 0;
    const max_tokens = options?.maxTokens;
    const stop = options?.stop;

    if (onUpdate) {
      const asyncChunkGenerator = await engine.chat.completions.create({
        messages: fullMessages,
        temperature,
        max_tokens,
        stop,
        stream: true,
      });

      let responseText = "";
      for await (const chunk of asyncChunkGenerator) {
        if (chunk.choices[0]?.delta?.content) {
          responseText += chunk.choices[0].delta.content;
          onUpdate(responseText);
        }
      }
      return responseText;
    } else {
      const reply = await engine.chat.completions.create({
        messages: fullMessages,
        temperature,
        max_tokens,
        stop,
      });
      return reply.choices[0].message.content as string;
    }
  }, [engine]);

  return { engine, loading, progressText, progressPercent, isCached, init, generate };
}
