# config.json — the single contract

One JSON object shared by display, admin panel and shell. The display must
render sensibly with ANY field missing (defaults below). Version every
breaking change via `configVersion`.

```jsonc
{
  "configVersion": 1,
  "masjid": {
    "name": "Kollupitiya Jumma Masjid",
    "languages": ["ta", "en"]        // ordered; first = primary UI labels
  },
  "zone": "01",                       // ACJU zone "01".."13"
  "theme": "classic",                 // folder name under display/themes/
  "display": { "scale": 1.0 },        // UI size multiplier 0.5–2.0 (clamped);
                                      // tunes text size for panel size/viewing
                                      // distance. Debug override: ?scale=
  "clock": { "format": "12h", "showSeconds": true },  // no AM/PM shown in either mode
  "hijri": { "offsetDays": 0, "flipAtMaghrib": true },

  "iqamah": {                         // per prayer; Friday luhr ignored (jumuah wins)
    "fajr":   { "mode": "offset", "minutes": 30, "round": 5 },
    "luhr":   { "mode": "offset", "minutes": 20, "round": 5 },
    "asr":    { "mode": "offset", "minutes": 20, "round": 5 },
    "magrib": { "mode": "offset", "minutes": 10, "round": 0 },
    "isha":   { "mode": "fixed",  "time": "7:15 PM" }   // fixed example
  },

  "screens": {                        // state durations, minutes
    "azan": 5, "iqamahWarning": 2, "after": 10,
    "salahDuration": { "fajr": 10, "luhr": 10, "asr": 10, "magrib": 10, "isha": 12 }
  },

  "jumuah": {
    "enabled": true,
    "bayan": "12:30 PM",               // fixed set time; null = no bayan card
    "iqamah": "1:15 PM",               // fixed set time (khutbah runs until this)
    "salahDuration": 15
    // Jumu'ah azan is NOT separately configured — it's that Friday's own
    // luhr azan time from the zone data (there's no distinct Jumu'ah clock).
  },

  "luha": { "enabled": true, "waitAfterSunrise": 20 },   // minutes

  "ramadan": {
    "enabled": false,                 // manual toggle only (moon sighting)
    "showImsak": true,                // Imsak = Fajr − 2 min (ACJU)
    "iqamahOverrides": {              // sparse; same shape as iqamah entries
      "magrib": { "mode": "offset", "minutes": 20, "round": 0 }
    },
    "taraweehNote": { "ta": "...", "en": "Taraweeh after Isha" }
  },

  "night": {
    "dim": true,
    "afterIshaMinutes": 60,           // NIGHT starts after AFTER + this
    "beforeFajrMinutes": 45,          // NIGHT ends this long before Fajr
    "brightness": 10                  // percent, via shell bridge (browser: CSS overlay)
  },

  "notices": [
    {
      "id": "eid-2026",
      "text": { "ta": "...", "en": "Eid salah 7:00 AM at the grounds" },
      "from": "2026-03-18",           // optional ISO dates, inclusive
      "to": "2026-03-20",
      "priority": "high"              // "high" = pinned banner, "normal" = rotation
    }
  ],

  "rotation": {                       // NORMAL-state card rotation
    "seconds": 20,
    "cards": ["timetable", "notices", "jumuah-etiquette"]
  },

  "time": {                           // managed by shell (M4); display reads only
    "offsetMs": 0,
    "ntpEnabled": true,
    "lastSyncISO": null,
    "lastSyncSource": null            // "ntp" | "manual" | null
  }
}
```

## Rules for implementers

- **Defaults:** every field above IS the default (except masjid.name → "").
  `js/config.js` exposes `getConfig()` returning defaults deep-merged with
  stored config. Admin panel edits full objects, never partial paths.
- **Validation:** admin panel validates before save (times parse, iqamah
  sanity, zone exists). Display never shows raw errors on the big screen.
- **Storage:** browser dev = localStorage (`sb_config`); Android = file via
  shell, served at `/api/config`. Same JSON either way.
- **12-hour time strings** ("1:00 PM") to match the data files' format.
