import type { Team } from "@/types";

// --- GAME SETTINGS ---
export const MAX_SPEED_NORMAL = 22; 
export const MAX_SPEED_DRS = 32; 
export const ACCELERATION = 0.08;
export const FRICTION_ROAD = 0.99;
export const WALL_BOUNCE = 0.6;
export const LANE_SPEED = 5;
export const TRACK_LENGTH = 15000; 

export const ROAD_WIDTH = 500; 
export const BASE_ROAD_Y = 400;

// --- TEAMS ---
export const TEAMS: Team[] = [
    { id: 'ferrari', name: 'Scuderia Ferrari', color: '#dc2626', secondary: '#facc15' }, 
    { id: 'redbull', name: 'Red Bull Racing', color: '#1e3a8a', secondary: '#ef4444' }, 
    { id: 'mercedes', name: 'Mercedes-AMG', color: '#0f172a', secondary: '#06b6d4' }, 
    { id: 'mclaren', name: 'McLaren F1', color: '#f97316', secondary: '#3b82f6' }, 
    { id: 'aston', name: 'Aston Martin', color: '#047857', secondary: '#a3e635' }, 
];
