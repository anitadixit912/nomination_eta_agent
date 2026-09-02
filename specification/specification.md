# Specification

> **Guidelines**: Read [guidelines.md](./guidelines.md) before executing ANY tasks below.

Check off items as completed.

## Solution Setup

- [ ] Create asset directories:
  ```
  mkdir -p assets/nomination-eta-agent \
            assets/historical-nomination-agent \
            assets/ais-vessel-tracking-agent \
            assets/geo-weather-agent \
            assets/nomination-eta-cap \
            assets/nomination-eta-n8n
  ```
- [ ] Invoke `setup-solution` skill to create `solution.yaml` and `asset.yaml` files for every asset
- [ ] Validate all `asset.yaml` and `solution.yaml` files exist and are well-formed

## Asset Implementation

- [ ] Execute specification/historical-nomination-agent/specification.md (all items)
- [ ] Execute specification/ais-vessel-tracking-agent/specification.md (all items)
- [ ] Execute specification/geo-weather-agent/specification.md (all items)
- [ ] Execute specification/nomination-eta-agent/specification.md (all items)
- [ ] Execute specification/nomination-eta-cap/specification.md (all items)
- [ ] Execute specification/nomination-eta-n8n/specification.md (all items)

## Cross-Asset Compatibility Check

- [ ] Verify the orchestrator agent (`nomination-eta-agent`) can reach all three specialist agents via A2A `/.well-known/agent.json` endpoints
- [ ] Verify the CAP service ETA approval endpoint is aligned with the orchestrator's write-back payload shape (nomination_id, eta, decision, reasoning)
- [ ] Verify the n8n workflow webhook URL matches the orchestrator agent's expected trigger endpoint
- [ ] Verify all agents use the same audit log event schema when writing to the CAP audit service
- [ ] Verify environment variable names are consistent across all `asset.yaml` files (OGS_BASE_URL, OGS_AUTH_TOKEN, AISSTREAM_API_KEY, ACLED_API_KEY)
- [ ] Fix any mismatches before marking implementation complete
