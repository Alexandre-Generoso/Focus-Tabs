# FocusTabs

**FocusTabs** is a browser extension that lets you save your open tabs as a named session and restore them later — so you can switch context without losing your place.

Working on a research topic? Save it. Jumping to another project? Save that too. Come back to either one with a single click.

---
## Screenshot

<img width="386" height="470" alt="image" src="https://github.com/user-attachments/assets/78b598ee-bf2e-4fbb-bcdf-2de51488a7c7" />

## What it does

| Action | Description |
|---|---|
| **Save Current Tabs** | Snapshots all open tabs in the current window into a named session |
| **Open Session** | Reopens every URL from a saved session in new tabs |
| **Close Session Tabs** | Closes any currently open tabs that belong to a specific session |
| **Expand Session** | Click a session card to see the list of pages saved in it |
| **Delete Session** | Permanently removes a session from your saved list |
| **Theme Picker** | Swap between 4 color themes — Ocean, Orange, Berry, and Green |

All sessions are saved locally in your browser using `chrome.storage.local`. Nothing is sent to any server.

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

MIT — do whatever you want with it.
