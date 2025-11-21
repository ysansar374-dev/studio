'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, signInWithCustomToken, Auth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, serverTimestamp, updateDoc, addDoc, getDoc, Firestore } from 'firebase/firestore';

import { MenuScreen } from './menu-screen';
import { LobbyScreen } from './lobby-screen';
import { RaceScreen } from './race-screen';
import { FinishedScreen } from './finished-screen';
import { generateTeamName as generateTeamNameAction, getRaceEngineerMessage } from '@/app/actions';
import { TEAMS, TRACK_LENGTH } from '@/lib/constants';
import { useFirebaseConfig } from '@/lib/firebase';
import type { PlayerCar, Player, Opponent } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// --- Main Component ---
export default function VelocityLobbyClient() {
  // Core State
  const [user, setUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState('menu');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const { toast } = useToast();
  const config = useFirebaseConfig();

  // Player & Car State
  const [playerCar, setPlayerCar] = useState<PlayerCar>({
    color: TEAMS[0].color,
    name: 'Pilot',
    team: TEAMS[0].name,
    teamId: TEAMS[0].id
  });
  const [aiLoading, setAiLoading] = useState(false);

  // Lobby State
  const [lobbyCode, setLobbyCode] = useState("");
  const [inputLobbyCode, setInputLobbyCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [targetLaps, setTargetLaps] = useState(3);

  // Race State
  const [opponents, setOpponents] = useState<Record<string, Opponent>>({});
  const [lapInfo, setLapInfo] = useState({ current: 1, total: 3, finished: false });
  const [radioMessage, setRadioMessage] = useState<string | null>(null);
  const [radioLoading, setRadioLoading] = useState(false);

  // Firebase Refs
  const appRef = useRef<FirebaseApp | null>(null);
  const authRef = useRef<Auth | null>(null);
  const dbRef = useRef<Firestore | null>(null);
  
  const getFirebase = () => {
    if (appRef.current && authRef.current && dbRef.current) {
      return { app: appRef.current, auth: authRef.current, db: dbRef.current };
    }
    if (config.config) {
      const app = initializeApp(config.config);
      appRef.current = app;
      authRef.current = getAuth(app);
      dbRef.current = getFirestore(app);
      return { app, auth: authRef.current, db: dbRef.current };
    }
    return { app: null, auth: null, db: null };
  };


  // --- Initialization ---
  useEffect(() => {
    if (!config.config) {
        setConnectionStatus('error');
        toast({ variant: 'destructive', title: 'Firebase Yapılandırması Eksik', description: 'Uygulama başlatılamadı.' });
        return;
    }
    
    const { auth } = getFirebase();

    if (!auth) {
      setConnectionStatus('error');
      toast({ variant: 'destructive', title: 'Firebase Kimlik Doğrulama Başlatılamadı', description: 'Uygulama başlatılamadı.' });
      return;
    }

    const initAuth = async () => {
      try {
        // @ts-ignore
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try { // @ts-ignore
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (e) {
            console.warn("Custom token invalid, falling back to anonymous sign-in.", e);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setConnectionStatus('error');
        toast({ variant: 'destructive', title: 'Kimlik Doğrulama Hatası', description: 'Sunucuya bağlanılamadı.' });
      }
    };

    initAuth();
    const unsub = onAuthStateChanged(auth, u => {
      if (u) {
        setUser(u);
        setConnectionStatus('connected');
        setPlayerCar(p => ({ ...p, name: `Pilot ${u.uid.slice(0, 4)}` }));
      } else {
        setUser(null);
        setConnectionStatus('disconnected');
      }
    });
    return () => unsub();
  }, [config, toast]);

  // --- AI Actions ---
  const generateTeamName = async () => {
    if (!playerCar.name || aiLoading) return;
    setAiLoading(true);
    const teamName = await generateTeamNameAction({ pilotName: playerCar.name });
    setPlayerCar(prev => ({ ...prev, team: teamName.replace(/["']/g, '').trim() }));
    setAiLoading(false);
  };
  
  const triggerRaceEngineer = async (phys: any, drsState: any, currentLapInfo: any) => {
    if (radioLoading) return;
    setRadioLoading(true);
    const speed = Math.floor(phys.speed * 10);
    const lap = currentLapInfo.current;
    let context = "Normal seyir.";
    if (phys.collision) context = "Kaza yaptı!";
    if (drsState.active) context = "DRS açık.";
    const msg = await getRaceEngineerMessage({
        speed,
        lap,
        context,
        team: playerCar.team
    });
    setRadioMessage(msg);
    setRadioLoading(false);
    setTimeout(() => setRadioMessage(null), 7000);
  };

  const getLobbyDocRef = useCallback((code: string) => {
    const { db } = getFirebase();
    if (!db || !config.appId) return null;
    return doc(db, 'artifacts', config.appId, 'public', 'data', 'lobbies', code);
  }, [config.appId]);

  const getPlayerDocRef = useCallback((lobbyCode: string, playerId: string) => {
     const { db } = getFirebase();
     if (!db || !config.appId) return null;
     return doc(db, 'artifacts', config.appId, 'public', 'data', 'lobbies', lobbyCode, 'players', playerId);
  }, [config.appId]);


  // --- Lobby Actions ---
  const createLobby = async () => {
    const { db } = getFirebase();
    if (!user || !db) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setLobbyCode(code);
    setIsHost(true);
    setGameState('lobby');

    const lobbyDocRef = getLobbyDocRef(code);
    if (!lobbyDocRef) return;

    await setDoc(lobbyDocRef, {
      hostId: user.uid,
      status: 'waiting',
      createdAt: serverTimestamp(),
      laps: targetLaps
    });
    await joinLobbyInternal(code, user.uid);
  };

  const joinLobby = async () => {
    const { db } = getFirebase();
    if (!user || !inputLobbyCode || !db) return;
    const code = inputLobbyCode.trim().toUpperCase();
    
    const lobbyDocRef = getLobbyDocRef(code);
    if (!lobbyDocRef) return;
    
    const lobbyDoc = await getDoc(lobbyDocRef);
    if (!lobbyDoc.exists()) {
      toast({ variant: 'destructive', title: "Lobi bulunamadı!", description: "Lütfen kodu kontrol edin." });
      return;
    }
    
    setLobbyCode(code);
    setTargetLaps(lobbyDoc.data().laps || 3);
    setIsHost(lobbyDoc.data().hostId === user.uid);
    setGameState('lobby');
    
    await joinLobbyInternal(code, user.uid);
  };

  const joinLobbyInternal = async (code: string, uid: string) => {
      const { db } = getFirebase();
      const playerRef = getPlayerDocRef(code, uid);
      if(!playerRef || !db || !config.appId) return;

      await setDoc(playerRef, {
        name: playerCar.name,
        team: playerCar.team,
        color: playerCar.color,
        ready: true,
        lastSeen: serverTimestamp(),
        x: 0,
        y: 0,
        lap: 1
      });

      const lobbyDocRef = getLobbyDocRef(code);
      if(!lobbyDocRef) return;

      onSnapshot(lobbyDocRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          if (data.status === 'started' && gameState !== 'race') {
            startRaceSequence(data.laps || 3);
          }
        }
      });
      
      const playersCol = collection(db, 'artifacts', config.appId, 'public', 'data', 'lobbies', code, 'players');
      onSnapshot(playersCol, (snap) => {
        const players: Player[] = [];
        const opps: Record<string, Opponent> = {};
        snap.forEach(d => {
          const pData = d.data() as Player;
          players.push({ id: d.id, ...pData });
          if (d.id !== uid) {
            opps[d.id] = { id: d.id, ...pData };
          }
        });
        setLobbyPlayers(players);
        setOpponents(opps);
      });
  };

  const startRaceByHost = async () => {
    if (!isHost || !lobbyCode) return;
    const lobbyDocRef = getLobbyDocRef(lobbyCode);
    if (!lobbyDocRef) return;
    await updateDoc(lobbyDocRef, { status: 'started' });
  };
  
  const startRaceSequence = (laps: number) => {
    setLapInfo({ current: 1, total: laps, finished: false });
    setGameState('race');
  };

  const quitRace = () => {
    setGameState('menu');
    setLobbyCode("");
    setInputLobbyCode("");
    setLobbyPlayers([]);
    setOpponents({});
    setIsHost(false);
  };

  const syncMultiplayer = useCallback((phys: any, currentLapInfo: any) => {
    if (!user || !lobbyCode) return;
    const playerRef = getPlayerDocRef(lobbyCode, user.uid);
    if (!playerRef) return;
    updateDoc(playerRef, {
      x: phys.x,
      y: phys.y,
      lap: currentLapInfo.current,
      lastSeen: serverTimestamp()
    }).catch(e => console.warn("Sync error:", e));
  }, [user, lobbyCode, getPlayerDocRef]);


  // --- Render ---
  if (!config.config) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <Loader2 className="h-16 w-16 text-accent animate-spin" />
        <p className="text-muted-foreground ml-4">Firebase config is loading...</p>
      </div>
    );
  }

  if (gameState === 'menu') {
    return <MenuScreen {...{ playerCar, setPlayerCar, aiLoading, generateTeamName, inputLobbyCode, setInputLobbyCode, joinLobby, createLobby, connectionStatus }} />;
  }
  if (gameState === 'lobby') {
    return <LobbyScreen {...{ lobbyCode, lobbyPlayers, isHost, startRaceByHost, quitRace, userId: user?.uid ?? null }} />;
  }
  if (gameState === 'race') {
    return <RaceScreen {...{ playerCar, opponents, setGameState, lapInfo, setLapInfo, syncMultiplayer, triggerRaceEngineer, radioMessage, radioLoading, quitRace }} />;
  }
  if (gameState === 'finished') {
    return <FinishedScreen playerCar={playerCar} setGameState={setGameState} />;
  }
  
  // Default loading/initial state
  return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <Loader2 className="h-16 w-16 text-accent animate-spin" />
      </div>
  );
}
