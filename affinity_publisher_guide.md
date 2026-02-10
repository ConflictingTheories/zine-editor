# AFFINITY PUBLISHER IMPLEMENTATION GUIDE
## The Void Chronicles - Technical Setup Instructions

---

## PREREQUISITE CHECKLIST

Before beginning, ensure you have:
- [ ] Affinity Publisher (v2.0 or later recommended)
- [ ] Font files for selected typefaces installed
- [ ] High-resolution graphic assets (borders, symbols, textures)
- [ ] Color palette values ready for import
- [ ] Sample content for testing

---

## PHASE 1: DOCUMENT FOUNDATION

### Step 1: Create New Document

1. **Launch Affinity Publisher**
2. **File → New Document**
3. **Configure Document Settings:**
   ```
   Document Type: Print
   Document Units: Inches
   
   Page Setup:
   - Page Width: 8.5"
   - Page Height: 11.0"
   - Orientation: Landscape
   - Facing Pages: ✓ ENABLED
   - Pages: Start with 32
   
   Margins:
   - Top: 0.5"
   - Bottom: 0.625"
   - Outside: 0.5"
   - Inside (Binding): 0.75"
   - Mirror margins: ✓ ENABLED
   
   Bleed:
   - All sides: 0.125"
   
   Color:
   - Color Format: CMYK/16
   - Color Profile: US Web Coated (SWOP) v2
   ```

4. **Create Document**

### Step 2: Set Up Baseline Grid

