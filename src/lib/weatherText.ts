/** Maps a WMO weather code (Open-Meteo `weather_code`) to a translation key, so the condition reads in the selected language. */
export function weatherConditionKey(code: number | null | undefined): string {
  if (code === null || code === undefined || !Number.isFinite(code)) return "p2.wx.unknown";
  if (code === 0) return "p2.wx.clear";
  if (code === 1 || code === 2) return "p2.wx.partly";
  if (code === 3) return "p2.wx.overcast";
  if (code === 45 || code === 48) return "p2.wx.fog";
  if (code >= 51 && code <= 57) return "p2.wx.drizzle";
  if ((code >= 61 && code <= 67)) return "p2.wx.rain";
  if (code >= 71 && code <= 77) return "p2.wx.snow";
  if (code >= 80 && code <= 82) return "p2.wx.showers";
  if (code >= 95 && code <= 99) return "p2.wx.thunder";
  return "p2.wx.unknown";
}
