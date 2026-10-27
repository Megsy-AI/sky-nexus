// Parallel runner for chat media generation; every image/video goes through AgentSky.
// together and reports progress via callbacks so the UI updates as each result lands.

import type { MediaPlan, MediaPlanScene } from "@/components/chat/media/MediaPlanCard";
import type { MediaSceneResult } from "@/components/chat/media/MediaResultCard";

interface ScenePartialCb {
  (index: number, previewDataUrl: string, progress: number): void;
}

/**
 * Drives a synthetic progress ticker for non-streaming generations so the UI
 * shows ChatGPT-style live progress for every model.
 * Approaches but never reaches 0.95 until the real result arrives.
 */
function startProgressTicker(
  sceneIndex: number,
  estimatedMs: number,
  onPartial: ScenePartialCb | undefined,
): () => void {
  if (!onPartial) return () => {};
  const started = Date.now();
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const elapsed = Date.now() - started;
    // Easing: fast at first, asymptotic to 0.95
    const p = Math.min(0.95, 1 - Math.exp(-elapsed / estimatedMs));
    onPartial(sceneIndex, "", p);
  };
  tick();
  const id = window.setInterval(tick, 600);
  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}

/** Every chat image/video now goes through AgentSky (one provider for the whole app). */
async function generateViaAgentSky(
  kind: "image" | "video",
  scene: MediaPlanScene,
  onPartial: ScenePartialCb | undefined,
  aspectRatio?: string,
): Promise<string> {
  const { agentApi, mediaStatus } = await import("@/lib/agentsky/client");
  const stop = startProgressTicker(scene.index, kind === "video" ? 90_000 : 18_000, onPartial);
  try {
    const run = await agentApi.media({
      kind,
      prompt: scene.prompt,
      aspect: normalizeAspect(kind, (kind === "video" ? scene.aspect_ratio : undefined) || aspectRatio),
      duration: kind === "video" ? scene.duration_seconds || 5 : undefined,
      idempotencyKey: crypto.randomUUID(),
    });
    const started = Date.now();
    while (Date.now() - started < 15 * 60_000) {
      await new Promise((r) => setTimeout(r, kind === "video" ? 5000 : 2500));
      const st = await mediaStatus(run.runId, run.token).catch(() => null);
      if (!st) continue;
      if (st.urls?.length) {
        onPartial?.(scene.index, kind === "image" ? st.urls[0] : "", 1);
        return st.urls[0];
      }
      if (/FAIL|ERROR|CANCEL/i.test(st.status || "")) throw new Error(st.error || `${kind} failed`);
    }
    throw new Error("timeout");
  } finally {
    stop();
  }
}

async function generateImageScene(
  scene: MediaPlanScene,
  modelSlug: string,
  onPartial?: ScenePartialCb,
  aspectRatio?: string,
): Promise<string> {
  return generateViaAgentSky("image", scene, onPartial, aspectRatio);
}

async function generateVideoScene(
  scene: MediaPlanScene,
  modelSlug: string,
  onPartial?: ScenePartialCb,
  aspectRatio?: string,
  onCountdown?: (index: number, endsAt: number | null) => void,
): Promise<string> {
  void onCountdown;
  return generateViaAgentSky("video", scene, onPartial, aspectRatio);
}

export interface RunMediaPlanOptions {
  plan: MediaPlan;
  onSceneStart: (index: number) => void;
  onSceneDone: (result: MediaSceneResult) => void;
  /** Fires with progressive previews (ChatGPT-style) while an image is rendering. */
  onScenePartial?: (index: number, previewUrl: string, progress: number) => void;
  /** For video tasks: timestamp (ms) when the initial ~5 min wait ends, or null to clear. */
  onSceneCountdown?: (index: number, endsAt: number | null) => void;
  shouldCancel?: () => boolean;
}

export async function runMediaPlan(opts: RunMediaPlanOptions): Promise<void> {
  const { plan, onSceneStart, onSceneDone, onScenePartial, onSceneCountdown, shouldCancel } = opts;
  // Keep premium video unlimited at the request level, but never fan out an
  // unbounded number of provider jobs. This is the client-side admission layer
  // until the durable Supabase worker is deployed; the provider must still
  // enforce the authoritative per-user/global limits server-side.
  const concurrency = plan.mode === "video" ? 2 : 4;
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < plan.scenes.length) {
      const scene = plan.scenes[nextIndex++];
      if (shouldCancel?.()) return;
      onSceneStart(scene.index);
      try {
        const url =
          plan.mode === "video"
            ? await generateVideoScene(
                scene,
                plan.modelSlug,
                onScenePartial,
                plan.aspectRatio,
                onSceneCountdown,
              )
            : await generateImageScene(scene, plan.modelSlug, onScenePartial, plan.aspectRatio);
        if (plan.mode === "images" && url) {
          try {
            const { rememberCharacter } = await import("./media/characterMemory");
            rememberCharacter({
              name: plan.originalPrompt || plan.summary,
              descriptor: scene.identity || scene.prompt,
              refUrl: url,
            });
          } catch {
            /* memory is best-effort */
          }
        }
        onSceneDone({
          index: scene.index,
          title: scene.title,
          status: "done",
          url,
          type: plan.mode === "video" ? "video" : "image",
        });
      } catch (e) {
        onSceneDone({
          index: scene.index,
          title: scene.title,
          status: "error",
          error: e instanceof Error ? e.message : "failed",
          type: plan.mode === "video" ? "video" : "image",
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, plan.scenes.length) }, worker));
}

export async function regenerateScene(
  plan: MediaPlan,
  sceneIndex: number,
  onPartial?: (index: number, previewUrl: string, progress: number) => void,
  onCountdown?: (index: number, endsAt: number | null) => void,
): Promise<MediaSceneResult> {
  const scene = plan.scenes.find((s) => s.index === sceneIndex);
  if (!scene) throw new Error("scene not found");
  try {
    const url =
      plan.mode === "video"
        ? await generateVideoScene(scene, plan.modelSlug, onPartial, plan.aspectRatio, onCountdown)
        : await generateImageScene(scene, plan.modelSlug, onPartial, plan.aspectRatio);
    return {
      index: scene.index,
      title: scene.title,
      status: "done",
      url,
      type: plan.mode === "video" ? "video" : "image",
    };
  } catch (e) {
    return {
      index: scene.index,
      title: scene.title,
      status: "error",
      error: e instanceof Error ? e.message : "failed",
      type: plan.mode === "video" ? "video" : "image",
    };
  }
}

/** AgentSky accepts a fixed ratio list; videos only support landscape/portrait. */
function normalizeAspect(kind: "image" | "video", a?: string): string {
  const v = String(a || "").trim();
  if (kind === "video") return v === "9:16" ? "9:16" : "16:9";
  return ["1:1", "16:9", "9:16", "4:3", "3:4"].includes(v) ? v : "1:1";
}
