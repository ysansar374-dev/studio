// @/components/velocity-lobby/race-screen.tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayerCar, Player, Opponent } from '@/types';
import { ACCELERATION, BASE_ROAD_Y, FRICTION_ROAD, LANE_SPEED, MAX_SPEED_DRS, MAX_SPEED_NORMAL, ROAD_WIDTH, TRACK_LENGTH, WALL_BOUNCE } from '@/lib/constants';
import { Loader2, LogOut, Plus, Radio, Zap, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type RaceScreenProps = {
  playerCar: PlayerCar;
  opponents: Record<string, Opponent>;
  setGameState: (state: string) => void;
  lapInfo: { current: number; total: number; finished: boolean };
  setLapInfo: (updater: (prev: { current: number; total: number; finished: boolean }) => { current: number; total: number; finished: boolean }) => void;
  syncMultiplayer: (phys: any, lapInfo: any) => void;
  triggerRaceEngineer: (phys: any, drsState: any, lapInfo: any) => void;
  radioMessage: string | null;
  radioLoading: boolean;
  quitRace: () => void;
  isAdmin: boolean;
  kickPlayer: (playerId: string) => void;
};

export function RaceScreen({
  playerCar,
  opponents,
  setGameState,
  lapInfo,
  setLapInfo,
  syncMultiplayer,
  triggerRaceEngineer,
  radioMessage,
  radioLoading,
  quitRace,
  isAdmin,
  kickPlayer
}: RaceScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const gameActive = useRef(true);
  const phys = useRef({ x: 0, y: BASE_ROAD_Y, speed: 0, collision: false });
  const inputs = useRef({ gas: false, brake: false, left: false, right: false, drs: false });
  const botsRef = useRef<Player[]>([]);
  const lastSync = useRef(0);
  const uiUpdateTimer = useRef(0);
  const sparks = useRef<any[]>([]);
  const lapInfoRef = useRef(lapInfo);

  const [drsState, setDrsState] = useState({ active: false, charge: 100 });
  const [leaderboardData, setLeaderboardData] = useState<Player[]>([]);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  
  useEffect(() => {
    lapInfoRef.current = lapInfo;
  }, [lapInfo]);

  const getRoadCurve = useCallback((x: number) => {
    const val = x || 0;
    return BASE_ROAD_Y + Math.sin(val * 0.0008) * 250 + Math.cos(val * 0.002) * 50;
  }, []);

  const drawCar = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, color: string, name: string, isDrsOpen: boolean, isBraking: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    const slope = (getRoadCurve(x + 20) - getRoadCurve(x)) / 20;
    ctx.rotate(slope * 0.8);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(50, 0); ctx.lineTo(10, -12); ctx.lineTo(-30, -15); ctx.lineTo(-60, -12);
    ctx.lineTo(-60, 12); ctx.lineTo(-30, 15); ctx.lineTo(10, 12);
    ctx.fill();

    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(-10, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(-10, 0, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = isDrsOpen ? '#22c55e' : '#1e293b';
    ctx.save();
    ctx.translate(-65, -25);
    if (isDrsOpen) ctx.rotate(-0.4);
    ctx.fillRect(0, 0, 25, 6);
    ctx.restore();

    ctx.fillStyle = '#1e293b'; ctx.fillRect(45, 5, 10, 4);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.roundRect(20, -22, 16, 8, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(20, 14, 16, 8, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-50, -24, 20, 10, 3); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-50, 14, 20, 10, 3); ctx.fill();

    if (isBraking) {
        ctx.fillStyle = '#ff0000'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(-60, -8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-60, 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4; ctx.fillText(name, 0, -40); ctx.shadowBlur = 0;
    ctx.restore();
  }, [getRoadCurve]);

  const drawCheckeredLine = (ctx: CanvasRenderingContext2D, x: number, y: number, height: number) => {
    const size = 20;
    ctx.fillStyle = 'white';
    ctx.fillRect(x, y, 40, height);
    ctx.fillStyle = 'black';
    for (let i = 0; i < height; i += size) {
      if ((i / size) % 2 === 0) ctx.fillRect(x, y + i, 20, size);
      else ctx.fillRect(x + 20, y + i, 20, size);
    }
  };
  
  const drawMiniMap = (ctx: CanvasRenderingContext2D, screenW: number, screenH: number) => {
    const mapW = 250, mapH = 120, mapX = screenW - mapW - 20, mapY = 20;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; ctx.strokeStyle = 'hsl(var(--border))'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(mapX, mapY, mapW, mapH, 10); ctx.fill(); ctx.stroke();

    ctx.save();
    ctx.beginPath(); ctx.roundRect(mapX, mapY, mapW, mapH, 10); ctx.clip();
    const scaleX = mapW / TRACK_LENGTH;
    const scaleY = 0.15;
    ctx.beginPath(); ctx.strokeStyle = 'hsl(var(--muted-foreground))'; ctx.lineWidth = 4;
    for (let i = 0; i < TRACK_LENGTH; i += 200) {
      const mx = mapX + (i * scaleX);
      const my = mapY + mapH / 2 + (getRoadCurve(i) - BASE_ROAD_Y) * scaleY;
      if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
    }
    ctx.stroke();

    const drawDot = (x: number, color: string, radius: number, hasBorder: boolean) => {
      const lapPos = ((x % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
      const mx = mapX + (lapPos * scaleX);
      const my = mapY + mapH / 2 + (getRoadCurve(lapPos) - BASE_ROAD_Y) * scaleY;
      ctx.beginPath(); ctx.arc(mx, my, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      if (hasBorder) { ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.stroke(); }
    };

    botsRef.current.forEach(b => drawDot(b.x || 0, '#d1d5db', 3, false));
    Object.values(opponents).forEach(o => drawDot(o.x || 0, o.color, 4, true));
    drawDot(phys.current.x, playerCar.color, 6, true);
    ctx.restore();
  };

  const createSparks = (x: number, y: number, count: number) => {
    for (let k = 0; k < count; k++) {
      sparks.current.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
        alpha: 1
      });
    }
  };

  const drawSparks = useCallback((ctx: CanvasRenderingContext2D) => {
    sparks.current = sparks.current.filter(spark => spark.alpha > 0);
    sparks.current.forEach(spark => {
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.alpha -= 0.05;
      ctx.fillStyle = `rgba(255, 200, 100, ${spark.alpha})`;
      ctx.fillRect(spark.x, spark.y, 3, 3);
    });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const camX = phys.current.x - 300;
    const camY = phys.current.y - height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = 'hsl(var(--background))'; ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(0, -camY);

    const SEGMENT_WIDTH = 20;
    const DRAW_DISTANCE = width + 200;

    for (let sx = -SEGMENT_WIDTH; sx < DRAW_DISTANCE; sx += SEGMENT_WIDTH) {
      const worldX = Math.floor(camX + sx);
      if (sx < -100) continue;
      const y1 = getRoadCurve(worldX);
      const y2 = getRoadCurve(worldX + SEGMENT_WIDTH);
      
      ctx.fillStyle = '#15803d'; // Grass
      ctx.beginPath(); ctx.moveTo(sx, y1 - 2000); ctx.lineTo(sx + SEGMENT_WIDTH, y2 - 2000);
      ctx.lineTo(sx + SEGMENT_WIDTH, y2 + 2000); ctx.lineTo(sx, y1 + 2000); ctx.fill();
      
      ctx.fillStyle = '#334155'; // Road
      ctx.beginPath(); ctx.moveTo(sx, y1 - ROAD_WIDTH / 2); ctx.lineTo(sx + SEGMENT_WIDTH, y2 - ROAD_WIDTH / 2);
      ctx.lineTo(sx + SEGMENT_WIDTH, y2 + ROAD_WIDTH / 2); ctx.lineTo(sx, y1 + ROAD_WIDTH / 2); ctx.fill();
      
      ctx.fillStyle = Math.floor(worldX / 400) % 2 === 0 ? '#dc2626' : '#f8fafc';
      ctx.fillRect(sx, y1 - ROAD_WIDTH / 2 - 15, SEGMENT_WIDTH + 1, 15);
      ctx.fillRect(sx, y1 + ROAD_WIDTH / 2, SEGMENT_WIDTH + 1, 15);

      if (((worldX % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH < SEGMENT_WIDTH && Math.abs(worldX) > 100) {
        drawCheckeredLine(ctx, sx, y1 - ROAD_WIDTH / 2, ROAD_WIDTH);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(-camX, -camY);
    botsRef.current.forEach(bot => drawCar(ctx, bot.x || 0, bot.y || 0, bot.color, bot.name, false, false));
    Object.values(opponents).forEach(opp => {
      drawCar(ctx, opp.x || 0, opp.y || getRoadCurve(opp.x || 0), opp.color, opp.name, false, false);
    });
    drawCar(ctx, phys.current.x, phys.current.y, playerCar.color, "SEN", drsState.active, inputs.current.brake);
    drawSparks(ctx);
    ctx.restore();

    drawMiniMap(ctx, width, height);
  }, [playerCar.color, opponents, getRoadCurve, drawCar, drawSparks, drsState.active]);

  const loop = useCallback(() => {
    if (!gameActive.current) return;

    const p = phys.current;
    const i = inputs.current;
    
    let currentDrsActive = false;
    let newDrsCharge: number;

    setDrsState(prev => {
        if (i.drs && prev.charge > 0) {
            currentDrsActive = true;
            newDrsCharge = Math.max(0, prev.charge - 0.5);
        } else {
             newDrsCharge = Math.min(100, prev.charge + 0.1);
        }
        return { active: i.drs && prev.charge > 0, charge: newDrsCharge };
    });

    const currentMaxSpeed = currentDrsActive ? MAX_SPEED_DRS : MAX_SPEED_NORMAL;
    const currentAccel = currentDrsActive ? ACCELERATION * 1.5 : ACCELERATION;

    if (i.gas) p.speed += currentAccel;
    else p.speed *= FRICTION_ROAD;
    if (i.brake) p.speed -= ACCELERATION * 3;
    
    p.y += (i.right ? LANE_SPEED : 0) + (i.left ? -LANE_SPEED : 0);

    const roadCenterY = getRoadCurve(p.x);
    const carHalfHeight = 20;
    p.collision = false;

    if (p.y < roadCenterY - ROAD_WIDTH / 2 + carHalfHeight || p.y > roadCenterY + ROAD_WIDTH / 2 - carHalfHeight) {
      p.speed *= WALL_BOUNCE;
      p.collision = true;
      const sparkSide = p.y < roadCenterY ? -1 : 1;
      p.y = roadCenterY + (sparkSide * (ROAD_WIDTH / 2 - carHalfHeight));
      createSparks(p.x - 60, p.y + (sparkSide * 15), 10);
    }
    
    // Ghosting for the first 1000 units (approx. 100 meters)
    if (p.x > 1000) {
        // Collision with bots
        botsRef.current.forEach(bot => {
            if (!bot.x || !bot.y) return;
            const dx = p.x - bot.x;
            const dy = p.y - bot.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 80) { // Collision threshold
                p.speed *= 0.85;
                (bot as any).speed *= 0.9;
                
                const overlap = 80 - distance;
                const pushX = (dx / distance) * overlap * 0.8;
                const pushY = (dy / distance) * overlap * 0.8;
                p.x += pushX;
                p.y += pushY;
                bot.x -= pushX;
                bot.y -= pushY;
                
                p.collision = true;
                createSparks(p.x - dx/2, p.y - dy/2, 15);
            }
        });

        // Collision with opponents
        Object.values(opponents).forEach(opp => {
            if (!opp.x || !opp.y) return;
            const dx = p.x - opp.x;
            const dy = p.y - opp.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            if (distance < 80) { // Collision threshold: 80px
                p.speed *= 0.85; // Player loses some speed
                p.collision = true;
                
                // Apply a stronger bounce effect to prevent getting stuck
                const overlap = 80 - distance;
                const pushX = (dx / distance) * overlap * 0.8; 
                const pushY = (dy / distance) * overlap * 0.8;
                p.x += pushX;
                p.y += pushY;
                
                createSparks(p.x - dx/2, p.y - dy/2, 15);
            }
        });
    }

    p.speed = Math.max(0, Math.min(p.speed, currentMaxSpeed));
    p.x += p.speed;

    setLapInfo(prev => {
      if (!gameActive.current) return prev;
      const newLap = Math.floor(p.x / TRACK_LENGTH) + 1;
      if (newLap > prev.current) {
        if (newLap > prev.total) {
          if (!prev.finished) {
            setGameState('finished');
            gameActive.current = false;
          }
          return { ...prev, finished: true };
        } else {
          return { ...prev, current: newLap };
        }
      }
      return prev;
    });
    
    // Bots update
    botsRef.current.forEach((bot, index) => {
        const botSpeed = (bot as any).speed || 0;
        const botX = bot.x || 0;
        const botY = bot.y || 0;
        const idealY = getRoadCurve(botX) + ((bot as any).offsetY || 0);

        bot.y = botY + (idealY - botY) * 0.05;
        bot.x = botX + botSpeed;

        if (Math.random() < 0.005) { // Randomly change lane target
             (bot as any).offsetY = (Math.random() - 0.5) * (ROAD_WIDTH - 60);
        }
        
        // Bot-on-bot collision
        for(let j = index + 1; j < botsRef.current.length; j++) {
            const otherBot = botsRef.current[j];
            if (!otherBot.x || !otherBot.y) continue;
            const dx = botX - otherBot.x;
            const dy = botY - otherBot.y;
            if (Math.abs(dx) < 120 && Math.abs(dy) < 30) {
                (bot as any).x -= dx * 0.05;
                (otherBot as any).x += dx * 0.05;
            }
        }

        if (Math.abs(p.x - botX) > 4000) {
            bot.x = p.x + (Math.random() > 0.5 ? 1 : -1) * (1000 + Math.random() * 500);
            bot.y = getRoadCurve(bot.x);
        }
    });


    // UI & Sync
    uiUpdateTimer.current++;
    if (uiUpdateTimer.current % 10 === 0) {
        const allRacers = [
            ...Object.values(opponents),
            ...botsRef.current,
            { name: playerCar.name, x: phys.current.x, isMe: true, id: 'player' }
        ].sort((a, b) => (b.x || 0) - (a.x || 0));
        setLeaderboardData(allRacers as Player[]);
    }
    
    if (Date.now() - lastSync.current > 500) {
        syncMultiplayer(phys.current, lapInfoRef.current);
        lastSync.current = Date.now();
    }
    
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [draw, getRoadCurve, playerCar.name, opponents, setGameState, syncMultiplayer, setLapInfo]);


  const addBot = () => {
    if (botsRef.current.length >= 12) return;
    const startX = phys.current.x;
    const randomTeam = { color: '#888' };
    const newBot = {
      id: `bot_${Date.now()}`,
      x: startX - 200 + Math.random() * 400,
      speed: 18 + Math.random() * 4,
      color: randomTeam.color,
      offsetY: (Math.random() - 0.5) * (ROAD_WIDTH - 60),
      name: `Bot ${botsRef.current.length + 1}`
    };
    (newBot as any).y = getRoadCurve(newBot.x) + newBot.offsetY;
    botsRef.current.push(newBot as Player);
  };
  
  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    handleResize();

    const hD = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') inputs.current.gas = true;
      if (key === 's') inputs.current.brake = true;
      if (key === 'a') inputs.current.left = true;
      if (key === 'd') inputs.current.right = true;
      if (e.key === ' ' || e.key === 'Shift') inputs.current.drs = true;
      if (e.key === 'Escape') quitRace();
      if (key === 'r') triggerRaceEngineer(phys.current, drsState, lapInfoRef.current);
    };
    const hU = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') inputs.current.gas = false;
      if (key === 's') inputs.current.brake = false;
      if (key === 'a') inputs.current.left = false;
      if (key === 'd') inputs.current.right = false;
      if (e.key === ' ' || e.key === 'Shift') inputs.current.drs = false;
    };
    window.addEventListener('keydown', hD);
    window.addEventListener('keyup', hU);
    
    gameActive.current = true;
    requestRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', hD);
      window.removeEventListener('keyup', hU);
      gameActive.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop, quitRace, triggerRaceEngineer, drsState]);

  return (
    <div className="h-screen w-full bg-background overflow-hidden relative select-none cursor-none">
      <canvas ref={canvasRef} width={windowSize.width} height={windowSize.height} className="block" />

      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-start pointer-events-none">
        {/* Speed & DRS */}
        <div className="flex flex-col gap-2">
          <div className="bg-card/80 backdrop-blur text-white p-4 sm:p-6 rounded-br-3xl border-l-8 border-accent min-w-[200px] sm:min-w-[240px]">
            <div className="font-black italic leading-none tracking-tighter text-5xl sm:text-7xl font-headline">
              {Math.floor(phys.current.speed * 10)} <span className="text-xl sm:text-2xl not-italic font-bold text-muted-foreground">KM/H</span>
            </div>
          </div>
          <div className="bg-card/80 p-3 rounded-r-xl flex items-center gap-3 w-56 sm:w-72 backdrop-blur">
            <div className={`font-bold text-xs px-2 py-1 rounded ${drsState.active ? 'bg-green-500 text-black' : 'bg-muted-foreground/20 text-muted-foreground'}`}>DRS</div>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-200 ${drsState.charge > 20 ? 'bg-green-400' : 'bg-red-500'}`} style={{ width: `${drsState.charge}%` }}></div>
            </div>
            <Zap size={16} className={drsState.active ? 'text-yellow-400 fill-yellow-400 animate-pulse' : 'text-muted-foreground/50'} />
          </div>
        </div>

        {/* Laps */}
        <div className="bg-card/80 backdrop-blur text-white px-6 sm:px-10 py-4 rounded-b-3xl flex flex-col items-center border-b-4 border-accent shadow-lg shadow-accent/10">
          <div className="text-xs font-bold text-muted-foreground tracking-[0.2em] mb-1">TUR</div>
          <div className="text-4xl sm:text-5xl font-black flex items-baseline gap-2 font-headline">{lapInfo.current}<span className="text-xl sm:text-2xl text-muted-foreground">/{lapInfo.total}</span></div>
        </div>
        
        {/* Leaderboard */}
        <div className="hidden md:block bg-card/70 backdrop-blur p-4 rounded-xl text-white w-72 border">
            <div className="flex items-center justify-between mb-3 border-b pb-2"><span className="font-bold text-xs text-muted-foreground">PİLOT</span><span className="font-bold text-xs text-muted-foreground">FARK (M)</span></div>
            <div className="space-y-2 font-code text-sm">
                 {leaderboardData.slice(0, 6).map((d, i) => {
                     const leaderX = leaderboardData[0]?.x || 0;
                     return (
                        <div key={d.id || i} className={`flex justify-between items-center p-1 rounded group ${d.isMe ? 'bg-accent/20 text-accent font-bold border-l-2 border-accent' : 'text-foreground'}`}>
                            <div className="flex items-center gap-2"><span className="text-muted-foreground w-4">{i + 1}</span><span className="truncate w-24">{d.name}</span></div>
                            <div className="flex items-center gap-2">
                              <span className={i === 0 ? 'text-green-400' : 'text-red-400'}>{i === 0 ? 'LİDER' : `+${Math.floor((leaderX - (d.x || 0)) / 10)}m`}</span>
                              {isAdmin && !d.isMe && (
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => d.id && kickPlayer(d.id)}
                                >
                                  <X size={12} />
                                </Button>
                              )}
                            </div>
                        </div>
                    )
                 })}
            </div>
        </div>
      </div>
      
      {/* Radio Message */}
      <div className="absolute bottom-24 left-4 sm:left-6 flex flex-col gap-2 max-w-md transition-all duration-500">
        {radioMessage && (
          <div className="bg-primary/90 text-white p-4 rounded-r-xl rounded-tl-xl border-l-4 border-accent shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in">
            <div className="flex items-center gap-2 mb-1"><Radio size={16} className="text-accent animate-pulse" /> <span className="text-xs font-bold text-accent/80 uppercase tracking-wider">Yarış Mühendisi</span></div>
            <p className="font-bold italic text-lg">"{radioMessage}"</p>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-6 right-6 flex gap-3 pointer-events-auto">
         <button onClick={() => triggerRaceEngineer(phys.current, drsState, lapInfoRef.current)} disabled={radioLoading} className="bg-primary/80 hover:bg-primary text-white px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 backdrop-blur border transition-all disabled:opacity-50 disabled:cursor-wait">
            {radioLoading ? <Loader2 className="animate-spin" size={16} /> : <Radio size={16} />} TELSİZ (R)
         </button>
         <button onClick={addBot} className="bg-secondary/80 hover:bg-secondary text-white px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 backdrop-blur border transition-all"><Plus size={14} /> BOT EKLE</button>
         <button onClick={quitRace} className="bg-destructive/80 hover:bg-destructive text-white px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 backdrop-blur transition-all"><LogOut size={14} /> ÇIK</button>
      </div>

      {phys.current.collision && 
        <div className="absolute inset-0 border-8 sm:border-[16px] border-red-600/20 pointer-events-none animate-pulse flex items-center justify-center">
            <div className="bg-red-900/50 text-white p-4 rounded-lg flex items-center gap-3 backdrop-blur-sm">
                <ShieldAlert className="w-8 h-8 text-red-300"/>
                <span className="font-bold text-2xl">TEMAS!</span>
            </div>
        </div>
      }
    </div>
  );

}
