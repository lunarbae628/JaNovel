import {useEffect, useState} from 'react';

export function usePreviewState(section, initial) {
  const key = 'janovel.preview.' + section;
  const [state, setState] = useState(() => {
    try {
      return {...initial, ...JSON.parse(localStorage.getItem(key))};
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Keep the preview usable in memory when browser storage is unavailable.
    }
  }, [key, state]);

  return [state, setState];
}
