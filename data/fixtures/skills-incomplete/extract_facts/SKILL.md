---
name: extract_facts
kind: ai
workflow: [I2]
data_classes: [Confidential]
tier: 2
approver: Grants & Compliance Officer
output: ExtractSchema
checks: []
---

Test fixture: a skill whose frontmatter has no `owner`. It is not registered, so runStep must refuse to run it.
