---
name: water_point_priorities
kind: code                    # no model call: plain code, registered so staff find one list
owner: MERL
workflow: [M1]
data_classes: [Confidential]
tier: 1
approver: MERL Lead
output: PriorityGroup
checks: []
---

Documents the rule in `lib/kijana/metrics.ts` (`priorityGroups`). Nothing here is sent to a model.

Each water point gets the first group that matches, from its latest visit on or before the cut-off:
1. `red_fast_track`: not working and no repair recorded.
2. `red_unsafe`: the latest water-quality test is a fail.
3. `amber_partly`: partly working.
4. `amber_repair_recorded`: not working, with a repair recorded.
5. `green`: everything else.

The Kijana team sets repair deadlines; this list only says which points to look at first.
