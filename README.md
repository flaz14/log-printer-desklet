log-printer-desklet
========

Desklet for Cinnamon Desktop Environment that prints selected log file like `tail -f` does it.

### Desklet itself
<img src="https://github.com/flaz14/log-printer-desklet/blob/master/images/screenshot-full-desklet.png" />

### Settings window
<img width="50%" src="https://github.com/flaz14/log-printer-desklet/blob/master/images/screenshot-settings-window.png" />

### Already implemented:
- Selecting file that have to be tracked (if entered file name is invalid then current desklet content doesn't dissapear, printing will be just paused).
- Filters for suppressing unwanted lines (using JavaScript regular expressions).

### To be implemented:
- Scrolling up to history, optional horizontal scrolling, smart resizing, etc.
- User-defined color schemes (using JavaScript regular expressions).
- "Wallpaper Mode": it means that desklet will not respond on its dragging and right mouse button clicks (but with ability to scroll). In this mode all settings should be done via `System Settings > Desklets`.
