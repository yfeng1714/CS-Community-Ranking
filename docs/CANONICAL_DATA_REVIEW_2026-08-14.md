# Canonical data review — 2026-08-14 OWNER APPROVED

This is the Owner-approved human review companion to `data/canonical/2026-beta.json`. Approval
authorizes the empty-database canonical bootstrap and local rehearsal only. It is not Pool admission,
Edition activation, or launch freshness evidence. Re-run source syncs and review immutable snapshots
before the real Pool is approved.

## Proposed Edition

- Code/name: `2026` / `2026 Beta Edition`
- Proposed window: 2026-08-14 00:00 Asia/Shanghai through 2027-01-01 00:00 Asia/Shanghai
- Daily full-weight Ballots: 50
- Ballot TTL: 30 minutes
- State after bootstrap: DRAFT

The Owner selected August 14 as the proposed start. The limits remain proposals until the complete
manifest is approved. Closed-beta observations may still justify a quota change through the normal
audited Edition path.

## Ranking union and observed starters

The Team set is the union of top 12 in the official Valve August 3 global standings and HLTV August
10 world ranking. A dash means outside that source's top 12, not absent from the source.

| Team          | VRS | HLTV | Five starters in canonical DRAFT            |
| ------------- | --: | ---: | ------------------------------------------- |
| Falcons       |   2 |    1 | karrigan, NiKo, TeSeS, m0NESY, kyousuke     |
| Spirit        |   1 |    2 | sh1ro, magixx, tN1R, zont1x, donk           |
| FURIA         |   8 |    3 | FalleN, yuurih, YEKINDAR, KSCERATO, molodoy |
| Vitality      |   5 |    4 | apEX, ropz, ZywOo, flameZ, mezii            |
| MOUZ          |   3 |    5 | torzsi, Spinx, xertioN, PR, xelex           |
| Natus Vincere |   6 |    6 | Aleksib, iM, b1t, w0nderful, makazze        |
| 9z            |   4 |    7 | max, dgt, meyern, luchov, HUASOPEEK         |
| Aurora        |  10 |    8 | XANTARES, woxic, Jimpphat, kyxsan, Wicadia  |
| FaZe          |   — |    9 | frozen, Twistzz, Neityu, jcobbb, JBOEN      |
| G2            |  11 |   10 | huNter-, NertZ, r1nkle, HeavyGod, MATYS     |
| Astralis      |   — |   11 | HooXi, phzy, jabbi, Staehr, ryu             |
| BetBoom       |   9 |   12 | Boombl4, zorte, S1ren, d1Ledez, Magnojez    |
| PARIVISION    |  12 |    — | FL1T, Jame, xiELO, zweih, slaxejezzz        |
| Legacy        |   7 |    — | arT, dumau, latto, n1ssim, try              |

Each Team and Player has a direct `www.hltv.org` identity URL in the JSON. All player profile links
are also stored in the new nullable public-reference field. Country codes remain null rather than
being guessed.

## Known source conflicts

The August 3 VRS roster column differs from the HLTV Team/profile state checked August 14:

| Team       | VRS snapshot | Canonical DRAFT | Resolution                                    |
| ---------- | ------------ | --------------- | --------------------------------------------- |
| BetBoom    | FL4MUS       | S1ren           | Use HLTV; retain the older conflict evidence. |
| G2         | SunPayus     | r1nkle          | Use HLTV; retain the older conflict evidence. |
| Legacy     | saadzin      | try             | Use HLTV; retain the older conflict evidence. |
| PARIVISION | HObbit       | FL1T            | Use HLTV; retain the older conflict evidence. |

The Owner decided that HLTV is authoritative whenever a VRS roster conflicts with HLTV. The
canonical DRAFT therefore follows the August 10 HLTV Team state while preserving each disagreement
as non-blocking warning evidence; the bootstrap must not erase or misrepresent the older snapshot.

The isolated local draft also retained six warnings for FUT, The MongolZ, MIBR, Alliance, TYLOO, and
B8. They appear in VRS ranks 13–20 but are not in the 14-Team top-12 union and have no imported
qualifying 2026 Event evidence. They are therefore not Review Auto proposals, not missing Core
identities, and not silently admitted.

## Freshness and image blockers

- The August 3 VRS and August 10 HLTV rankings are both within the configured 14-day maximum on
  August 14. Refresh both sources again if production activation occurs after this review date.
- Real images are preferred. The separate asset passes imported all 14 Team logos and all 70 Player
  portraits as local copies with exact ignored source records plus tracked path/right-status entries.
- Owner-accepted provisional community-beta use is allowed as an explicit warning while the Owner
  handles external rights questions. Run `pnpm assets:check` and visually review every public crop;
  runtime hotlinking remains prohibited.

## Owner review record

- Identity/roster policy: **HLTV is authoritative for conflicts; approved 2026-08-14**
- Edition proposed start: **2026-08-14; approved 2026-08-14**
- Known conflicts: **Resolved by the HLTV-authority policy; evidence retained**
- Manifest reviewer/date: **owner / 2026-08-14T11:57:01Z**
- Result: **OWNER APPROVED — MAY APPLY ONLY TO AN EMPTY REHEARSAL/RESET DATABASE; NOT POOL APPROVAL**
