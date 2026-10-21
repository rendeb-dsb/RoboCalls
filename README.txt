RoboCalls — Build 1 Version 1 (b1v1)

Files:
- index.html: single-screen app
- style.css: screen styling
- app.js: IndexedDB storage and counter behavior
- manifest.json: PWA metadata

How it works:
- Each outcome has a radio button, an integer count, and a label.
- Selecting an outcome increments its count and highlights that count in bold red.
- The radio button clears after 2 seconds.
- Goal accepts integers 0 through 999.
- Count is the sum of all outcome counters.
- Remaining is max(Goal - Count, 0).
- "Goal reached!" appears when Count is greater than or equal to Goal.
- Leaving the Goal field resets every outcome count to zero.
- Counts are stored locally in IndexedDB on this browser/device.

To use with GitHub Pages:
1. Unzip the archive.
2. Upload the files inside the RoboCalls-b1v1 folder to the root of your GitHub repository (or upload the folder contents into the desired app directory).
3. Enable GitHub Pages in the repository settings.
4. Open the published site in your phone browser. Add it to the home screen if desired.

Note: IndexedDB data is local to the browser/device and is not synchronized across devices.
