# External Data Sources

No external provider is called in Milestone 0.

The provider boundaries, source ownership, data freshness rules, attribution requirements, and
Candidate Pool approval workflow are defined in `docs/IMPLEMENTATION_PLAN_V0.1.md`. Milestone 7
implements narrow HLTV and Valve VRS adapters using saved fixtures in tests. A provider must never
be called from the public voting request path or make an imported Candidate Pool change live without
human approval.

The Gate D audit fixes the receiving boundary before those adapters exist:

- public recent/career Rating projections select only `HLTV` snapshots and label them as HLTV
  Rating; metrics from `OTHER`, BO3, PandaScore, or Liquipedia cannot silently occupy that field;
- imported identity, entity, roster, Event/result, and Pool proposals use the exact version-1
  contract in `docs/ADMIN_CONSOLE.md`;
- automatic Pool Team proposals include ranking/event evidence and are re-evaluated on approval;
- no Edition transition is an accepted provider proposal; and
- proposal application and runtime cache invalidation occur only after explicit reviewed commit.
