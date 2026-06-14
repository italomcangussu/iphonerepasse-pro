# Quality Baseline

Date: 2026-06-13

| Metric | Baseline |
|---|---:|
| Vitest files/tests | 76 files / 452 tests |
| Line coverage | 61.28% (7,074/11,543) |
| Branch coverage | 48.26% (5,677/11,763) |
| Dependency cycles | 0 |
| Functions with complexity > 5 | 166/832 |
| Files > 200 lines | 69 |
| Duplication | ~4.0% |

Mutation is introduced after the first pure extraction so the initial scope is deterministic.

The initial high-risk target, `services/dataContext.tsx`, starts at 55.66% line
coverage and 39.76% branch coverage.
