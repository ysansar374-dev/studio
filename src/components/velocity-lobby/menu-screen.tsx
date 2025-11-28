'use client';

import { Check, Loader2, LogIn, PlusCircle, Settings, Users, Gamepad2, Trash2, ShieldCheck, RefreshCw, Shield, Sparkles } from "lucide-react";
import { TEAMS } from "@/lib/constants";
import type { PlayerCar, Team, Lobby } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

type MenuScreenProps = {
  playerCar: PlayerCar;
  setPlayerCar: (updater: (car: PlayerCar) => PlayerCar) => void;
  aiLoading: boolean;
  onGenerateTeamName: () => void;
  onPilotNameChange: (name: string) => void;
  inputLobbyCode: string;
  setInputLobbyCode: (code: string) => void;
  joinLobby: (code?: string) => void;
  createLobby: () => void;
  connectionStatus: string;
  resetDatabase: () => void;
  isAdmin: boolean;
  handleAdminLogin: () => void;
  publicLobbies: Lobby[];
  refreshLobbies: () => void;
  lobbiesLoading: boolean;
  assistEnabled: boolean;
  setAssistEnabled: (enabled: boolean) => void;
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

export function MenuScreen({ playerCar, setPlayerCar, aiLoading, onPilotNameChange, onGenerateTeamName, inputLobbyCode, setInputLobbyCode, joinLobby, createLobby, connectionStatus, resetDatabase, isAdmin, handleAdminLogin, publicLobbies, refreshLobbies, lobbiesLoading, assistEnabled, setAssistEnabled }: MenuScreenProps) {

  const selectTeam = (team: Team) => {
    setPlayerCar(car => ({ ...car, color: team.color, teamId: team.id, team: team.name }));
  };

  const connectionColor = connectionStatus === 'connected' ? 'text-green-400' : connectionStatus === 'error' ? 'text-red-500' : 'text-yellow-400';

  return (
    <div className="h-screen bg-background flex items-center justify-center text-foreground font-sans p-4 relative">
       <div className="absolute top-4 text-center w-full font-bold text-2xl text-accent/50 font-headline tracking-widest pointer-events-none">lezziya</div>
      <div className="bg-card/80 backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-2xl max-w-7xl w-full border grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent italic tracking-tighter mb-2 font-headline">VELOCITY LOBBY</h1>
          <h2 className="text-lg sm:text-xl text-muted-foreground tracking-widest mb-8 font-bold flex items-center gap-2"><Gamepad2 className="text-accent" />LOBBY EDITION</h2>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Pilot Adı</label>
              <Input value={playerCar.name} onChange={e => onPilotNameChange(e.target.value)} className="mt-1 text-lg font-bold" />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Takım Adı</label>
              <div className="flex gap-2 items-center">
                <Input value={playerCar.team} onChange={e => setPlayerCar(car => ({ ...car, team: e.target.value }))} className="mt-1 text-lg font-bold" />
                <Button onClick={onGenerateTeamName} size="icon" variant="outline" className="mt-1 flex-shrink-0" disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles className="text-accent" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Araç Rengi</label>
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
             <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
                <div className="space-y-0.5">
                    <Label htmlFor="assist-mode" className="text-base font-bold flex items-center gap-2"><Shield size={16}/> Sürüş Asistanı</Label>
                    <p className="text-xs text-muted-foreground">Pistte kalmanıza yardımcı olur, kapatarak daha gerçekçi bir deneyim yaşayın.</p>
                </div>
                <Switch id="assist-mode" checked={assistEnabled} onCheckedChange={setAssistEnabled} />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-col justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                            <Button onClick={() => joinLobby()} className="font-bold"><LogIn size={16}/> KATIL</Button>
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

                <Card className="bg-muted/30">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between text-base">
                            <div className="flex items-center gap-2"><Users size={16}/> Herkese Açık Lobiler</div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refreshLobbies} disabled={lobbiesLoading}>
                                {lobbiesLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
                            </Button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-40">
                            {lobbiesLoading && <div className="text-muted-foreground text-sm text-center pt-12">Lobiler aranıyor...</div>}
                            {!lobbiesLoading && publicLobbies.length === 0 && <div className="text-muted-foreground text-sm text-center pt-12">Aktif lobi bulunamadı.</div>}
                            <div className="space-y-2">
                            {publicLobbies.map(lobby => (
                                <button key={lobby.id} onClick={() => joinLobby(lobby.id)} className="w-full text-left flex items-center p-2 rounded-lg border bg-muted/50 border-border hover:bg-muted transition-all">
                                    <span className="font-code font-bold text-accent">{lobby.id}</span>
                                    <div className="flex items-center gap-1 ml-auto text-xs text-muted-foreground">
                                        <Users size={12}/>
                                        <span>{lobby.playerCount || 0}/8</span>
                                    </div>
                                </button>
                            ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

          <Controls />
          
          <div className="flex justify-between items-center text-xs text-muted-foreground mt-4 font-code">
            <div>
              Durum: <span className={connectionColor}>
                {connectionStatus === 'connected' ? 'SUNUCUYA BAĞLI' : connectionStatus === 'error' ? 'BAĞLANTI HATASI' : 'BAĞLANIYOR...'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAdminLogin} variant="outline" size="sm" className="text-xs">
                <ShieldCheck className="mr-2 h-3 w-3" />
                {isAdmin ? 'Admin' : 'Admin Girişi'}
              </Button>
              {isAdmin && (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
