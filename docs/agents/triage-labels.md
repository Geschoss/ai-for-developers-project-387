# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Auto-triage

`.github/workflows/opencode-triage.yml` triages every new issue from a trusted author and sets `needs-triage` or
`needs-info`. It skips an issue that already carries any label from the table above. Tickets from `to-tickets` and
specs from `to-spec` are created with `ready-for-agent` or `ready-for-human`, so they are not triaged a second time.
Create such issues with `--label`, not by adding the label afterwards: the workflow reads the labels at the moment of
`opened`.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.
