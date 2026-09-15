# Halo 2D - Multiplayer Battle Game

A real-time multiplayer battle game where players can fight in teams or free-for-all modes.

## Features

- Real-time multiplayer gameplay
- Team-based and free-for-all game modes
- Power-ups and special abilities
- Capture the flag mode
- Live leaderboard
- Smooth animations and particle effects

## Play Online

No verified hosted multiplayer demo is linked here. Run the Node.js server locally using the instructions below; static GitHub Pages hosting alone cannot run the Socket.IO server.

## Development

### Prerequisites

- Node.js >= 14.0.0
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/robinfrancis186/game186.git
cd game186
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open `http://localhost:3000` in your browser

### Building for Production

```bash
npm run build
```

## Deployment

The existing GitHub Pages workflow attempts to publish static client assets. Its September 2026 run failed because the Actions token could not push the `gh-pages` branch. Even with publishing configured, multiplayer requires a separately hosted Node.js/Socket.IO server; use the local instructions above.

## Game Controls

- Move: WASD or Arrow Keys
- Aim: Mouse
- Shoot: Left Click
- Collect power-ups by walking over them
- Capture flags by touching them and returning to your base

## Licensing

`package.json` declares ISC, but no repository-wide LICENSE text is included. This documentation does not replace or expand that declaration. Confirm the applicable terms with the maintainer; third-party terms remain in force.
