// Search responses can omit portions; select only a matching full food detail.
export function createUsdaSelection({ onStart, onFood, onError, onEnd, fetchImpl = fetch }) {
  let version = 0, controller = null, timer = null;
  function cancel() { version++; clearTimeout(timer); controller?.abort(); controller = null; }
  async function select(food) {
    cancel();
    const current = version;
    controller = new AbortController();
    const requestController = controller;
    const signal = requestController.signal;
    const timeout = setTimeout(() => requestController.abort(), 15000);
    timer = timeout;
    onStart();
    try {
      if (!Number.isSafeInteger(food?.fdcId) || food.fdcId <= 0) throw Error('Invalid food');
      const response = await fetchImpl('/api/fdc-food?fdcId=' + food.fdcId, { signal });
      if (!response.ok) throw Error('Detail unavailable');
      const data = await response.json();
      if (data.food?.fdcId !== food.fdcId || !data.food.nutrients || !Array.isArray(data.food.portions)) throw Error('Invalid detail');
      if (current === version && !signal.aborted) onFood(data);
    } catch {
      if (current === version) onError('Could not load USDA food details. Select the food again to retry.');
    } finally {
      clearTimeout(timeout);
      if (current === version) { controller = null; onEnd(); }
    }
  }
  return { select, cancel };
}
export const portionDescription = p => p.description || p.modifier || p.unit || '';
