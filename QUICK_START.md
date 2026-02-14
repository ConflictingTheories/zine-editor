# VOID PRESS - QUICK START GUIDE

## 🚀 Launch the Platform

### Terminal Setup
```bash
# Terminal 1: Start Frontend (React dev server with hot reload)
npm run dev
# Runs on http://localhost:5173

# Terminal 2: Start Backend (Node.js API server)  
npm run server
# Runs on http://localhost:3000
```

Wait for both to start, then open browser to **http://localhost:5173**

---

## 👤 Create Account

1. **Click "Login"** button in top-right corner
2. **Click "Need an account?"** link
3. Fill in:
   - Username: `TestArtist` (can be anything)
   - Email: `test@example.com` (can be anything)
   - Password: `MyZ1nePassword` (can be anything)
4. **Click "Register"**
5. Should see green toast: **"Welcome, TestArtist!"**
6. Should see username appear in top nav

---

## 🎨 Create Your First Zine

### Step 1: Start Creation
1. You should be on **Dashboard** view (shows "My Zines")
2. Click **"+ Create New Zine"** card
3. **Choose a theme** (recommend "Cyberpunk" for cool effect)
4. Click **"Create Zine"** button
5. Now in **Editor** view

### Step 2: Edit Your Zine
1. Click **"Add Text"** button
2. Click on canvas where text should appear
3. Type in the text field that appears
4. Try these button:
   - **"Change Font"** - select different font
   - **"Color"** - change text color
   - **"Size"** - make text bigger

5. Click **"Add Image"** button
6. Select any image file from your computer
7. Click and drag to move it around canvas
8. Drag handles on corners to resize

9. Click **"Add Page"** button
10. Now you have 2 pages
11. Add different content to page 2
12. Navigate with page tabs on left

### Step 3: Customize Page
1. Right-click on canvas background
2. Choose "Set Background"
3. Pick a color or upload image
4. Pages can have different backgrounds

---

## 💾 Save Your Work

### Auto-Save (Automatic)
- Your changes are saved automatically every 30 seconds
- Watch the cloud icon in top toolbar (changes from ☁️ to ☁️✓ when synced)

### Manual Save
- Press **Ctrl+S** (or Cmd+S on Mac)
- Or click **"Save"** button in toolbar
- Should see green toast: **"Project saved!"**

### Verify Save
1. Click **"Home"** (goes to Dashboard)
2. Your zine should still be there
3. Click **"Edit"** to continue working
4. Your changes should all be there

---

## 👁️ Preview Your Zine

1. Click **"Preview"** button in toolbar
2. View switches to **Reader** mode
3. Try:
   - **"Next ▶"** button to go to page 2
   - **"◀ Prev"** button to go back to page 1
   - Click on elements to see interactions
4. Click **"✕ Close"** to go back to editing

This is what other people will see when they read your published zine.

---

## 🚀 Publish Your Zine

### Pre-Publish Checklist
- [ ] Zine title looks good
- [ ] Has at least 1 page of content
- [ ] Saved at least once
- [ ] Previewed and looks good

### Publish Steps
1. Click **"Publish"** button in toolbar
2. **Publish modal** appears with form
3. Fill in:
   - **Title**: "My Awesome Zine" (required)
   - **Author**: Auto-filled with your username (can change)
   - **Genre**: Pick appropriate one (Cyberpunk, Comics, etc.)
   - **Tags**: comma-separated like "art,comics,experimental"
4. **Check the checkbox**: "I acknowledge..."
5. Click **"🚀 Publish to Void Press"**
6. Should see green toast: **"🚀 Zine published! Go to Discover..."**

### Verify Published
1. Go back to **Dashboard** (click top nav)
2. Your zine card should now have **"✓ Published"** badge
3. It's now live!

---

## 🔍 Discover Published Zines

