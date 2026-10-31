/**
 * tileHealth.ts - tells the UI when the configured imagery tiles are not loading, so a map never stays silently blank.
 *
 * It only OBSERVES the one configured tile layer. It never swaps providers: the caller shows an error with a Retry, and retry()
 * simply asks the same layer to load its tiles again.
 *
 * "Failing" means: for the current view, at least one tile failed and none loaded. (A provider's blank "no imagery here" tile is
 * a successful 200 response, not an error.) The state clears by itself as soon as a view loads tiles again.
 */

export interface ObservableTileLayer {
  on(type: string, fn: (...args: unknown[]) => void): unknown;
  off(type: string, fn: (...args: unknown[]) => void): unknown;
  redraw(): unknown;
}

export interface TileHealth {
  retry: () => void;
  dispose: () => void;
}

export function watchTileHealth(
  layer: ObservableTileLayer,
  onChange: (failing: boolean) => void,
  options: { errorThreshold?: number } = {}
): TileHealth {
  const threshold = options.errorThreshold ?? 3;
  let loads = 0;
  let errors = 0;
  let failing = false;

  const set = (next: boolean) => {
    if (next !== failing) {
      failing = next;
      onChange(next);
    }
  };

  const onLoading = () => {
    loads = 0;
    errors = 0;
  };
  const onTileLoad = () => {
    loads += 1;
    if (failing) set(false);
  };
  const onTileError = () => {
    errors += 1;
    if (loads === 0 && errors >= threshold) set(true);
  };
  const onLoad = () => {
    if (loads === 0 && errors > 0) set(true);
  };

  layer.on("loading", onLoading);
  layer.on("tileload", onTileLoad);
  layer.on("tileerror", onTileError);
  layer.on("load", onLoad);

  return {
    retry: () => {
      loads = 0;
      errors = 0;
      set(false);
      layer.redraw();
    },
    dispose: () => {
      layer.off("loading", onLoading);
      layer.off("tileload", onTileLoad);
      layer.off("tileerror", onTileError);
      layer.off("load", onLoad);
    },
  };
}
