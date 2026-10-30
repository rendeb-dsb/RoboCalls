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

- Table rows shortened to approximately two-thirds of prior height.
- Goal edits no longer clear counters; use Reset to clear counters.
- Elapsed time displays as hh:mm:ss beside the title and stops at Goal reached or Done.
- List shows outcomes by row and saved dates by column; Radio and Outcome columns are sticky. Back returns to the main screen.


b1v16: Added the Voice mail Direct outcome directly below Voice mail left. Existing saved records are migrated to include a zero count for the new outcome; older JSON backups remain importable, and new exports include the new category count.


b1v17: Renamed the Skip outcome to Silence; added the Dummy outcome before Spoke full message. IndexedDB upgrades preserve previous counts and initialize the new Dummy count to zero. JSON import supports older 10- and 11-category backups and normalizes them to the current 12-category layout. New JSON exports include all 12 outcome counts. Est. Done uses 12-hour time with AM/PM.


b1v18: Progression overflow color after green is pink (followed by yellow and black). Overflow indicators change only after each complete additional 10% of Goal. Added actual percentage complete beside the ten indicators. Increased each indicator diameter by 2px. Outcome radio selection auto-reset delay is now 4 seconds.


b1v19: Shifted Progression 15px right. Setting Goal no longer starts elapsed timer; timer still starts on first outcome selection. Back button now uses the same default light-blue styling as List. Keep Lit is checked and wake-lock request is activated at startup. Added 5px right spacing after the Calls/time rate elements.


b1v20: Moved the Progression control an additional 10px to the right compared with b1v19.
