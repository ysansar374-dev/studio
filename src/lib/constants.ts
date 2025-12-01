import type { Team } from "@/types";

// --- GAME SETTINGS ---
export const MAX_SPEED_NORMAL = 32; 
export const MAX_SPEED_DRS = 35; 
export const ACCELERATION = 0.08;
export const FRICTION_ROAD = 0.99;
export const WALL_BOUNCE = 0.6;
export const LANE_SPEED = 5;
export const TRACK_LENGTH = 5000 * Math.PI; // Approx 15708, ensures seamless loop for sin waves
export const SYNC_INTERVAL = 100; // ms, for ~10 updates per second

export const ROAD_WIDTH = 600; 
export const BASE_ROAD_Y = 400;

// --- STEERING ---
export const STEERING_SENSITIVITY = 0.25; // Max wheel angle
export const STEERING_ASSIST_STRENGTH = 0.02; // How strongly the car autocorrects to the road direction


// --- TEAMS ---
export const TEAMS: Team[] = [
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#dc2626', secondary: '#facc15' }, 
    { id: 'redbull', name: 'Red Bull Racing', color: '#1e3a8a', secondary: '#ef4444' }, 
    { id: 'mercedes', name: 'Mercedes-AMG', color: '#0f172a', secondary: '#06b6d4' }, 
    { id: 'mclaren', name: 'McLaren F1', color: '#f97316', secondary: '#3b82f6' }, 
    { id: 'aston', name: 'Aston Martin', color: '#047857', secondary: '#a3e635' }, 
];
