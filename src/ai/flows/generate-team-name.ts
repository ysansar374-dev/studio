'use server';

/**
 * @fileOverview This file defines a Genkit flow to generate a futuristic team name based on a given pilot name.
 *
 * - generateTeamName - A function that takes a pilot name and returns a generated team name.
 * - GenerateTeamNameInput - The input type for the generateTeamName function.
 * - GenerateTeamNameOutput - The return type for the generateTeamName function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTeamNameInputSchema = z.object({
  pilotName: z.string().describe('The name of the pilot.'),
});

export type GenerateTeamNameInput = z.infer<typeof GenerateTeamNameInputSchema>;

const GenerateTeamNameOutputSchema = z.object({
  teamName: z.string().describe('The generated futuristic team name.'),
});

export type GenerateTeamNameOutput = z.infer<typeof GenerateTeamNameOutputSchema>;

export async function generateTeamName(input: GenerateTeamNameInput): Promise<GenerateTeamNameOutput> {
  return generateTeamNameFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTeamNamePrompt',
  input: {schema: GenerateTeamNameInputSchema},
  output: {schema: GenerateTeamNameOutputSchema},
  prompt: `You are a creative racing team branding expert.
Create a cool, futuristic racing team name for a driver named '{{{pilotName}}}'. The team name should be one or two words.`,
});

const generateTeamNameFlow = ai.defineFlow(
  {
    name: 'generateTeamNameFlow',
    inputSchema: GenerateTeamNameInputSchema,
    outputSchema: GenerateTeamNameOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
