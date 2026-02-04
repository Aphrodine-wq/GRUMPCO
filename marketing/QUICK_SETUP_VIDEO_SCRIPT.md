# Quick Setup Video Script
## "Install G-Rump in 30 Seconds"

**Target Duration:** 30 seconds  
**Format:** Screen recording with voiceover  
**Resolution:** 1080p (1920x1080)  
**Music:** Upbeat tech background, low volume

---

## Script

### Scene 1: Title Card (0:00 - 0:03)
**Visual:** 
- G-Rump logo animates in
- Text: "Install G-Rump in 30 Seconds"

**Audio:** Short intro sound effect

---

### Scene 2: Terminal - Clone Repository (0:03 - 0:08)
**Visual:**
- Terminal window opens
- Type: `git clone https://github.com/Aphrodine-wq/G-rump.com.git`
- Show cloning progress
- Type: `cd G-rump.com`

**Voiceover:** "First, clone the repository and enter the directory."

**On-screen text:** 
```
git clone https://github.com/Aphrodine-wq/G-rump.com.git
cd G-rump.com
```

---

### Scene 3: Terminal - Install Dependencies (0:08 - 0:15)
**Visual:**
- Type: `npm install`
- Show npm packages installing (sped up)
- Progress bar fills
- Type: `npm run build:packages`
- Show build completing

**Voiceover:** "Install dependencies and build the packages."

**On-screen text:**
```
npm install
npm run build:packages
```

---

### Scene 4: Terminal - Environment Setup (0:15 - 0:20)
**Visual:**
- Type: `cp backend/.env.example backend/.env`
- Open .env file in editor
- Highlight the NVIDIA_NIM_API_KEY line
- Add placeholder key (blur real key if used)
- Save and close

**Voiceover:** "Copy the environment file and add your NVIDIA API key. Free keys at build.nvidia.com"

**On-screen text:**
```
cp backend/.env.example backend/.env
# Add your NVIDIA API key
NVIDIA_NIM_API_KEY=nvapi-xxxx
```

---

### Scene 5: Terminal - Launch Application (0:20 - 0:27)
**Visual:**
- Split terminal view
- Top: Type `cd backend && npm run dev` - show server starting
- Bottom: Type `cd frontend && npm run electron:dev` - show app launching
- Desktop app window opens
- Show G-Rump dashboard loading

**Voiceover:** "Start the backend and launch the desktop app."

**On-screen text:**
```
# Terminal 1
cd backend && npm run dev

# Terminal 2  
cd frontend && npm run electron:dev
```

---

### Scene 6: Success Screen (0:27 - 0:30)
**Visual:**
- G-Rump desktop app fully loaded
- Show main dashboard
- Text overlay: "You're ready to ship! 🚀"
- Call-to-action buttons appear:
  - "Get Started" → docs link
  - "Star on GitHub" → repo link

**Voiceover:** "You're ready to ship. G-Rump is now running."

---

## Complete Script (Voiceover Only)

```
"Install G-Rump in 30 seconds.

First, clone the repository and enter the directory.
Install dependencies and build the packages.
Copy the environment file and add your NVIDIA API key. Free keys at build.nvidia.com.
Start the backend and launch the desktop app.

You're ready to ship. G-Rump is now running."
```

---

## Technical Notes

### Recording Setup
- **Screen Recorder:** OBS Studio or ScreenFlow
- **Terminal:** iTerm2 with custom theme (minimal, dark)
- **Editor:** VS Code with minimal theme
- **Zoom:** Smooth zoom on key commands
- **Cursor:** Highlight clicks with ripple effect

### Typography
- **Font:** Inter or SF Mono for code
- **Size:** 16px minimum for readability
- **Colors:** White text on dark background

### Branding
- Include G-Rump logo in corner (watermark)
- Use brand colors: #6366F1 (primary), #10B981 (success)
- Consistent corner radius on window captures

### Export Settings
- **Format:** MP4 (H.264)
- **Resolution:** 1920x1080
- **Frame Rate:** 30fps
- **Bitrate:** 8-10 Mbps

---

## Alternative: 60-Second Extended Version

If 30 seconds feels rushed, here's an extended version with more context:

### Additional Scenes (30-60s)

**Scene 7: Quick Demo (0:30 - 0:45)**
- Type in prompt: "Create a React todo app with user authentication"
- Show architecture diagram generating
- Show code preview
- Brief glimpse of generated files

**Voiceover:** "Describe your product, get architecture diagrams, PRDs, and working code—instantly."

**Scene 8: Features Overview (0:45 - 0:55)**
- Quick cuts of:
  - Mermaid diagram editor
  - Code generation panel
  - Chat interface with tools
  - Settings/preferences

**Voiceover:** "Architecture-first development. 18x faster builds. 60-70% cost savings."

**Scene 9: Call to Action (0:55 - 1:00)**
- G-Rump logo
- Text: "Start building today"
- URL: g-rump.com
- GitHub button with star count

**Voiceover:** "Get started at g-rump.com. Star us on GitHub."

---

## Video Assets Needed

- [ ] G-Rump logo animation (intro/outro)
- [ ] Background music license
- [ ] Sound effects (subtle clicks, success chime)
- [ ] Lower third graphics for commands
- [ ] End screen template

---

## Distribution Platforms

1. **YouTube** - Main channel, SEO optimized
2. **Twitter/X** - Short version (30s), vertical crop
3. **LinkedIn** - Professional context
4. **Product Hunt** - Embedded in gallery
5. **GitHub** - README and releases
6. **Website** - Hero section background
