'use server';

/**
 * @fileOverview A race engineer AI agent that provides real-time telemetry and advice.
 *
 * - generateRaceEngineerMessage - A function that generates a radio message from the race engineer.
 * - RaceEngineerInput - The input type for the generateRaceEngineerMessage function.
 * - RaceEngineerOutput - The return type for the generateRaceEngineerMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RaceEngineerInputSchema = z.object({
  speed: z.number().describe('The current speed of the car in km/h.'),
  lap: z.number().describe('The current lap number.'),
  context: z.string().describe('The current context of the race (e.g., normal, collision, DRS active).'),
  team: z.string().describe('The name of the player team.'),
});
export type RaceEngineerInput = z.infer<typeof RaceEngineerInputSchema>;

const RaceEngineerOutputSchema = z.object({
  message: z.string().describe('The radio message from the race engineer.'),
});
export type RaceEngineerOutput = z.infer<typeof RaceEngineerOutputSchema>;

export async function generateRaceEngineerMessage(input: RaceEngineerInput): Promise<RaceEngineerOutput> {
  return raceEngineerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'raceEngineerPrompt',
  input: {schema: RaceEngineerInputSchema},
  output: {schema: RaceEngineerOutputSchema},
  prompt: `You are a Formula 1 race engineer for team {{{team}}}. 
Your driver is in the middle of a race.
Give a short, realistic, and characterful radio message to your driver based on the current situation. 
Sometimes be serious, sometimes funny, sometimes motivational. 
You can use iconic F1 radio message memes.

Current Data:
- Speed: {{{speed}}} km/h
- Lap: {{{lap}}}
- Race Context: {{{context}}}

Examples of tones you can use:
- Informative: "Okay, box this lap, box, box."
- Motivational: "Okay, push now, push, push!"
- Panicked: "Is the car okay? We're seeing a possible fluid leak."
- Sarcastic/Funny: "Plan E. Plan E."
- Iconic Meme: "I am stupid."

Generate a single, short radio message now.`,
});

const raceEngineerFlow = ai.defineFlow(
  {
    name: 'raceEngineerFlow',
    inputSchema: RaceEngineerInputSchema,
    outputSchema: RaceEngineerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
