RoboCalls — Build 1 Version 1 (b1v1)

Files:
- index.html: single-screen app
- style.css: layout and styling
- app.js: IndexedDB storage and daily records
- manifest.json: PWA metadata

Features:
- 11 robocall outcome counters.
- Selecting an outcome increments its count; the selected count is bold red.
- All count and label styling is cleared when a new radio button is selected, then the new selected count is highlighted.
- Radio selection clears after 2 seconds.
- Goal accepts integers 0 through 999.
- Count is the sum of the daily outcome counts.
- Remaining is max(Goal - Count, 0).
- "Goal reached!" appears when Count is greater than or equal to Goal.
- Done saves the current date's goal and counters.
- Remove Last decrements the most recently incremented outcome counter by one and highlights that count in bold green.
- Reaching the goal saves the current date's goal and counters.
- The date at the right of the title opens a date picker.
- On launch or date change, the app loads that day's saved Goal and outcome counters from IndexedDB.
- Leaving the Goal field resets that day's outcome counters, as requested.
- Data is stored locally on the device/browser; there is no cross-device synchronization.

To use with GitHub Pages:
1. Unzip the archive.
2. Upload the files inside the RoboCalls-b1v1 folder to your repository.
3. Enable GitHub Pages in repository settings.
4. Open the published site on your phone browser.

- Done and Remove Last buttons are on the line below Goal/Count/Remaining.
- Keep lit: Off/On uses the browser Screen Wake Lock API when supported; it defaults to Off at app load.
