'use client';

import { RotateCcw, Trophy } from "lucide-react";
import type { PlayerCar, Player } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FinishedScreenProps = {
  playerCar: PlayerCar;
  setGameState: (state: string) => void;
  leaderboard: Player[];
};

export function FinishedScreen({ playerCar, setGameState, leaderboard }: FinishedScreenProps) {
  // Sort by lap (desc), then by position on track (x, desc)
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const lapA = a.lap || 0;
    const lapB = b.lap || 0;
    if (lapB !== lapA) {
      return lapB - lapA;
    }
    return (b.x || 0) - (a.x || 0);
  });
  
  const playerResult = sortedLeaderboard.find(p => p.isMe);
  const playerRank = sortedLeaderboard.findIndex(p => p.isMe) + 1;
  
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center text-white font-sans p-4">
      <div className="text-center bg-card p-8 sm:p-12 rounded-3xl border shadow-2xl shadow-accent/10 max-w-2xl w-full">
        <Trophy className="w-24 h-24 sm:w-32 sm:h-32 text-yellow-400 mx-auto mb-4 drop-shadow-[0_0_35px_rgba(250,204,21,0.5)] animate-bounce" />
        <h1 className="text-5xl sm:text-7xl font-black mb-2 italic font-headline">YARIŞ BİTTİ!</h1>
        <p className="text-lg sm:text-xl text-muted-foreground mb-4">Takım: {playerCar.team}</p>
        <p className="text-2xl sm:text-3xl font-bold mb-8">Sıralaman: <span className="text-accent">{playerRank || 'N/A'}.</span></p>
        
        <Card className="mb-8 text-left bg-background/50">
          <CardHeader>
            <CardTitle>Liderlik Tablosu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedLeaderboard.map((player, index) => (
                <div key={player.id} className={`flex justify-between items-center p-2 rounded-lg ${player.isMe ? 'bg-primary/50 border border-primary' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground w-6 text-center">{index + 1}</span>
                    <div className="w-5 h-5 rounded-full border border-white/20" style={{backgroundColor: player.color}}></div>
                    <span className="font-bold">{player.name}</span>
                  </div>
                   <span className="font-code text-sm text-muted-foreground">{index === 0 ? 'KAZANAN' : `+${((sortedLeaderboard[0].x || 0) - (player.x || 0)).toFixed(0)}m`}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => setGameState('menu')} size="lg" className="px-10 py-7 rounded-full text-xl hover:scale-105 transition-transform group w-full sm:w-auto">
          <RotateCcw className="mr-3 transition-transform group-hover:-rotate-180" /> MENÜYE DÖN
        </Button>
      </div>
    </div>
  );
}
