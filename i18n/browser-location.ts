export const BROWSER_LOCATION_CHANGE_EVENT = 'help-math:location-change';

export function replaceBrowserLocation(url: string): void {
  window.history.replaceState(window.history.state, '', url);
  window.dispatchEvent(new Event(BROWSER_LOCATION_CHANGE_EVENT));
}
