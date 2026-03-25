# FocusTabs

**FocusTabs** is a browser extension that lets you save your open tabs as a named session and restore them later so you can switch context without losing your place.

Working on a research topic? Save it. Jumping to another project? Save that too. Come back to either one with a single click.

---
## Screenshot

<img width="384" height="463" alt="image" src="https://github.com/user-attachments/assets/a16e081b-f831-418c-b419-567193a2a424" />


## What it does

| Action | Description |
|---|---|
| **Save Current Tabs** | Snapshots all open tabs in the current window into a named session |
| **Open Session** | Reopens every URL from a saved session in new tabs |
| **Close Session Tabs** | Closes any currently open tabs that belong to a specific session |
| **Expand Session** | Click a session card to see the list of pages saved in it |
| **Delete Session** | Permanently removes a session from your saved list |
| **Export JSON** | Downloads a backup file with all saved sessions |
| **Import JSON** | Restores sessions from a previously exported JSON file |
| **Theme Picker** | Swap between 4 color themes — Ocean, Orange, Berry, and Green |

All sessions are saved locally in your browser using `chrome.storage.local`. Nothing is sent to any server.

---

## Why FocusTabs instead of Chrome Tab Groups?

Chrome Groups are great for organizing tabs you want open *at the same time*. FocusTabs is for a different workflow — **intentional context switching**.

| | Chrome Tab Groups | FocusTabs |
|---|---|---|
| Survives closing the browser | ✗ unreliable | ✓ always |
| Close all related tabs at once | ✗ | ✓ |
| Snapshot a context over time | ✗ (live only) | ✓ multiple saves |
| Backup and transfer sessions (JSON) | ✗ | ✓ export and import |
| Keeps the tab bar clean | ✗ | ✓ everything is offscreen |

**The use case**: you're deep in a research rabbit hole, but you need to switch to a work task. With Chrome Groups you either leave all those tabs open (wasting memory and attention) or lose them. With FocusTabs you hit Save, close everything, do your work, and come back to exactly where you left off.

---

## How to install (local / developer mode)

> This extension isn't on the Chrome Web Store yet — you load it directly from the source folder.

1. Open your browser and go to `chrome://extensions`
2. Toggle **Developer mode** on (top-right corner)
3. Click **Load unpacked**
4. Select the `Focus-Tabs` folder
5. The extension icon will appear in your toolbar

After any code change, go back to `chrome://extensions` and click the **↺ reload** button on the FocusTabs card.

---

## How to use

1. Open the tabs you want to save
2. Click the FocusTabs icon in your toolbar
3. Type a name for the session (e.g. `"Research"`, `"Work Sprint"`)
4. Click **Save Current Tabs**
5. Your session appears in the list below
6. Click a session card to expand it and see the saved pages
7. Use **Open** to restore the session, or the **✗** button to close matching tabs
8. Use **Export JSON** to back up all sessions
9. Use **Import JSON** to merge sessions from a backup file

---

## Project structure

```
Focus-Tabs/
│
├── manifest.json          # Extension config — tells the browser what this extension is,
│                          # what permissions it needs, and where to find the UI files
│
├── src/
│   ├── popup.html         # The UI markup — the small window that appears when you click
│   │                      # the extension icon
│   ├── popup.js           # All the logic — saving sessions, opening tabs, themes, etc.
│   └── style.css          # Visual styling — colors, layout, animations, themes
│
├── assets/
│   └── icons/
│       ├── icon-16.png    # Tiny icon used in the browser toolbar
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png   # Large icon used in extension management pages
│
├── README.md              # This file
├── .gitignore             # Tells Git which files to ignore (logs, system files, etc.)
└── LICENSE                # MIT — free to use, modify, and share
```

### How the pieces connect

- The **browser reads `manifest.json`** first — it's the entry point that wires everything together
- `manifest.json` points to `src/popup.html` as the popup UI
- `popup.html` loads `style.css` for visuals and `popup.js` for behavior
- `popup.js` talks to the browser via the **Chrome Extensions API** (`chrome.tabs`, `chrome.storage`)
- Icons in `assets/icons/` are referenced in `manifest.json` for toolbar and settings page display

---

## Browser support

Works on any Chromium-based browser:

- Google Chrome
- Microsoft Edge
- Opera
- Brave

---

## License

MIT, do whatever you want with it.
