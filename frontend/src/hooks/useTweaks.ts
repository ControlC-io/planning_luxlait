import { useCallback, useEffect, useState } from 'react';
import {
  loadTweaks,
  saveTweaks,
  type TweakValues,
  TWEAK_DEFAULTS,
} from '@/data/themes';

export function useTweaks(_defaults: TweakValues = TWEAK_DEFAULTS): [
  TweakValues,
  (key: keyof TweakValues, val: TweakValues[keyof TweakValues]) => void,
] {
  const [values, setValues] = useState<TweakValues>(() => loadTweaks());

  useEffect(() => {
    setValues(loadTweaks());
  }, []);

  const setTweak = useCallback(
    (key: keyof TweakValues, val: TweakValues[keyof TweakValues]) => {
      setValues((prev) => {
        const next = { ...prev, [key]: val };
        saveTweaks(next);
        return next;
      });
    },
    [],
  );

  return [values, setTweak];
}
