# Confidence Rules

| Sample Size | Confidence | Recommendation |
|-------------|------------|----------------|
| ≥ 10 records | **High** | Reliable statistical basis. Use directly. |
| 5–9 records | **Medium** | Reasonable basis. Flag limited sample in reasoning. |
| < 5 records | **Low** | Insufficient history. Widen filter or flag for manual review. |

## Filter Widening Rules

If exact match (material + transport system + origin + destination) returns < 5 records:

1. Drop destination filter → keep material + transport system + origin
2. If still < 5 → drop origin → keep material + transport system
3. If still < 5 → keep material only
4. Always document the widened filter in reasoning

## Outlier Rules

Exclude from statistics:
- Lead time < 0 days (data error)
- Lead time > 90 days (exceptional event — note separately if present)
