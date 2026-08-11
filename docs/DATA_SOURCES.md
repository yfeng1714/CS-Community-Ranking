# External Data Sources

No external provider is called in Milestone 0.

The provider boundaries, source ownership, data freshness rules, attribution requirements, and
Candidate Pool approval workflow are defined in `docs/IMPLEMENTATION_PLAN_V0.1.md`. Milestone 7
implements narrow HLTV and Valve VRS adapters using saved fixtures in tests. A provider must never
be called from the public voting request path or make an imported Candidate Pool change live without
human approval.
