import type { AssetCategory, Season, WeatherCondition, WeatherContext } from '../types';
import { monthOf } from './date';
import { seededRng } from './rng';

export const DEFAULT_LOCATION = { latitude: 31.7683, longitude: 35.2137, nameHe: 'ירושלים' };

export function seasonOf(isoDate: string): Season {
  const m = monthOf(isoDate);
  if (m >= 6 && m <= 9) return 'summer';
  if (m >= 10 && m <= 11) return 'autumn';
  if (m === 12 || m <= 2) return 'winter';
  return 'spring';
}

export function classify(maxTempC: number, precipitationMm: number, windKmh: number): WeatherCondition {
  if (precipitationMm >= 15 || windKmh >= 55) return 'storm';
  if (precipitationMm >= 1) return 'rainy';
  if (maxTempC >= 34) return 'heatwave';
  if (maxTempC >= 25) return 'sunny';
  return 'mild';
}

/** Deterministic, season-appropriate weather when the network is unavailable. */
export function seasonalFallback(isoDate: string, familyId: string): WeatherContext {
  const season = seasonOf(isoDate);
  const rng = seededRng('weather', familyId, isoDate);
  const table: Record<Season, { temp: [number, number]; conditions: WeatherCondition[] }> = {
    summer: { temp: [28, 37], conditions: ['sunny', 'sunny', 'heatwave', 'sunny', 'mild'] },
    autumn: { temp: [20, 29], conditions: ['mild', 'sunny', 'rainy', 'mild'] },
    winter: { temp: [9, 18], conditions: ['rainy', 'mild', 'storm', 'rainy', 'mild'] },
    spring: { temp: [18, 28], conditions: ['mild', 'sunny', 'mild', 'rainy'] },
  };
  const t = table[season];
  const condition = t.conditions[Math.floor(rng() * t.conditions.length)];
  const temperatureC = Math.round(t.temp[0] + rng() * (t.temp[1] - t.temp[0]));
  return { date: isoDate, temperatureC, condition, season, source: 'seasonal-fallback' };
}

/** Free, keyless Open-Meteo forecast for today; falls back on any failure. */
export async function fetchWeather(
  isoDate: string,
  familyId: string,
  latitude = DEFAULT_LOCATION.latitude,
  longitude = DEFAULT_LOCATION.longitude,
  timeoutMs = 4000,
): Promise<WeatherContext> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&daily=temperature_2m_max,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      daily?: { temperature_2m_max?: number[]; precipitation_sum?: number[]; wind_speed_10m_max?: number[] };
    };
    const temp = data.daily?.temperature_2m_max?.[0];
    if (typeof temp !== 'number') throw new Error('missing data');
    const rain = data.daily?.precipitation_sum?.[0] ?? 0;
    const wind = data.daily?.wind_speed_10m_max?.[0] ?? 0;
    return {
      date: isoDate,
      temperatureC: Math.round(temp),
      condition: classify(temp, rain, wind),
      season: seasonOf(isoDate),
      source: 'open-meteo',
    };
  } catch {
    return seasonalFallback(isoDate, familyId);
  }
}

/** Monthly price nudges caused by the weather (SPEC §6.1). */
export function weatherImpacts(w: WeatherContext): Partial<Record<AssetCategory, number>> {
  const byCondition: Record<WeatherCondition, Partial<Record<AssetCategory, number>>> = {
    heatwave: { leisure_tech: 0.02, energy: 0.02 },
    sunny: { leisure_tech: 0.01 },
    mild: {},
    rainy: { leisure_tech: -0.01, energy: 0.005 },
    storm: { leisure_tech: -0.03, energy: 0.025 },
  };
  const impacts = { ...byCondition[w.condition] };
  if (w.season === 'summer') impacts.leisure_tech = (impacts.leisure_tech ?? 0) + 0.005;
  if (w.season === 'winter') impacts.energy = (impacts.energy ?? 0) + 0.005;
  return impacts;
}

/** Multiplier applied to weather-sensitive passive income (lemonade, slushies). */
export function passiveWeatherMultiplier(w: WeatherContext): number {
  return { heatwave: 1.4, sunny: 1.15, mild: 1, rainy: 0.8, storm: 0.6 }[w.condition];
}

export const WEATHER_LABEL: Record<WeatherCondition, { icon: string; he: string }> = {
  heatwave: { icon: '🥵', he: 'שרב' },
  sunny: { icon: '☀️', he: 'שמשי' },
  mild: { icon: '⛅', he: 'נעים' },
  rainy: { icon: '🌧️', he: 'גשום' },
  storm: { icon: '⛈️', he: 'סוער' },
};

export const SEASON_LABEL: Record<Season, string> = {
  summer: 'קיץ',
  autumn: 'סתיו',
  winter: 'חורף',
  spring: 'אביב',
};
