'use client';

import { Check, Loader2, LogIn, PlusCircle, Settings, Users, Gamepad2, Trash2 } from "lucide-react";
import { TEAMS } from "@/lib/constants";
import type { PlayerCar, Team } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type MenuScreenProps = {
  playerCar: PlayerCar;
  setPlayerCar: (car: PlayerCar) => void;
  aiLoading: boolean;
  generateTeamName: () => void;
  inputLobbyCode: string;
  setInputLobbyCode: (code: string) => void;
  joinLobby: () => void;
  createLobby: () => void;
  connectionStatus: string;
  resetDatabase: () => void;
};

const Controls = () => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
                <Settings size={16} /> KONTROLLER
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-code text-muted-foreground">
                <div className="flex justify-between border-b border-border/50 pb-1"><span>GAZ</span> <span className="text-foreground font-bold">W</span></div>
                <div className="flex justify-between border-b border-border/50 pb-1"><span>FREN</span> <span className="text-foreground font-bold">S</span></div>
                <div className="flex justify-between border-b border-border/50 pb-1"><span>YÖN</span> <span className="text-foreground font-bold">A / D</span></div>
                <div className="flex justify-between border-b border-border/50 pb-1"><span>DRS</span> <span className="text-foreground font-bold">SPACE</span></div>
                <div className="flex justify-between border-b border-accent/30 pb-1 text-accent"><span>MÜHENDİS</span> <span className="text-foreground font-bold">R</span></div>
                <div className="flex justify-between border-b border-border/50 pb-1"><span>ÇIKIŞ</span> <span className="text-foreground font-bold">ESC</span></div>
            </div>
        </CardContent>
    </Card>
);

export function MenuScreen({ playerCar, setPlayerCar, aiLoading, generateTeamName, inputLobbyCode, setInputLobbyCode, joinLobby, createLobby, connectionStatus, resetDatabase }: MenuScreenProps) {

  const selectTeam = (team: Team) => {
    setPlayerCar({ ...playerCar, color: team.color, team: team.name, teamId: team.id });
  };

  const connectionColor = connectionStatus === 'connected' ? 'text-green-400' : connectionStatus === 'error' ? 'text-red-500' : 'text-yellow-400';

  return (
    <div className="h-screen bg-background flex items-center justify-center text-foreground font-sans p-4">
      <div className="bg-card/80 backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-2xl max-w-5xl w-full border grid grid-cols-1 md:grid-cols-2 gap-12">
        <div>
          <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent italic tracking-tighter mb-2 font-headline">VELOCITY LOBBY</h1>
          <h2 className="text-lg sm:text-xl text-muted-foreground tracking-widest mb-8 font-bold flex items-center gap-2"><Gamepad2 className="text-accent" />LOBBY EDITION</h2>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Pilot Adı</label>
              <Input value={playerCar.name} onChange={e => setPlayerCar({ ...playerCar, name: e.target.value })} className="mt-1 text-lg font-bold" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Takım Seç</label>
              <div className="grid grid-cols-1 gap-2">
                {TEAMS.map(team => (
                  <button key={team.id} onClick={() => selectTeam(team)} className={`flex items-center p-2 rounded-lg border transition-all ${playerCar.teamId === team.id ? 'bg-primary border-accent ring-2 ring-offset-2 ring-offset-card ring-accent' : 'bg-muted/50 border-border hover:bg-muted'}`}>
                    <div className="w-6 h-6 rounded-full border border-white/20 mr-3" style={{ backgroundColor: team.color }}></div>
                    <span className="font-bold text-sm">{team.name}</span>
                    {playerCar.teamId === team.id && <Check className="ml-auto text-green-400" size={16} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between">
          <Card className="bg-muted/30">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Users size={16}/> Lobiye Katıl</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input
                        value={inputLobbyCode}
                        onChange={e => setInputLobbyCode(e.target.value.toUpperCase())}
                        placeholder="LOBİ KODU"
                        className="flex-1 font-code text-center tracking-widest uppercase"
                        maxLength={6}
                    />
                    <Button onClick={joinLobby} className="font-bold"><LogIn size={16}/> KATIL</Button>
                </div>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t"></div>
                    <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs">VEYA</span>
                    <div className="flex-grow border-t"></div>
                </div>
                <Button onClick={createLobby} variant="secondary" className="w-full font-bold">
                    <PlusCircle size={16} /> YENİ LOBİ OLUŞTUR
                </Button>
            </CardContent>
          </Card>
          
          <Controls />
          
          <div className="flex justify-between items-center text-xs text-muted-foreground mt-4 font-code">
            <div>
              Durum: <span className={connectionColor}>
                {connectionStatus === 'connected' ? 'SUNUCUYA BAĞLI' : connectionStatus === 'error' ? 'BAĞLANTI HATASI' : 'BAĞLANIYOR...'}
              </span>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="text-xs">
                  <Trash2 className="mr-2 h-3 w-3" />
                  Veritabanını Sıfırla
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bu işlem tüm lobi verilerini kalıcı olarak silecektir. Bu eylem geri alınamaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction onClick={resetDatabase}>Onayla ve Sil</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
