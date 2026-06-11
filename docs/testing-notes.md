# Testing Notes

## Manual Smoke Test

Before publishing changes, check:

- The welcome screen loads
- Demo contacts can be added
- Manual contacts can be added and deleted
- CSV import opens a preview before import
- `.vcf` import opens a preview before import
- Duplicate imported contacts are skipped where possible
- Week 1 Census only asks In Kingdom / Outside Kingdom
- Week 2 remains locked until Census is complete
- Week 2 Foundation fields save for Kingdom members
- Real name / cast name toggle works
- Week 3 remains locked until Foundation is complete
- Week 3 spheres can be placed into Inner Counsel, Knights, Nobles, Courtiers and Villagers
- Weeks 4-6 display as locked only

## Browser Storage

The app uses local browser storage. To test a fresh state, use the in-app reset button or clear browser site data.