1. **View → Show Baseline Grid** (verify it's visible)
2. **Preferences → Grids and Rulers → Baseline Grid**
   ```
   Start: 0.625" (aligns with bottom margin)
   Spacing: 12pt (matches body text leading)
   Color: Light gray (for visibility)
   ```
3. **Apply**

### Step 3: Create Column Guides

1. **View → Guides Manager**
2. **Add Vertical Guides for 3-Column System**
   
   **For Left (Even) Pages:**
   ```
   Left margin edge: 0.5"
   Column 1 end: 3.5"
   Gutter: 3.75"
   Column 2 end: 7.0"
   Gutter: 7.25"
   Column 3 end: 10.5"
   Right margin edge: 10.75"
   ```
   
   **For Right (Odd) Pages:**
   ```
   Left margin edge: 0.75"
   Column 1 end: 4.0"
   Gutter: 4.25"
   Column 2 end: 7.5"
   Gutter: 7.75"
   Column 3 end: 11.0"
   Right margin edge: 11.25"
   ```

3. **Save Guides as Template** (will apply to master pages)

---

## PHASE 2: COLOR SYSTEM SETUP

### Step 1: Create Color Palette

1. **Window → Swatches** (or F9)
2. **Click Palette Menu → Create Palette**
3. **Name:** "Void Chronicles Master"

### Step 2: Add Primary Colors

Click **Add Color** for each:

```
NAME                HEX       CMYK EQUIVALENT
────────────────────────────────────────────
Void Black          #0A0A0A   C:0  M:0  Y:0  K:100
Blood Crimson       #8B0000   C:0  M:100 Y:100 K:45
Bone White          #F5F5DC   C:0  M:0  Y:6  K:4
Arcane Purple       #4B0082   C:70 M:100 Y:0  K:49
Eldritch Green      #00FF41   C:100 M:0  Y:75 K:0
Gold Leaf           #FFD700   C:0  M:15 Y:100 K:0
Silver Steel        #C0C0C0   C:0  M:0  Y:0  K:25
Shadow Gray         #2C2C2C   C:0  M:0  Y:0  K:83
```

### Step 3: Add Tertiary Colors (Volume Variants)

```
Inferno Orange      #FF4500   C:0  M:73 Y:100 K:0
Toxic Magenta       #FF00FF   C:0  M:100 Y:0  K:0
Lightning Blue      #00BFFF   C:100 M:25 Y:0  K:0
Plague Yellow       #CCFF00   C:20 M:0  Y:100 K:0
```

### Step 4: Create Tint Variations

For each primary color, create 50% and 25% tint swatches:
1. Select base color
2. **Right-click → Create Tint**
3. Set percentage
4. Name: "[Color Name] 50%" or "[Color Name] 25%"

---

## PHASE 3: TYPOGRAPHY SYSTEM

### Step 1: Install Required Fonts

**Recommended Font Stack:**
- **Blackletter:** Old London, Cloister Black, or UnifrakturMaguntia
- **Display Sans:** Bebas Neue, Oswald, or League Gothic
- **Body Serif:** Crimson Text, EB Garamond, or Libre Baskerville
- **Grunge/Special:** Special Elite, VT323, or Courier Prime
- **Monospace:** Source Code Pro, Courier Prime, or IBM Plex Mono

### Step 2: Create Paragraph Styles

**Window → Text Styles → Paragraph Styles**

Click **+** to create each style:

#### HEADING 1 (Main Titles)
```
Name: Heading 1 - Main Title
Font: Old London (or chosen blackletter)
Size: 36pt
Leading: 40pt
Alignment: Left
Color: Void Black
Font Features: All Caps
Spacing Before: 0pt
Spacing After: 12pt
```

#### HEADING 2 (Section Heads)
```
Name: Heading 2 - Section
Font: Bebas Neue
Size: 24pt
Leading: 28pt
Alignment: Left
Color: Blood Crimson
Tracking: 50
Spacing Before: 18pt
Spacing After: 8pt
```

#### HEADING 3 (Subsections)
```
Name: Heading 3 - Subsection
Font: Bebas Neue
Size: 18pt
Leading: 22pt
Alignment: Left
Color: Shadow Gray
Tracking: 30
Spacing Before: 12pt
Spacing After: 6pt
```

#### BODY TEXT
```
Name: Body Text - Standard
Font: Crimson Text Regular
Size: 10pt
Leading: 14pt (aligns with baseline grid)
Alignment: Justified
Hyphenation: Enabled
Color: Void Black
Spacing Before: 0pt
Spacing After: 6pt
Align to Baseline Grid: ✓
```

#### BODY TEXT - FIRST PARAGRAPH
```
Name: Body Text - First Para
Based On: Body Text - Standard
Nested Style: Drop Cap (first 1 character)
Spacing Before: 0pt
```

#### DROP CAP (Character Style)
```
Name: Drop Cap
Font: Old London or Crimson Text Bold
Size: 48pt
Color: Blood Crimson
Lines: 3
```

#### PULL QUOTE
```
Name: Pull Quote
Font: Crimson Text Italic
Size: 14pt
Leading: 18pt
Alignment: Center
Color: Arcane Purple
Spacing Before: 18pt
Spacing After: 18pt
Indent Left: 0.5"
Indent Right: 0.5"
```

#### BYLINE
```
Name: Byline
Font: Bebas Neue
Size: 10pt
Leading: 12pt
Alignment: Left
Color: Shadow Gray
Tracking: 100
Font Features: All Caps
Spacing After: 12pt
```

#### DECK/INTRO
```
Name: Deck
Font: Crimson Text Italic
Size: 12pt
Leading: 16pt
Alignment: Left
Color: Arcane Purple
Spacing After: 16pt
```

#### SIDEBAR TEXT
```
Name: Sidebar - Body
Font: Special Elite Regular
Size: 8pt
Leading: 11pt
Alignment: Left
Color: Eldritch Green
Spacing After: 6pt
```

#### SIDEBAR TITLE
```
Name: Sidebar - Title
Font: Bebas Neue
Size: 11pt
Leading: 14pt
Alignment: Left
Color: Gold Leaf
Tracking: 50
Font Features: All Caps
Spacing After: 6pt
```

#### CAPTION
```
Name: Caption
Font: Crimson Text Regular
Size: 8pt
Leading: 10pt
Alignment: Left
Color: Shadow Gray
Spacing After: 6pt
```

#### FOOTER TEXT
```
Name: Footer
Font: Bebas Neue
Size: 8pt
Leading: 10pt
Alignment: Outside (alternates left/right)
Color: Shadow Gray
Tracking: 50
```

### Step 3: Create Character Styles

**Window → Text Styles → Character Styles**

#### BOLD EMPHASIS
```
Name: Emphasis - Bold
Font: Crimson Text Semibold
Color: Inherit
```

#### ITALIC EMPHASIS
```
Name: Emphasis - Italic
Font: Crimson Text Italic
Color: Inherit
```

#### REDACTED
```
Name: Special - Redacted
Background Color: Void Black
Text Color: Bone White
Padding: 2pt all sides
```

#### TIMESTAMP
```
Name: Special - Timestamp
Font: Source Code Pro
Size: 9pt
Color: Shadow Gray
Tracking: 0
Font Features: Tabular Figures
```

#### SPEAKER LABEL
```
Name: Dialog - Speaker
Font: Bebas Neue
Font Features: All Caps
Color: Blood Crimson
Tracking: 50
```

---

## PHASE 4: MASTER PAGE CREATION

### Master Page A: COVER

1. **Window → Master Pages**
2. **Right-click → Add Master Page**
3. **Name:** "A-Cover"
4. **Based On:** None
5. **Pages:** Single (right page only)

**Build Cover Template:**

1. **Background Rectangle:**
   - Draw rectangle from bleed to bleed
   - Fill: Gradient (Void Black → Shadow Gray → Void Black)
   - Opacity: 100%
   - Lock layer

2. **Border Frame:**
   - Rectangle: 0.25" inside trim
   - Stroke: 2pt, Gold Leaf
   - No Fill
   - Effects → Outer Shadow (optional)

3. **Ornamental Corners:**
   - Place corner decorations (pre-made assets)
   - Position at border intersections
   - Group and lock

4. **Title Zone (Text Frame):**
   - Position: Top third, centered
   - Width: 90% of page width
   - Apply: Heading 1 style (will be overridden per volume)
   - Placeholder text: "ISSUE TITLE"

5. **Central Art Frame:**
   - Picture frame: Center of page, 60% coverage
   - Stroke: 1pt, Gold Leaf 25%
   - Placeholder: "HERO ART PLACEMENT"

6. **Issue Information Bar:**
   - Rectangle: Bottom of page, full width
   - Height: 0.5"
   - Fill: Gold Leaf
   - Text frames for: Volume | Theme | Date

7. **Volume Number (Decorative):**
   - Text frame: Top right
   - Style: Large Roman numeral
   - Font: Old London, 72pt
   - Color: Blood Crimson 25%
   - Rotation: 15°

### Master Page B: INTERIOR STANDARD

1. **Add Master Page → "B-Interior"**
2. **Pages:** Facing pages enabled

**Left Page Setup:**

1. **Header Bar:**
   - Line: Top margin, full width
   - Stroke: 0.5pt, Blood Crimson
   - Text frame above: "The Void Chronicles" (left) | "Vol. X" (right)
   - Style: Footer

2. **Body Text Frame:**
   - 3-column text frame
   - Margins: Follow guides
   - Link threading: Enable

3. **Page Number:**
   - Text frame: Bottom left corner
   - Content: "#" (auto page number)
   - Style: Custom (Bebas Neue, 18pt, Blood Crimson)
   - Background circle or shape optional

**Right Page Setup:**
Mirror of left page with page number on right

### Master Page C: STORY OPENING

1. **Add Master Page → "C-Story-Open"**
2. **Based On:** B-Interior
3. **Modifications:**

**Left Page:**
- Retain header and footer
- Single column text frame
- Sidebar frame (optional)

**Right Page:**
- Header only (no body text frame)
- Large image frame: 60% of page
- Title overlay zone
- Small text frame for opening paragraph

### Master Page D: FULL-BLEED FEATURE

1. **Add Master Page → "D-Feature"**
2. **No headers/footers**
3. **Full-bleed image frame** (entire spread)
4. **Text frames** with background fills for readability
5. **Page numbers** in corners only

### Master Page E: BACK COVER

1. **Add Master Page → "E-Back"**
2. **Single page** (right)
3. Similar to cover but with:
   - Credits section
   - Contact info boxes
   - "Next Issue" preview panel
   - Barcode placement area (if needed)

---

## PHASE 5: OBJECT STYLES & ASSETS

### Create Object Styles

**Window → Object Styles**

#### SIDEBAR BOX
```
Name: Sidebar - Standard
Fill: Shadow Gray
Stroke: 4pt left, Eldritch Green
Effects: Inner Shadow (2pt, 50% opacity)
Corners: Square
Padding: 12pt all sides
```

#### PULL QUOTE FRAME
```
Name: Pull Quote Frame
Fill: Arcane Purple 5%
Stroke: 2pt top/bottom, Blood Crimson
Padding: 18pt all sides
```

#### IMAGE FRAME - PORTRAIT
```
Name: Image - Portrait
Stroke: 2pt, Void Black
Effects: Outer Shadow (4pt offset, 30% opacity)
Fit: Fill Frame Proportionally
```

#### IMAGE FRAME - LANDSCAPE
```
Name: Image - Landscape
(Same as Portrait)
```

#### ORNAMENTAL DIVIDER
```
Name: Divider - Standard
Stroke: 1pt, Gold Leaf
Line Style: Custom pattern or solid
Width: 50% of column
Alignment: Center
```

### Create Asset Library

1. **Window → Assets**
2. **Create Category:** "Void Chronicles"
3. **Add Subcategories:**
   - Borders
   - Symbols
   - Textures
   - Icons
   - Dividers

**Import or Create:**
- Medieval border elements (corners, sides)
- Occult symbols (pentagrams, sigils, runes)
- Texture overlays (paper, concrete, metal)
- Faction icons (if applicable)
- Decorative separators

---

## PHASE 6: PAGE LAYOUT EXAMPLES

### Example 1: Article Opening Spread

**Pages 4-5** (using Master C)

1. **Apply Master Page:** C-Story-Open
2. **Left Page (4):**
   - Header: Auto-populated from master
   - Main text frame: Article body flows
   - Sidebar: Add "Classified Intel" box
     - Apply Sidebar Box object style
     - Insert sidebar text with Sidebar styles

3. **Right Page (5):**
   - Place hero image in image frame
   - Add title text frame over image
   - Apply Heading 1 with white color (if over dark image)
   - Add drop shadow to title for readability
   - Opening paragraph frame at bottom

### Example 2: Standard Content Pages

**Pages 6-7** (using Master B)

1. **Apply Master Page:** B-Interior
2. **Create continuous text flow:**
   - Click first text frame
   - Text → Threading → Enable
   - Link frames across spread

3. **Add pull quote:**
   - Draw text frame spanning 2 columns
   - Apply Pull Quote style
   - Position in natural break in text

4. **Insert spot illustration:**
   - Place image in single column
   - Text wrapping: Around object
   - Offset: 0.125"

### Example 3: Interview Layout

**Pages 8-9** (using Master B)

1. **Modify text frames for 2-column:**
   - Delete default 3-column frames
   - Create 2-column text frames
   - Wider columns for dialog

2. **Speaker identification:**
   - Apply Speaker Label character style
   - Format: "SPEAKER NAME:"
   - Body text follows on same line or next

3. **Add headshots (optional):**
   - Small circular image frames
   - Position left of speaker names
   - Stroke: 2pt, relevant color per speaker

---

## PHASE 7: PREFLIGHT & EXPORT

### Preflight Check

1. **File → Preflight**
2. **Profile:** Create custom profile
   ```
   Checks:
   - Images: Min 300 DPI
   - Color Space: CMYK only
   - Fonts: All embedded
   - Bleed: 0.125" minimum
   - No RGB colors
   - No low-resolution images
   - No missing links
   ```
3. **Run Check** on document
4. **Resolve any errors**

### Export for Print

**File → Export → PDF (for print)**

```
Settings:
- Preset: PDF/X-1a:2001 or PDF/X-4
- Pages: All or Range
- Area: Whole Document

Image:
- Resample: None (keep original)
- Compression: JPEG (Maximum Quality)

Color:
- Convert to CMYK: ✓
- Profile: US Web Coated (SWOP) v2

Fonts:
- Embed all fonts: ✓
- Subset fonts: ✓ (>50%)

Marks and Bleeds:
- Crop Marks: ✓
- Bleed Marks: ✓
- Use Document Bleed Settings: ✓

Output:
- Simulate Overprint: ✓
```

**Export**

### Test Print

1. **Print single spread** on home printer
2. **Check:**
   - Text readability
   - Image quality
   - Color appearance (will differ from commercial print)
   - Fold alignment (test actual fold)
   - Margin safety (nothing cut off)

3. **Adjust as needed** before production run

---

## PHASE 8: TEMPLATE FINALIZATION

### Save as Template

1. **File → Save As**
2. **Format:** Affinity Publisher Template (.aftemplate)
3. **Name:** "Void-Chronicles-Master-Template.aftemplate"
4. **Location:** Safe, backed-up directory

### Create Variant Templates

Save additional templates for:
- **Cover Only:** For quick cover designs
- **Interior Only:** For content production
- **Special Features:** For unique layouts
- **Quick-Start:** Simplified version with fewer pages

### Documentation

Create a **README.txt** file including:
```
THE VOID CHRONICLES - AFFINITY PUBLISHER TEMPLATE
Version 1.0

CONTENTS:
- Master template file (.aftemplate)
- Font list and install instructions
- Asset library (borders, symbols, textures)
- Color palette (.afpalette export)
- Style sheets (.afstyles export)
- Sample content PDF
- This documentation

USAGE:
1. Install required fonts
2. Import color palette
3. Open template in Affinity Publisher
4. Duplicate master template before editing
5. Apply master pages to new pages
6. Flow content into text frames
7. Replace placeholder images
8. Export using PDF/X-1a profile

NOTES:
- Always work from a copy, never the original template
- Maintain style consistency across volumes
- Test print before production runs
- Keep asset library organized

SUPPORT:
[Your contact information]
```

---

## TIPS & BEST PRACTICES

### Workflow Efficiency

1. **Use Snippets:** Save common layouts as snippets for quick insertion
2. **Asset Management:** Organize assets in subcategories for quick access
3. **Style Overrides:** Minimize manual overrides; update styles instead
4. **Layer Management:** Name layers clearly (Text, Images, Background, etc.)
5. **Backup Frequently:** Save incremental versions (v1, v2, v3...)

### Common Pitfalls to Avoid

1. **Don't embed RGB images** - always convert to CMYK first
2. **Don't use transparency effects excessively** - can cause print issues
3. **Don't ignore safety margins** - important content should stay inside
4. **Don't manually format text** - always use styles
5. **Don't skip preflight** - catch errors before printing

### Advanced Techniques

1. **Data Merge:** For personalized copies or variant covers
2. **Master Page Chains:** Create hierarchies for complex templates
3. **GREP Styles:** Automate formatting for repeated patterns
4. **Linked Resources:** Keep source files organized for batch updates
5. **Version Control:** Maintain separate files for each volume

---

## TROUBLESHOOTING

### Issue: Text Not Aligning to Baseline Grid
**Solution:** 
- Check paragraph style has "Align to Baseline Grid" enabled
- Verify leading is multiple of baseline grid spacing
- Adjust spacing before/after to align

### Issue: Images Appearing Low Resolution
**Solution:**
- Check DPI in preflight (should be 300+)
- Replace with higher resolution versions
- Use "High Quality" display mode to verify

### Issue: Colors Look Different Than Expected
**Solution:**
- Verify document is in CMYK mode
- Check color swatches are CMYK values
- Remember: screen display ≠ print output
- Request printed proof from printer

### Issue: Text Overflow (red + icon)
**Solution:**
- Link to additional frames (threading)
- Adjust text frame size
- Reduce text size or leading
- Edit content length

### Issue: Master Page Elements Not Updating
**Solution:**
- Verify override isn't applied to elements
- Right-click → Release from Master (then reapply)
- Check correct master page is applied

---

## NEXT STEPS

After template creation:

1. **Create Volume 1** using template
2. **Test full production workflow** from creation to print
3. **Refine template** based on real-world usage
4. **Document any changes** to template
5. **Train team members** on template use (if applicable)
6. **Establish content calendar** for regular production
7. **Build asset library** continuously
8. **Create style guide** for contributors

---

## RESOURCES

### Recommended Learning
- Affinity Publisher Official Workbook
- Typography fundamentals for publication design
- Print production specifications
- CMYK color management

### Helpful Tools
- Adobe Color (color palette creation)
- FontPair (font combination suggestions)
- PrintFriendly (PDF optimization)
- Preflight tools for validation

### Community
- Affinity Forums (official support)
- Designer communities (Behance, Dribbble)
- Zine communities (distros, publishers)
- Local print shops (technical consultation)

---

*This implementation guide is designed to be comprehensive yet practical. Follow the phases in order for best results. Adjust as needed for your specific workflow and production requirements.*

**The template is your grimoire. Master it, and the Void will speak through you.**

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Compatible With:** Affinity Publisher 2.0+
