'use client';

import { useState } from "react";
import { Check, Copy, User, Users } from "lucide-react";
import type { Player } from "@/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type LobbyScreenProps = {
  lobbyCode: string;
  lobbyPlayers: Player[];
  isHost: boolean;
  startRaceByHost: () => void;
  quitRace: () => void;
  userId: string | null;
};

export function LobbyScreen({ lobbyCode, lobbyPlayers, isHost, startRaceByHost, quitRace, userId }: LobbyScreenProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyCode = () => {
    navigator.clipboard.writeText(lobbyCode).then(() => {
      setCopied(true);
      toast({ title: "Lobi Kodu Kopyalandı!", description: lobbyCode });
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy lobby code: ", err);
      toast({ variant: "destructive", title: "Kopyalama Başarısız", description: "Lobi kodu panoya kopyalanamadı." });
    });
  };

  return (
    <div className="h-screen bg-background flex items-center justify-center text-foreground font-sans p-4">
      <div className="bg-card p-8 rounded-2xl shadow-2xl max-w-4xl w-full border text-center">
        <Users className="mx-auto h-12 w-12 text-accent mb-4" />
        <h2 className="text-3xl font-black mb-2 font-headline">LOBİ BEKLEME SALONU</h2>
        <div className="flex justify-center items-center gap-4 mb-8 bg-background p-4 rounded-xl inline-block mx-auto border">
          <span className="text-muted-foreground text-sm font-bold">LOBİ KODU:</span>
          <span className="text-4xl font-code text-accent tracking-widest font-bold">{lobbyCode}</span>
          <Button onClick={handleCopyCode} variant="ghost" size="icon" className="h-10 w-10">
            {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {lobbyPlayers.map(p => (
            <div key={p.id} className="bg-muted p-3 rounded-lg flex items-center gap-3 border">
              <div className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: p.color, borderColor: p.ready ? '#4ade80' : '#94a3b8' }}></div>
              <span className="font-bold truncate">{p.name}</span>
              {p.id === userId && <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full ml-auto font-bold">SEN</span>}
            </div>
          ))}
          {[...Array(Math.max(0, 8 - lobbyPlayers.length))].map((_, i) => (
            <div key={i} className="bg-background/50 p-3 rounded-lg border-dashed border flex items-center justify-center text-muted-foreground">
              <User size={16} className="mr-2"/> Oyuncu bekleniyor...
            </div>
          ))}
        </div>

        {isHost ? (
          <Button onClick={startRaceByHost} size="lg" className="w-full py-7 text-xl font-black uppercase tracking-widest bg-green-600 hover:bg-green-500 text-white shadow-lg">
            YARIŞI BAŞLAT
          </Button>
        ) : (
          <div className="text-muted-foreground animate-pulse font-mono py-4">
            Lobi Kurucusunun yarışı başlatması bekleniyor...
          </div>
        )}

        <Button onClick={quitRace} variant="link" className="mt-4 text-muted-foreground">Lobiden Ayrıl</Button>
      </div>
    </div>
  );
}
