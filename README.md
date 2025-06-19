# QWERTY Synth

Do not know how to play keys? Or find the computer keyboard too uncomfortable to play chords? This program will help you play a wide range of chords and arpeggios using a single click with modifiers. Easy to get started, fun presets and a wide octave range.

Built with Tone.js, featuring:

- QWERTY keyboard-to-piano mapping (chords, arpeggios, octaves)
- Three distinct presets: Piano, Lead (chiptune), Organ
- Auto-arpeggiate toggle and manual arpeggio controls
- BPM and octave selection
- Responsive, custom-styled UI with custom fonts
- Robust audio unlock overlay for browser compatibility
- Mobile devices are blocked with a friendly message

## Usage
1. **Run a local static server** (required for module and asset loading):
   - With Python: `python -m http.server`
   - Or use [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code
2. Open `http://localhost:8000/tonejs-project/` in your desktop browser.
3. Play using your QWERTY keyboard. Use the UI to change presets, BPM, octave, and arpeggiate mode.

## Notes
- **Mobile browsers are not supported.**
- All synth logic is frontend-only; no backend required.
- Ready for GitHub Pages or any static hosting.

## Credits
- Synth engine: [Tone.js](https://tonejs.github.io/)
- Designed and Built by Sunpreet Singh Brar

---
Enjoy making music!