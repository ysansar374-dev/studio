// @/app/actions.ts
'use server';

import { generateTeamName as genTeamName, type GenerateTeamNameInput } from '@/ai/flows/generate-team-name';
import { generateRaceEngineerMessage as genRaceEngineerMessage, type RaceEngineerInput } from '@/ai/flows/race-engineer-telemetry';

export async function generateTeamName(input: GenerateTeamNameInput): Promise<string> {
  try {
    const { teamName } = await genTeamName(input);
    return teamName;
  } catch (error) {
    console.error("Error generating team name:", error);
    return "Cyber Stallions"; // Fallback name
  }
}

export async function getRaceEngineerMessage(input: RaceEngineerInput): Promise<string> {
  try {
    const { message } = await genRaceEngineerMessage(input);
    return message;
  } catch (error) {
    console.error("Error getting race engineer message:", error);
    return "Telsiz parazitli..."; // Fallback message
  }
}