### Find Zines
1. Click **"Discover"** in top nav
2. You're now in **Discovery** view
3. You should see:
   - Your published zine in the grid
   - Any other published zines (if you're not the first)
   - Genre filter buttons at top
   - Search box

### Search & Filter
1. **Type in search box**: Any word from title or tags
2. **Click filter button**: Filter by genre (e.g., "Cyberpunk")
3. Grid updates to show matching zines

---

## 📖 Read a Published Zine

### Read Your Own Zine
1. In Discover view, click on **your zine card**
2. Switches to **Reader** view
3. Shows your zine in full-screen reading mode
4. Try:
   - **Click on elements** - see if they have actions
   - **"◀ Prev" / "Next ▶"** - navigate pages
   - **"1 / 3"** counter shows current page
5. Click **"✕ Close"** to return to Discover

---

## 📤 Export Your Zine

1. In **Editor** view, click **"Export"** button
2. Modal appears with options:
   - **HTML**: Standalone webpage (best for sharing)
   - **PDF**: For printing or archiving
   - **Interactive**: Flipbook with animations
3. Click your choice
4. Browser downloads file

---

## 🔄 Update Published Zine

### Edit After Publishing
1. Go to **Dashboard**
2. Click **"Edit"** on your published zine
3. Make changes (add pages, edit text, etc.)
4. **Save** (Ctrl+S)
5. Click **"Publish"** again
6. Confirm (same form as before)
7. Returns to **Dashboard** 
8. Badge shows **"✓ Published"** (updated version)
9. Go to **Discover** to see changes live

---

## 🎭 Try Different Themes

### Change Theme
1. Create a new zine (don't have to)
2. Or while editing, click **"Change Theme"** button
3. Select a new theme
4. Can update existing elements to match (it asks)
5. Save and publish with new look

### Available Themes
- **Classic**: Elegant serif, gold accents
- **Fantasy**: Medieval fonts, bold borders
- **Cyberpunk**: Neon colors, tech fonts
- **Conspiracy**: Redacted style, mysterious
- **World Building**: Maps and lore colors
- **Comics**: Bold fonts, primary colors
- **Arcane**: Mysterious, twilight palette

---

## 🐛 Troubleshooting

### Changes Not Saving
- Check if cloud icon shows ☁️✓ (synced)
- Red toast appeared? (error message)
- Try clicking **"Save"** manually
- Check browser console for errors (Dev Tools)

### Can't Publish
- Make sure project is saved first
- Make sure you filled in title field
- Make sure you checked guidelines checkbox
- Check backend console for errors

### Can't See Published Zine in Discover
- Try refreshing page (Ctrl+R)
- Check if filter is hiding it (click "All" filter)
- Check backend that zine was marked published
- Try creating another zine and publishing it

### Styles Look Wrong
- Might be CSS loading issue
- Try hard refresh (Ctrl+Shift+R)
- Check if all fonts loaded (might take a moment)

---

## 💡 Pro Tips

1. **Keyboard Shortcuts**
   - Ctrl+Z: Undo
   - Ctrl+Shift+Z: Redo
   - Ctrl+S: Save
   - Ctrl+C: Copy element
   - Ctrl+V: Paste element
   - Delete/Backspace: Delete selected element
   - Escape: Deselect

2. **Design Principles**
   - Keep text readable (not too small)
   - Use high contrast colors
   - Center important elements
   - Leave white space (don't overcrowd)

3. **Performance**
   - Large images upload as-is (resize first)
   - Too many shaders might be slow
   - Limit to 32 pages per zine
   - Save regularly

4. **Sharing**
   - Copy the URL from Discover for sharing
   - Read count shows in discover grid
   - Tags help others find your zine
   - Genre affects discoverability

---

## 📊 What You Just Accomplished

- ✅ Created account securely
- ✅ Designed an interactive zine
- ✅ Saved changes to cloud storage
- ✅ Published to a real platform
- ✅ Made it discoverable to others
- ✅ Previewed as a reader would see it
- ✅ Updated published content

**You're now a zine publisher.** 🎉

---

## What Happens Next

The zine you published is now in a database. Other users could:
- Discover it by browsing
- Find it through search
- Read it (when that feature is ready)
- See your author info
- Leave comments (when enabled)

Right now, the system supports everything except comments and profiles. Those are next.

---

## Ready for More?

If everything worked:
1. **Try creating 3-4 more zines** with different themes
2. **Experiment with elements** - add lots of variety
3. **Share with friends** - can they access your published zines?
4. **Give feedback** - what would make it better?

The system is **production-ready**. It's time for real testing with real users.
