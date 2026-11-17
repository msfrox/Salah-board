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
  "display": { "scale": 1.0 },        // UI size multiplier 0.2–5.0 (clamped);
                                      // the theme is already resolution-independent
                                      // (vmin), so scale is a FINE preference on top
                                      // for taste / viewing distance. Debug: ?scale=
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
    "bayan": true,                     // show a bayan between the sunnah reminder
                                       // and the khutbah (false: same window, quiet
                                       // screen without the bayan title)
    "khutbah": "12:45 PM",             // fixed set time the khutbah starts
    "khutbahMinutes": 7,               // khutbah length → iqamah = khutbah + this
    "sunnahMinutes": 5,                // "Sunnah prayer" screen after the azan screen
    "salahDuration": 15,
    // Sequence: azan (that Friday's luhr) → azan screen (screens.azan) →
    // sunnah reminder → bayan until `khutbah` → khutbah → iqamah. Bayan start
    // and iqamah are derived, not set. Migration (config.js migrateStored):
    // old "bayan": "<time>"/null → true/false; old fixed "iqamah" →
    // khutbah = iqamah − khutbahMinutes, so the masjid's iqamah doesn't move.
    "bayanSpeaker": "",                // optional, e.g. "Moulavi Ahmed Rizwan"
    "bayanTopic": "",                  // optional, e.g. "Patience in hardship"
    "bayanDate": null                  // ISO Friday "2026-11-13": speaker/topic show
                                       // only on that date. Admin stamps it on
                                       // save (coming Friday, unless a later one is
                                       // picked) and opens with the fields cleared
                                       // once that Jumu'ah is over → they clear
                                       // themselves weekly. null when both empty.
    // Speaker/topic alternate with the times in the "Jumu'ah today" banner
    // (one-line carousel) and appear on the bayan
    // screen, only when `bayan` is set, and disappear once Jumu'ah salah ends.
    // Jumu'ah azan is NOT separately configured — it's that Friday's own
    // luhr azan time from the zone data (there's no distinct Jumu'ah clock).
  },

  "luha": {
    "enabled": true,                  // full-screen "Luha in MM:SS" countdown, sunrise → Luha
    "showOnMain": true,               // NORMAL, Fajr azan → Luha: next prayer = Luha,
                                      // big times = Sunrise | Luha (instead of Azan | Iqamah),
                                      // countdown to sunrise then to Luha; timetable highlights Sunrise
    "waitAfterSunrise": 20            // minutes; Luha time = sunrise + this (used by both)
  },

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

  "layout": {                         // per-board fine-tuning (admin → Advanced tab,
                                      // live preview). Every size is a percent of the
                                      // theme's own size, 50–250. The full element list
                                      // (keys, labels, CSS selectors) is LAYOUT_GROUPS
                                      // in display/js/config.js — the single source.
    "normal": {                       // NORMAL screen
      "sizes": {
        "masjidName": 100, "dates": 100, "clock": 100,
        "nextLabel": 100,             // "NEXT PRAYER"
        "nextName": 100,              // e.g. "ZUHR"
        "timeLabels": 100,            // "AZAN" / "IQAMAH"
        "prayerTimes": 100,           // the big azan + iqamah numbers
        "countdown": 100,             // countdown to azan
        "ttLabels": 100, "ttTimes": 100,  // timetable strip names / times
        "jumuahBanner": 100, "pinnedBanner": 100, "ramadanBlock": 100,
        "cards": 100                  // rotating notice / etiquette cards
        // (older configs' single "banners" size is migrated to the three above)
      },
      "show": {                       // false hides the element
        "masjidName": true, "dates": true, "nextLabel": true,
        "countdown": true, "timetable": true, "cards": true
      }
    },
    "screens": {                      // every other screen
      "sizes": {
        "cornerClock": 100,           // time on all transient screens
        "azanTitle": 100, "azanReply": 100, "azanArabic": 100,
        "azanTranslation": 100, "azanDuaTitle": 100, "azanIcon": 100,
        "iqamahLabel": 100, "iqamahCountdown": 100, "betweenReminder": 100,
        "betweenArabic": 100, "betweenTranslation": 100, "sunnahReminder": 100,
        "iqamahTitle": 100, "iqamahLines": 100,       // "straighten the rows"
        "salahClock": 100, "salahLine": 100,
        "afterArabic": 100, "afterText": 100,
        "luhaLabel": 100, "luhaCountdown": 100, "luhaOpen": 100,
        "nightClock": 100, "nightFajr": 100,
        "bayanTitle": 100, "bayanSpeaker": 100, "bayanTopic": 100, "bayanTimes": 100,
        "khutbahLine": 100
      }
    }
  },

  "time": {                           // display renders now() + offsetMs
    "offsetMs": 0,                    // manual second-level drift correction, set
                                      // from the admin Time tab (privilege-free);
                                      // the ?t= debug clock ignores it
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
