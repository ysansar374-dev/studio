# **App Name**: Velocity Lobby

## Core Features:

- Lobby Creation and Joining: Allow players to create and join lobbies using a unique lobby code.
- Team Selection: Players can choose a racing team from a predefined list, affecting their car's color.
- AI Opponent Generation: Add AI-controlled bot opponents to the race to fill out the roster. Limited quantity to keep resource consumption low.
- Race Engineer AI: Generative AI provides race telemetry based on the current speed, lap, and car state, and delivers advice to the user via an automated radio system.
- In-Game Racing: Simple 2D race with basic car physics, including acceleration, braking, and collision detection. A tool will assess car attributes during a collision, in order to create new driving dynamics
- Lap Tracking: Track the player's current lap and total laps completed.
- Real-time position synchronization: Real-time multiplayer racing achieved by periodically updating other players positions. Very short pathnames used to limit read/writes.

## Style Guidelines:

- Primary color: Dark slate gray (#29465B), evoking high performance and machine precision
- Background color: Near-black (#0A0A0A), providing contrast with the content, and unobtrusiveness for gameplay
- Accent color: Electric blue (#7DF9FF), to give vibrancy, and a suggestion of advanced technology
- Body and headline font: 'Space Grotesk' sans-serif font, for a futuristic, technical aesthetic. Where long text is expected, use Space Grotesk for the headlines, and Inter for body text.
- Code font: 'Source Code Pro' for displaying any inline code snippets, due to its monospaced nature.
- Use 'Lucide' icons, with line art and modern aesthetics for interface elements. These icons fit seamlessly with the chosen fonts, creating a consistent style.
- Implement subtle transitions and animations on UI elements for enhanced interactivity and feedback.