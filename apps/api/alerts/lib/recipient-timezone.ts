/**
 * Resolving the timezone a notification should be written in.
 *
 * `users` has no timezone column (02-CONTRACTS.md §1) but an alert has to say when a show
 * starts in the reader's own time or it is useless — see BLOCKER 5, which proposes adding
 * one. Until then this resolves in order of decreasing confidence and reports which rung
 * it landed on, so the notification can label the time honestly instead of implying a
 * precision it does not have.
 */

import { isValidTimeZone, STATION_TIMEZONE } from '../../schedule/lib/time'
import type { AlertRecipient } from './matching'

export type TimeZoneConfidence = 'stated' | 'inferred_from_country' | 'station_default'

export interface ResolvedTimeZone {
  timeZone: string
  confidence: TimeZoneConfidence
}

/**
 * Countries with a single civil timezone, where a country code implies a zone with no
 * ambiguity. Deliberately partial: a country with more than one zone is not guessed at,
 * because a wrong hour is worse than an honest default.
 */
const SINGLE_ZONE_COUNTRIES: Readonly<Record<string, string>> = {
  FR: 'Europe/Paris',
  BE: 'Europe/Brussels',
  NL: 'Europe/Amsterdam',
  DE: 'Europe/Berlin',
  AT: 'Europe/Vienna',
  CH: 'Europe/Zurich',
  IT: 'Europe/Rome',
  ES: 'Europe/Madrid',
  PT: 'Europe/Lisbon',
  GB: 'Europe/London',
  IE: 'Europe/Dublin',
  DK: 'Europe/Copenhagen',
  SE: 'Europe/Stockholm',
  NO: 'Europe/Oslo',
  FI: 'Europe/Helsinki',
  PL: 'Europe/Warsaw',
  CZ: 'Europe/Prague',
  SK: 'Europe/Bratislava',
  HU: 'Europe/Budapest',
  RO: 'Europe/Bucharest',
  BG: 'Europe/Sofia',
  GR: 'Europe/Athens',
  HR: 'Europe/Zagreb',
  SI: 'Europe/Ljubljana',
  RS: 'Europe/Belgrade',
  LU: 'Europe/Luxembourg',
  IS: 'Atlantic/Reykjavik',
  EE: 'Europe/Tallinn',
  LV: 'Europe/Riga',
  LT: 'Europe/Vilnius',
  MA: 'Africa/Casablanca',
  TN: 'Africa/Tunis',
  DZ: 'Africa/Algiers',
  EG: 'Africa/Cairo',
  ZA: 'Africa/Johannesburg',
  NG: 'Africa/Lagos',
  KE: 'Africa/Nairobi',
  TR: 'Europe/Istanbul',
  IL: 'Asia/Jerusalem',
  AE: 'Asia/Dubai',
  IN: 'Asia/Kolkata',
  JP: 'Asia/Tokyo',
  KR: 'Asia/Seoul',
  SG: 'Asia/Singapore',
  HK: 'Asia/Hong_Kong',
  TW: 'Asia/Taipei',
  TH: 'Asia/Bangkok',
  VN: 'Asia/Ho_Chi_Minh',
  PH: 'Asia/Manila',
  NZ: 'Pacific/Auckland',
  JM: 'America/Jamaica',
  CO: 'America/Bogota',
  PE: 'America/Lima',
  UY: 'America/Montevideo',
}

export function resolveRecipientTimeZone(recipient: AlertRecipient): ResolvedTimeZone {
  const stated = recipient.timeZone
  if (stated && isValidTimeZone(stated)) {
    return { timeZone: stated, confidence: 'stated' }
  }

  const country = recipient.country?.toUpperCase()
  if (country) {
    const inferred = SINGLE_ZONE_COUNTRIES[country]
    if (inferred) return { timeZone: inferred, confidence: 'inferred_from_country' }
  }

  return { timeZone: STATION_TIMEZONE, confidence: 'station_default' }
}
