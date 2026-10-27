/** Media picker catalogue: only the AgentSky-served models are shown. */

const isAgentSky = (m: any) => String(m?.provider || "").toLowerCase() === "agentsky";

export function isAllowedImageModel(model: any): boolean {
  return isAgentSky(model) && String(model?.type || "image") === "image";
}

export function isFreeImageModel(_model: any): boolean {
  return false;
}

export function filterImageModels<T>(models: T[]): T[] {
  return models.filter(isAllowedImageModel);
}

/** Video is served only by AgentSky; other catalogue rows are hidden. */
export function filterVideoModels<T>(models: T[]): T[] {
  return models.filter((model: any) => isAgentSky(model));
}
