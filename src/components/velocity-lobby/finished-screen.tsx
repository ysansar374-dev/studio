'use client';

import { RotateCcw, Trophy } from "lucide-react";
import type { PlayerCar } from "@/types";
import { Button } from "@/components/ui/button";

type FinishedScreenProps = {
  playerCar: PlayerCar;
  setGameState: (state: string) => void;
};

export function FinishedScreen({ playerCar, setGameState }: FinishedScreenProps) {
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center text-white font-sans">
      <div className="text-center bg-card p-12 rounded-3xl border shadow-2xl shadow-accent/10">
        <Trophy className="w-40 h-40 text-yellow-400 mx-auto mb-6 drop-shadow-[0_0_35px_rgba(250,204,21,0.5)] animate-bounce" />
        <h1 className="text-7xl font-black mb-2 italic font-headline">YARIŞ BİTTİ!</h1>
        <p className="text-muted-foreground text-xl mb-8">Takım: {playerCar.team}</p>
        <Button onClick={() => setGameState('menu')} size="lg" className="px-10 py-7 rounded-full text-xl hover:scale-105 transition-transform group">
          <RotateCcw className="mr-3 transition-transform group-hover:-rotate-180" /> MENÜYE DÖN
        </Button>
      </div>
    </div>
  );
}
