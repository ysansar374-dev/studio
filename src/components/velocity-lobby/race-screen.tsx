'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayerCar, Player, Opponent } from '@/types';
import { ACCELERATION, BASE_ROAD_Y, FRICTION_ROAD, LANE_SPEED, MAX_SPEED_DRS, MAX_SPEED_NORMAL, TRACK_LENGTH, WALL_BOUNCE, STEERING_ASSIST_STRENGTH, STEERING_SENSITIVITY, SYNC_INTERVAL } from '@/lib/constants';
import { Loader2, LogOut, Plus, Radio, Zap, ShieldAlert, X, Thermometer } from 'lucide-react';
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
  assistEnabled: boolean;
  onRaceFinish: (leaderboard: Player[]) => void;
  userId: string;
};

type RaceStatus = 'countdown' | 'racing' | 'finished';

const CountdownLight = ({ active }: { active: boolean }) => (
    <div className={`w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-black transition-colors duration-200 ${active ? 'bg-red-600 shadow-[0_0_30px_10px_rgba(255,0,0,0.7)]' : 'bg-neutral-800'}`}></div>
);

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
  kickPlayer,
  assistEnabled,
  onRaceFinish,
  userId
}: RaceScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const gameActive = useRef(true);
  const phys = useRef({ x: 0, y: BASE_ROAD_Y, speed: 0, collision: false, wheelAngle: 0, angle: 0, tyreTemp: 20 });
  const inputs = useRef({ gas: false, brake: false, left: false, right: false, drs: false });
  const botsRef = useRef<Player[]>([]);
  const lastSync = useRef(0);
  const uiUpdateTimer = useRef(0);
  const sparks = useRef<any[]>([]);
  const lapInfoRef = useRef(lapInfo);
  const opponentsRef = useRef<Record<string, Opponent>>(opponents);

  const [drsState, setDrsState] = useState({ active: false, charge: 100 });
  const [leaderboardData, setLeaderboardData] = useState<Player[]>([]);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  
  const [raceStatus, setRaceStatus] = useState<RaceStatus>('countdown');
  const [countdownState, setCountdownState] = useState({ lights: [false, false, false, false, false], text: '' });
  
  useEffect(() => {
    lapInfoRef.current = lapInfo;
  }, [lapInfo]);

   useEffect(() => {
    opponentsRef.current = opponents;
  }, [opponents]);

  // Interpolation logic for opponents
   const interpolatedOpponents = useRef<Record<string, { current: Opponent, target: Opponent }>>({});
   useEffect(() => {
       for (const id in opponents) {
           if (!interpolatedOpponents.current[id]) {
               interpolatedOpponents.current[id] = { current: opponents[id], target: opponents[id] };
           } else {
               interpolatedOpponents.current[id].target = opponents[id];
           }
       }
       // Clean up opponents who have left
       for (const id in interpolatedOpponents.current) {
           if (!opponents[id]) {
               delete interpolatedOpponents.current[id];
           }
       }
   }, [opponents]);

   const getRoadWidth = useCallback((x: number) => {
    return 800;
  }, []);
  
  const getRoadCurve = useCallback((x: number) => {
    const val = x || 0;
    let y = BASE_ROAD_Y + val * 0.05; // General downward slope

    // Wide, sweeping S-curves
    y += Math.sin(val / 2500) * 1000;
    y += Math.cos(val / 1800) * 600;

    return y;
  }, []);


  const drawCar = useCallback((ctx: CanvasRenderingContext2D, carX: number, carY: number, color: string, name: string, isDrsOpen: boolean, isBraking: boolean, wheelAngle: number, bodyAngle: number, wheelRotation: number) => {
    ctx.save();
    ctx.translate(carX, carY);
    ctx.rotate(bodyAngle);

    // Car Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(50, 0); ctx.lineTo(10, -12); ctx.lineTo(-30, -15); ctx.lineTo(-60, -12);
    ctx.lineTo(-60, 12); ctx.lineTo(-30, 15); ctx.lineTo(10, 12);
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(-10, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath(); ctx.arc(-10, 0, 5, 0, Math.PI * 2); ctx.fill();

    // DRS
    ctx.fillStyle = isDrsOpen ? '#22c55e' : '#1e293b';
    ctx.save();
    ctx.translate(-65, 0);
    if (isDrsOpen) {
      // Flap open
      ctx.fillRect(0, -25, 25, 4);
    } else {
      // Flap closed
      ctx.fillRect(0, -2, 25, 4);
    }
    ctx.restore();

    // Front Wing
    ctx.fillStyle = '#1e293b'; ctx.fillRect(45, -20, 10, 40);
    ctx.fillStyle = '#0f172a';

    // Wheels
    const drawWheel = (wx: number, wy: number, width: number, height: number, isFront: boolean) => {
        ctx.save();
        ctx.translate(wx, wy);
        if(isFront) ctx.rotate(wheelAngle);
        
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-width/2, -height/2, width, height, 3);
        ctx.fill();

        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 1;
        const spokeRotation = wheelRotation;
        ctx.rotate(spokeRotation);
        
        ctx.beginPath(); ctx.moveTo(0, -height/2); ctx.lineTo(0, height/2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-width/2, 0); ctx.lineTo(width/2, 0); ctx.stroke();

        ctx.restore();
    };
    
    drawWheel(20, -18, 16, 8, true); // Front-Top
    drawWheel(20, 18, 16, 8, true); // Front-Bottom
    drawWheel(-50, -20, 20, 10, false); // Back-Top
    drawWheel(-50, 20, 20, 10, false); // Back-Bottom

    // Brake Lights
    if (isBraking) {
        ctx.fillStyle = '#ff0000'; ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(-60, -8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-60, 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
    // Name Tag
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.shadowColor = 'black'; ctx.shadowBlur = 4; ctx.fillText(name, 0, -40); ctx.shadowBlur = 0;
    ctx.restore();
  }, []);

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
    const scaleY = 0.1;
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
    Object.values(interpolatedOpponents.current).forEach(o => drawDot(o.current.x || 0, o.current.color, 4, true));
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

    const screenW = canvas.width;
    const screenH = canvas.height;
    ctx.clearRect(0, 0, screenW, screenH);
    ctx.fillStyle = '#455a64';
    ctx.fillRect(0, 0, screenW, screenH);

    ctx.save();
    ctx.translate(-phys.current.x + screenW / 2, -phys.current.y + screenH / 1.5);
    
    // Draw road
    ctx.beginPath();
    ctx.fillStyle = '#37474f';
    for (let i = Math.floor(phys.current.x / 100) * 100 - 4000; i < phys.current.x + 4000; i += 100) {
      const roadY = getRoadCurve(i);
      ctx.lineTo(i, roadY - getRoadWidth(i) / 2);
    }
    for (let i = Math.floor(phys.current.x / 100) * 100 + 4000; i > phys.current.x - 4000; i -= 100) {
      const roadY = getRoadCurve(i);
      ctx.lineTo(i, roadY + getRoadWidth(i) / 2);
    }
    ctx.fill();

    // Draw lines and kerbs
    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 10;
    ctx.beginPath();
    for (let i = Math.floor(phys.current.x / 20) * 20 - 4000; i < phys.current.x + 4000; i += 20) {
      ctx.lineTo(i, getRoadCurve(i) - getRoadWidth(i) / 2);
    }
    ctx.stroke();
    ctx.beginPath();
    for (let i = Math.floor(phys.current.x / 20) * 20 - 4000; i < phys.current.x + 4000; i += 20) {
      ctx.lineTo(i, getRoadCurve(i) + getRoadWidth(i) / 2);
    }
    ctx.stroke();

    const kerb_height = 20;
    for (let i = Math.floor(phys.current.x / 100) * 100 - 4000; i < phys.current.x + 4000; i += 100) {
      const roadY = getRoadCurve(i);
      const roadW = getRoadWidth(i);
      ctx.fillStyle = (i / 100) % 2 === 0 ? '#ef4444' : 'white';
      ctx.beginPath();
      ctx.moveTo(i, roadY - roadW / 2);
      ctx.lineTo(i + 100, roadY - roadW / 2);
      ctx.lineTo(i + 100, roadY - roadW / 2 - kerb_height);
      ctx.lineTo(i, roadY - roadW / 2 - kerb_height);
      ctx.fill();
    }
    
    // Draw finish line
    if (phys.current.x > TRACK_LENGTH - 500 || phys.current.x < 500) {
        drawCheckeredLine(ctx, 0, getRoadCurve(0) - getRoadWidth(0)/2, getRoadWidth(0));
    }

    // Draw bots
    botsRef.current.forEach(bot => {
      drawCar(ctx, bot.x || 0, bot.y || 0, bot.color, bot.name, false, false, 0, 0, 0);
    });

    // Draw opponents (interpolated)
     Object.values(interpolatedOpponents.current).forEach(o => {
      if (o.current.id !== userId) {
        drawCar(ctx, o.current.x || 0, o.current.y || 0, o.current.color, o.current.name, false, false, 0, o.current.angle || 0, 0);
      }
    });

    // Draw player
    if (!lapInfo.finished) {
      drawCar(ctx, phys.current.x, phys.current.y, playerCar.color, playerCar.name, drsState.active, inputs.current.brake, phys.current.wheelAngle, phys.current.angle, phys.current.x);
    }
    
    // Draw sparks
    drawSparks(ctx);

    ctx.restore();
    
    drawMiniMap(ctx, screenW, screenH);
  }, [getRoadCurve, getRoadWidth, drawCar, drawSparks, playerCar, drsState.active, userId, lapInfo.finished]);


  const loop = useCallback((time: number) => {
    if (!gameActive.current) return;

    const p = phys.current;
    const i = inputs.current;
    
    // --- Leaderboard & Catch-up logic ---
    const allRacers = [
      ...Object.values(interpolatedOpponents.current).map(o => o.current),
      ...botsRef.current,
      { name: playerCar.name, id: userId, x: phys.current.x }
    ].sort((a, b) => (b.x || 0) - (a.x || 0));
    
    const playerRank = allRacers.findIndex(r => r.id === userId);
    
    let speedModifier = 1.0;
    if (raceStatus === 'racing') {
        if (playerRank === 0 && allRacers.length > 1) { // Player is 1st
            speedModifier = 0.98; // 2% speed reduction
        } else if (playerRank === allRacers.length - 1 && allRacers.length > 1) { // Player is last
            speedModifier = 1.02; // 2% speed boost
        }
    }
    
    if (raceStatus === 'racing' && !lapInfoRef.current.finished) {
      let currentDrsActive = false;
      
      setDrsState(prev => {
          if (i.drs && prev.charge > 0) {
              currentDrsActive = true;
              return { active: true, charge: Math.max(0, prev.charge - 0.5) };
          } else {
              return { active: false, charge: Math.min(100, prev.charge + 0.1) };
          }
      });

      const currentMaxSpeed = (currentDrsActive ? MAX_SPEED_DRS : MAX_SPEED_NORMAL) * speedModifier;

      let dynamicAccel = ACCELERATION;
      const currentSpeedKmh = p.speed * 10;
      
      if (currentSpeedKmh > 290) {
          dynamicAccel = ACCELERATION * 0.1;
      } else if (currentSpeedKmh > 220) {
          dynamicAccel = ACCELERATION * 0.3;
      }

      const currentAccel = (currentDrsActive ? dynamicAccel * 1.5 : dynamicAccel) * speedModifier;

      if (i.gas) p.speed += currentAccel;
      else p.speed *= FRICTION_ROAD;
      if (i.brake) {
          p.speed -= ACCELERATION * 3;
          p.tyreTemp += 0.2; // Braking heats tyres
      }
      
      p.speed = Math.max(0, Math.min(p.speed, currentMaxSpeed));

      // Tyre Temp
      p.tyreTemp += (p.speed / MAX_SPEED_NORMAL) * 0.05; // Heat from speed
      p.tyreTemp -= 0.08; // Cooling
      p.tyreTemp = Math.max(20, Math.min(p.tyreTemp, 120));


      // --- Steering Logic ---
      const roadCenterY = getRoadCurve(p.x);
      const currentRoadWidth = getRoadWidth(p.x);
      const carHalfHeight = 20;
      const gripModifier = p.tyreTemp > 95 ? 1 - (p.tyreTemp - 95) * 0.008 : 1; // Reduced grip when hot
      const CAR_LENGTH = 70;
      
      if(assistEnabled) {
          // ASSISTED STEERING (Lane-based)
          p.y += (i.right ? LANE_SPEED : 0) + (i.left ? -LANE_SPEED : 0);
          const roadSlope = (getRoadCurve(p.x + 1) - roadCenterY);
          p.angle = roadSlope * 0.5; // Visual tilt
          p.wheelAngle = 0; // Wheels straight in assist mode
          p.x += p.speed;
      } else {
          // MANUAL STEERING (Bicycle Model)
          let steeringInput = 0;
          if(i.left) steeringInput = -1;
          if(i.right) steeringInput = 1;

          p.wheelAngle = steeringInput * STEERING_SENSITIVITY;
          p.tyreTemp += Math.abs(steeringInput * p.speed * 0.005);
          
          const frontWheelX = p.x + CAR_LENGTH / 2 * Math.cos(p.angle);
          const frontWheelY = p.y + CAR_LENGTH / 2 * Math.sin(p.angle);
          const backWheelX = p.x - CAR_LENGTH / 2 * Math.cos(p.angle);
          const backWheelY = p.y - CAR_LENGTH / 2 * Math.sin(p.angle);

          const backWheelSpeed = p.speed * gripModifier;
          
          const newBackWheelX = backWheelX + backWheelSpeed * Math.cos(p.angle);
          const newBackWheelY = backWheelY + backWheelSpeed * Math.sin(p.angle);
          
          const newFrontWheelX = frontWheelX + backWheelSpeed * Math.cos(p.angle + p.wheelAngle);
          const newFrontWheelY = frontWheelY + backWheelSpeed * Math.sin(p.angle + p.wheelAngle);

          p.x = (newFrontWheelX + newBackWheelX) / 2;
          p.y = (newFrontWheelY + newBackWheelY) / 2;
          p.angle = Math.atan2(newFrontWheelY - newBackWheelY, newFrontWheelX - newBackWheelX);
      }
      
      // --- Collision Logic ---
      p.collision = false;

      if (p.y < roadCenterY - currentRoadWidth / 2 + carHalfHeight || p.y > roadCenterY + currentRoadWidth / 2 - carHalfHeight) {
        p.speed *= WALL_BOUNCE;
        p.collision = true;
        const sparkSide = p.y < roadCenterY ? -1 : 1;
        p.y = roadCenterY + (sparkSide * (currentRoadWidth / 2 - carHalfHeight));
        p.tyreTemp += 2;
        if (!assistEnabled) {
            p.angle *= -0.5; // Bounce off wall
        }
        createSparks(p.x - 60, p.y + (sparkSide * 15), 10);
      }
      
      const checkAndHandleCollision = (racerA: any, racerB: any) => {
          if (p.x < 100) return; // Collision grace period
          if (!racerA.x || !racerA.y || !racerB.x || !racerB.y) return;
          const dx = racerA.x - racerB.x;
          const dy = racerA.y - racerB.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 80) {
              const overlap = (80 - distance) / 2;
              const pushX = (dx / distance) * overlap;
              const pushY = (dy / distance) * overlap;
              
              racerA.x += pushX;
              racerA.y += pushY;
              racerB.x -= pushX;
              racerB.y -= pushY;

              if (racerA.id === userId) {
                  p.speed *= 0.9;
                  p.collision = true;
                  p.tyreTemp += 5;
                  createSparks(p.x - dx/2, p.y - dy/2, 15);
              } else if (racerA.speed) {
                  racerA.speed *= 0.95;
              }
              if (racerB.id === userId) {
                  p.speed *= 0.9;
                  p.collision = true;
                  p.tyreTemp += 5;
                  createSparks(p.x - dx/2, p.y - dy/2, 15);
              } else if (racerB.speed) {
                  racerB.speed *= 0.95;
              }
          }
      }

      botsRef.current.forEach(bot => checkAndHandleCollision(p, bot));
      Object.values(interpolatedOpponents.current).forEach(opp => checkAndHandleCollision(p, opp.current));
    }
    
    // --- Interpolate opponent positions ---
    const lerpFactor = 0.2; // Adjust for smoothness
    for (const id in interpolatedOpponents.current) {
        const ipo = interpolatedOpponents.current[id];
        if (ipo.current.x !== undefined && ipo.target.x !== undefined) {
            ipo.current.x += (ipo.target.x - ipo.current.x) * lerpFactor;
        }
         if (ipo.current.y !== undefined && ipo.target.y !== undefined) {
            ipo.current.y += (ipo.target.y - ipo.current.y) * lerpFactor;
        }
        if (ipo.current.angle !== undefined && ipo.target.angle !== undefined) {
            let angleDiff = ipo.target.angle - ipo.current.angle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            ipo.current.angle += angleDiff * lerpFactor;
        }
    }


    setLapInfo(prev => {
        if (!gameActive.current || raceStatus !== 'racing' || prev.finished) return prev;
        const newLap = Math.floor(phys.current.x / TRACK_LENGTH) + 1;
        if (newLap > prev.current) {
            if (newLap > prev.total) {
                // Player finishes the race
                const finalLeaderboard = [
                    ...Object.values(opponentsRef.current),
                    ...botsRef.current,
                    { name: playerCar.name, x: phys.current.x, isMe: true, id: userId, color: playerCar.color, team: playerCar.team, ready: true }
                ].sort((a, b) => (b.x || 0) - (a.x || 0));
                
                const allOpponentsFinished = Object.values(opponentsRef.current).every(opp => (opp.lap || 0) > lapInfo.total);

                if (allOpponentsFinished) {
                    onRaceFinish(finalLeaderboard as Player[]);
                    gameActive.current = false;
                    setRaceStatus('finished');
                }
                return { ...prev, finished: true };
            } else {
                return { ...prev, current: newLap };
            }
        }
        return prev;
    });

      
    botsRef.current.forEach((bot, index) => {
        if(!(bot as any).speed) (bot as any).speed = 18 + Math.random() * 4;
        if(!(bot as any).offsetY) (bot as any).offsetY = (Math.random() - 0.5) * (getRoadWidth(bot.x || 0) - 60);

        const botSpeed = (bot as any).speed || 0;
        const botX = bot.x || 0;
        const botY = bot.y || 0;
        const idealY = getRoadCurve(botX) + ((bot as any).offsetY || 0);

        bot.y = botY + (idealY - botY) * 0.05;
        bot.x = botX + botSpeed;

        if (Math.random() < 0.005) {
            (bot as any).offsetY = (Math.random() - 0.5) * (getRoadWidth(botX) - 60);
        }
        
        for(let j = index + 1; j < botsRef.current.length; j++) {
            checkAndHandleCollision(bot, botsRef.current[j]);
        }

        if (Math.abs(p.x - botX) > 4000) {
            bot.x = p.x + (Math.random() > 0.5 ? 1 : -1) * (1000 + Math.random() * 500);
            bot.y = getRoadCurve(bot.x);
        }
    });


    uiUpdateTimer.current++;
    if (uiUpdateTimer.current % 10 === 0) {
        setLeaderboardData(allRacers as Player[]);
    }
    
    if (time - lastSync.current > SYNC_INTERVAL) {
        if (!lapInfoRef.current.finished) {
            syncMultiplayer(phys.current, lapInfoRef.current);
        }
        lastSync.current = time;
    }
    
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [draw, getRoadCurve, getRoadWidth, playerCar, setLapInfo, syncMultiplayer, assistEnabled, onRaceFinish, raceStatus, userId, lapInfo.total]);


  const addBot = () => {
    if (botsRef.current.length >= 12) return;
    const startX = phys.current.x;
    const randomTeam = { color: '#888' };
    const newBot: Partial<Player> & {speed?: number, offsetY?: number} = {
      id: `bot_${Date.now()}`,
      x: startX - 200 + Math.random() * 400,
      speed: 18 + Math.random() * 4,
      color: randomTeam.color,
      offsetY: (Math.random() - 0.5) * (getRoadWidth(startX) - 60),
      name: `Bot ${botsRef.current.length + 1}`
    };
    (newBot as any).y = getRoadCurve(newBot.x!) + newBot.offsetY!;
    botsRef.current.push(newBot as Player);
  };
  
   useEffect(() => {
    const handleCountdown = () => {
        if (raceStatus !== 'countdown') return;

        const lightSequence = [
            { t: 500, lights: [true, false, false, false, false], text: '' },
            { t: 1500, lights: [true, true, false, false, false], text: '' },
            { t: 2500, lights: [true, true, true, false, false], text: '' },
            { t: 3500, lights: [true, true, true, true, false], text: '' },
            { t: 4500, lights: [true, true, true, true, true], text: '' },
            { t: 5500, lights: [false, false, false, false, false], text: 'YARIŞ BAŞLADI!' },
            { t: 6500, lights: [false, false, false, false, false], text: '' },
        ];

        lightSequence.forEach(step => {
            setTimeout(() => {
                if (!gameActive.current) return;
                setCountdownState({ lights: step.lights, text: step.text });
                 if (step.t === 5500) {
                    setRaceStatus('racing');
                }
            }, step.t);
        });
    };

    handleCountdown();
  }, [raceStatus]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    handleResize();

    const hD = (e: KeyboardEvent) => {
      if (raceStatus !== 'racing' || lapInfoRef.current.finished) return;
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

    const finishCheckInterval = setInterval(() => {
        if (raceStatus !== 'racing' || !gameActive.current) return;
        
        const allHumansFinished = Object.values(opponentsRef.current).every(opp => (opp.lap || 0) > lapInfo.total) && lapInfoRef.current.finished;

        if (allHumansFinished) {
            const finalLeaderboard = [
                ...Object.values(opponentsRef.current),
                ...botsRef.current,
                { name: playerCar.name, x: phys.current.x, isMe: true, id: userId, color: playerCar.color, team: playerCar.team, ready: true }
            ].sort((a, b) => (b.x || 0) - (a.x || 0));

            onRaceFinish(finalLeaderboard as Player[]);
            gameActive.current = false;
            setRaceStatus('finished');
        }

    }, 2000);


    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', hD);
      window.removeEventListener('keyup', hU);
      clearInterval(finishCheckInterval);
      gameActive.current = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop, quitRace, triggerRaceEngineer, drsState, raceStatus, lapInfo.total, onRaceFinish, playerCar, userId]);

  const getTyreTempColor = (temp: number) => {
    if (temp > 105) return 'bg-red-600';
    if (temp > 85) return 'bg-yellow-400';
    if (temp > 50) return 'bg-green-500';
    return 'bg-blue-400';
  }

  return (
    <div className="h-screen w-full bg-background overflow-hidden relative select-none cursor-none">
      <canvas ref={canvasRef} width={windowSize.width} height={windowSize.height} className="block" />

       {/* Countdown */}
      {raceStatus === 'countdown' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm z-50 pointer-events-none">
            <div className="flex gap-4 mb-8">
                <CountdownLight active={countdownState.lights[0]} />
                <CountdownLight active={countdownState.lights[1]} />
                <CountdownLight active={countdownState.lights[2]} />
                <CountdownLight active={countdownState.lights[3]} />
                <CountdownLight active={countdownState.lights[4]} />
            </div>
             {countdownState.text && (
                <div className="text-white font-black text-6xl sm:text-8xl italic tracking-tighter animate-pingOnce" style={{'--webkit-text-stroke': '2px black'} as React.CSSProperties}>
                    {countdownState.text}
                </div>
            )}
        </div>
      )}


      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-start pointer-events-none">
        {/* Speed, DRS, Tyres */}
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
          <div className="bg-card/80 p-3 rounded-r-xl flex items-center gap-3 w-56 sm:w-72 backdrop-blur">
            <div className={`font-bold text-xs px-2 py-1 rounded bg-muted-foreground/20 text-muted-foreground`}><Thermometer size={12}/></div>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-200 ${getTyreTempColor(phys.current.tyreTemp)}`} style={{ width: `${(phys.current.tyreTemp - 20)}%` }}></div>
            </div>
            <span className="text-xs font-mono w-10 text-right">{Math.round(phys.current.tyreTemp)}°C</span>
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
                        <div key={d.id || i} className={`flex justify-between items-center p-1 rounded group ${d.id === userId ? 'bg-accent/20 text-accent font-bold border-l-2 border-accent' : 'text-foreground'}`}>
                            <div className="flex items-center gap-2"><span className="text-muted-foreground w-4">{i + 1}</span><span className="truncate w-24">{d.name}</span></div>
                            <div className="flex items-center gap-2">
                              <span className={i === 0 ? 'text-green-400' : 'text-red-400'}>{i === 0 ? 'LİDER' : `+${Math.floor((leaderX - (d.x || 0)) / 10)}m`}</span>
                              {isAdmin && d.id !== userId && d.id && !d.id.startsWith('bot_') && (
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                                  onClick={(e) => { e.stopPropagation(); d.id && kickPlayer(d.id); }}
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
         <button onClick={() => triggerRaceEngineer(phys.current, drsState, lapInfoRef.current)} disabled={radioLoading || raceStatus !== 'racing'} className="bg-primary/80 hover:bg-primary text-white px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 backdrop-blur border transition-all disabled:opacity-50 disabled:cursor-wait">
            {radioLoading ? <Loader2 className="animate-spin" size={16} /> : <Radio size={16} />} TELSİZ (R)
         </button>
         {isAdmin && <button onClick={addBot} disabled={raceStatus !== 'racing'} className="bg-secondary/80 hover:bg-secondary text-white px-5 py-3 rounded-xl font-bold text-xs flex items-center gap-2 backdrop-blur border transition-all disabled:opacity-50"><Plus size={14} /> BOT EKLE</button>}
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

    
    