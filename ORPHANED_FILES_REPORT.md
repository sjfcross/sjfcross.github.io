# GitHub Pages Repository - Complete Unused/Orphaned Files Analysis

## Methodology
- **Root Entry Point**: `index.html`
- **Analysis Method**: Complete reachability graph mapping from root, following all href/src links recursively
- **Scope**: Identified files that do NOT appear in any reachable link chain from `index.html`

---

## TRULY ORPHANED/UNREACHABLE FILES

### ✗ ORPHANED HTML PAGES IN `/pages/` DIRECTORY

**1. `pages/vidbas1.html`**
- Status: ORPHANED (unreachable)
- Link chain: NONE - No page links to this file
- No incoming links from: index.html, index1-5.html, youtube1.html, mdn1.html, csb1.html, or any other pages
- Content: Image gallery page with hover effects (grid layout showcase)
- Recommendation: DELETE (unless manually typed URL needed)

**2. `pages/workout1.html`**
- Status: ORPHANED (unreachable)  
- Link chain: NONE - No page links to this file
- No incoming links from: index.html, index1-5.html, or any other pages
- Content: "Workout-Log SJ" page with hardcoded header "Progress, not Perfection"
- Note: Contains commented-out navigation accordion suggesting this is an incomplete/abandoned page
- Recommendation: DELETE (appears abandoned - navigation section is commented out)

**3. `pages/about-us.html`**
- Status: ORPHANED (unreachable)
- Link chain: NONE - Not linked from index.html or anywhere
- Content: Material Kit 2 template page (unmodified template content about "Work with amazing design")
- Type: Unused template file
- Recommendation: DELETE (template boilerplate, not integrated into site)

**4. `pages/author.html`**
- Status: ORPHANED (unreachable)
- Link chain: NONE - Not linked from index.html or anywhere  
- Content: Material Kit 2 template "blog author" page (unmodified template about "Michael Roven")
- Type: Unused template file
- Recommendation: DELETE (template boilerplate, not customized)

**5. `pages/sign-in.html`**
- Status: ORPHANED (unreachable)
- Link chain: NONE - Not linked from index.html or anywhere
- Content: Material Kit 2 login form template (unmodified template)
- Type: Unused template file  
- Recommendation: DELETE (template boilerplate, no authentication system implemented)

---

### ✗ ORPHANED HTML PAGE AT ROOT LEVEL

**6. `testit.html`**
- Status: ORPHANED (unreachable from main site)
- Link chain: NOT linked from index.html
- Issue: Despite being linked by Old Page button (`./index1.html`), testit.html is an OLD DUPLICATE of index1.html
- Navigation: Contains identical old navigation structure as index1.html pointing to same subpages
- Recommendation: DELETE (testit.html is a duplicate of index1.html - keep index1.html only, remove testit.html)

---

### ⚠ BROKEN LINK ISSUE

**7. `pages/sixties.html` - DOES NOT EXIST**
- Referenced by: `pages/youtube1.html` (Division III YouTube page)
- Link: `<a href="../pages/sixties.html" class="yt-card">`
- Status: **BROKEN LINK** - File is linked but doesn't exist
- Impact: Users clicking "The Sixties" music collection on youtube1.html will get 404 error
- Recommendation: 
  - Option A: Create the missing `pages/sixties.html` file with similar structure to reggae.html, progrock.html, etc.
  - Option B: Remove the sixties.html card link from youtube1.html if not needed

---

## REACHABLE FILES (NOT ORPHANED)

### ✓ Primary/Division Pages (Directly linked from index.html)
- `pages/mdn1.html` → Division I (MDN) ✓
- `pages/csb1.html` → Division II (Colt Steele Bootcamp) ✓
- `pages/youtube1.html` → Division III (YouTube Favorites) ✓
- `pages/test1.html` → Division IV (Slideshow) ✓
- `pages/animals.html` → Division V (Animals) ✓
- `index1.html` → Old Page ✓

### ✓ YouTube Audio/Video Pages (Linked from youtube1.html)
- `pages/nneka.html` ✓ (index.html → youtube1.html → nneka.html)
- `pages/tomwaits.html` ✓ (index.html → youtube1.html → tomwaits.html)
- `pages/progrock.html` ✓ (index.html → youtube1.html → progrock.html)
- `pages/reggae.html` ✓ (index.html → youtube1.html → reggae.html)
- `pages/ralphkaminski.html` ✓ (index.html → youtube1.html → ralphkaminski.html)

### ✓ Colt Steele Bootcamp Pages (Linked from csb1.html)
- `pages/csbc1.html` through `pages/csbc34.html` ✓ (All 34 pages linked from index.html → csb1.html)

### ✓ MDN Tutorial Pages (Linked from mdn1.html)  
- `pages/mdn2.html` through `pages/mdn34.html` ✓ (All 34 pages linked from index.html → mdn1.html)

### ✓ Archive/Old Site Pages (Linked from index1.html)
- `index2.html` through `index5.html` ✓
- `pages/inline1.html` through `pages/inline14.html` ✓
- Various subpages in `/subpages/` directory ✓

---

## SUMMARY TABLE

| File | Type | Status | Action | Reason |
|------|------|--------|--------|--------|
| pages/vidbas1.html | HTML | ORPHANED | DELETE | No links to it; unreachable |
| pages/workout1.html | HTML | ORPHANED | DELETE | No links to it; appears abandoned |
| pages/about-us.html | HTML | ORPHANED | DELETE | Unused template file |
| pages/author.html | HTML | ORPHANED | DELETE | Unused template file |
| pages/sign-in.html | HTML | ORPHANED | DELETE | Unused template file |
| testit.html | HTML | ORPHANED | DELETE | Duplicate of index1.html; not linked |
| pages/sixties.html | MISSING | BROKEN LINK | CREATE or UNLINK | Referenced but doesn't exist |

---

## DELETION RECOMMENDATION

**Delete these 6 files to clean up the repository:**
```
f:\sjfcross.github.io\pages\vidbas1.html
f:\sjfcross.github.io\pages\workout1.html
f:\sjfcross.github.io\pages\about-us.html
f:\sjfcross.github.io\pages\author.html
f:\sjfcross.github.io\pages\sign-in.html
f:\sjfcross.github.io\testit.html
```

**Before deletion, verify:**
1. These files are not in `.gitignore` exceptions
2. No external links point to these files
3. No JavaScript dynamically link to these pages

**Additional fix needed:**
- Either create `pages/sixties.html` or remove the sixties.html link from `pages/youtube1.html`

---

## VERIFICATION NOTES

✓ Confirmed index.html is the main entry point  
✓ Traced all links recursively through all 5 divisions  
✓ Verified testit.html is NOT linked from index.html  
✓ Confirmed vidbas1.html and workout1.html have NO incoming links from any page  
✓ Confirmed about-us.html, author.html, sign-in.html are unused templates  
✓ Identified broken link to non-existent sixties.html in youtube1.html  
✓ All reachable files verified to have proper link chains

**Analysis Date**: April 15, 2026  
**Repository**: f:\sjfcross.github.io  
**Total Orphaned Files**: 6 HTML files + 1 broken link
