'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, signInWithCustomToken, Auth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, serverTimestamp, updateDoc, getDoc, Firestore, writeBatch, getDocs, query, deleteDoc, where, limit } from 'firebase/firestore';

import { MenuScreen } from './menu-screen';
import { LobbyScreen } from './lobby-screen';
import { RaceScreen } from './race-screen';
import { FinishedScreen } from './finished-screen';
import { generateTeamName as generateTeamNameAction, getRaceEngineerMessage } from '@/app/actions';
import { TEAMS } from '@/lib/constants';
import { useFirebaseConfig } from '@/lib/firebase';
import type { PlayerCar, Player, Opponent, Lobby } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

// --- Main Component ---
export default function VelocityLobbyClient() {
  // Core State
  const [user, setUser] = useState<User | null>(null);
  const [gameState, setGameState] = useState('menu');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const { toast } = useToast();
  const config = useFirebaseConfig();
  const configErrorToastShown = useRef(false);

  // Player & Car State
  const [playerCar, setPlayerCar] = useState<PlayerCar>({
    color: TEAMS[0].color,
    name: 'Pilot',
    team: TEAMS[0].name,
    teamId: TEAMS[0].id
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [assistEnabled, setAssistEnabled] = useState(false);

  // Lobby State
  const [lobbyCode, setLobbyCode] = useState("");
  const [inputLobbyCode, setInputLobbyCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [targetLaps, setTargetLaps] = useState(3);
  const [publicLobbies, setPublicLobbies] = useState<Lobby[]>([]);
  const [lobbiesLoading, setLobbiesLoading] = useState(false);


  // Race State
  const [opponents, setOpponents] = useState<Record<string, Opponent>>({});
  const [lapInfo, setLapInfo] = useState({ current: 1, total: 3, finished: false });
  const [radioMessage, setRadioMessage] = useState<string | null>(null);
  const [radioLoading, setRadioLoading] = useState(false);
  const [finalLeaderboard, setFinalLeaderboard] = useState<Player[]>([]);

  // Firebase Refs
  const appRef = useRef<FirebaseApp | null>(null);
  const authRef = useRef<Auth | null>(null);
  const dbRef = useRef<Firestore | null>(null);

  const getFirebase = useCallback(() => {
    if (appRef.current && authRef.current && dbRef.current) {
      return { app: appRef.current, auth: authRef.current, db: dbRef.current };
    }
    if (config.config) {
      const app = initializeApp(config.config, 'velocity-lobby'); // Use a unique name
      appRef.current = app;
      authRef.current = getAuth(app);
      dbRef.current = getFirestore(app);
      return { app, auth: authRef.current, db: dbRef.current };
    }
    return { app: null, auth: null, db: null };
  }, [config.config]);

  const getLobbiesCollectionRef = useCallback(() => {
    const { db } = getFirebase();
    if (!db || !config.appId) return null;
    return collection(db, 'artifacts', config.appId, 'public', 'data', 'lobbies');
  }, [config.appId, getFirebase]);
  
  const getLobbyDocRef = useCallback((code: string) => {
    const { db } = getFirebase();
    if (!db || !config.appId) return null;
    return doc(db, 'artifacts', config.appId, 'public', 'data', 'lobbies', code);
  }, [config.appId, getFirebase]);

  const getPlayerDocRef = useCallback((lobbyCode: string, playerId: string) => {
    const { db } = getFirebase();
    if (!db || !config.appId) return null;
    return doc(db, 'artifacts', config.appId, 'public', 'data', 'lobbies', lobbyCode, 'players', playerId);
  }, [config.appId, getFirebase]);
  
  const startRaceSequence = useCallback((laps: number) => {
    setLapInfo({ current: 1, total: laps, finished: false });
    setGameState('race');
  }, []);

  const onRaceFinish = useCallback((leaderboard: Player[]) => {
    setFinalLeaderboard(leaderboard);
    setGameState('finished');
  }, []);

  // --- Initialization ---
  useEffect(() => {
    if (!config.checked) return;

    if (!config.config) {
      setConnectionStatus('error');
      if (!configErrorToastShown.current) {
        toast({ variant: 'destructive', title: 'Firebase Yapılandırması Eksik', description: 'Uygulama başlatılamadı. Ortam değişkenleri ayarlanmamış.' });
        configErrorToastShown.current = true;
      }
      return;
    }

    const { auth } = getFirebase();

    if (!auth) {
      setConnectionStatus('error');
      if (!configErrorToastShown.current) {
        toast({ variant: 'destructive', title: 'Firebase Kimlik Doğrulama Başlatılamadı', description: 'Uygulama başlatılamadı.' });
        configErrorToastShown.current = true;
      }
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
        if (!configErrorToastShown.current) {
          toast({ variant: 'destructive', title: 'Kimlik Doğrulama Hatası', description: 'Sunucuya bağlanılamadı.' });
          configErrorToastShown.current = true;
        }
      }
    };

    initAuth();
    const unsub = onAuthStateChanged(auth, u => {
      if (u) {
        setUser(u);
        setConnectionStatus('connected');
        const randomName = `Pilot ${u.uid.slice(0, 4)}`;
        setPlayerCar(p => ({ ...p, name: randomName }));
        generateTeamName(randomName); // Also generate a team name on initial load
      } else {
        setUser(null);
        setConnectionStatus('disconnected');
      }
    });
    return () => unsub();
  }, [config.checked, config.config, toast, getFirebase]);

  const quitRace = useCallback(() => {
    setGameState('menu');
    setLobbyCode("");
    setInputLobbyCode("");
    setLobbyPlayers([]);
    setOpponents({});
    setIsHost(false);
  }, []);


  // Centralized listener for lobby and race data
  useEffect(() => {
    if (!lobbyCode || !user) return;

    const { db } = getFirebase();
    if (!db || !config.appId) return;

    const lobbyDocRef = getLobbyDocRef(lobbyCode);
    if (!lobbyDocRef) return;

    const lobbyUnsub = onSnapshot(lobbyDocRef, (doc) => {
      if (!doc.exists()) {
        toast({ title: "Lobi Kapatıldı", description: "Kurucu tarafından lobi kapatıldı veya zaman aşımına uğradı." });
        quitRace();
        return;
      }
      const data = doc.data();
      if (data.status === 'started' && gameState === 'lobby') {
        startRaceSequence(data.laps || 3);
      }
    });

    const playersCol = collection(db, 'artifacts', config.appId, 'public', 'data', 'lobbies', lobbyCode, 'players');
    const playersUnsub = onSnapshot(playersCol, (snap) => {
      const players: Player[] = [];
      const opps: Record<string, Opponent> = {};
      let playerExists = false;
      snap.forEach(d => {
        const playerData = { id: d.id, ...d.data() } as Player;
        players.push(playerData);
        if (d.id === user.uid) {
          playerExists = true;
        } else {
          opps[d.id] = playerData as Opponent;
        }
      });

      if (!playerExists && gameState !== 'menu') {
        toast({ variant: 'destructive', title: "Atıldın!", description: "Lobiden atıldın." });
        quitRace();
        return;
      }
      
      setLobbyPlayers(players);
      if (gameState === 'race') {
        setOpponents(opps);
      }
    });

    return () => {
      lobbyUnsub();
      playersUnsub();
    };
  }, [gameState, lobbyCode, user, getFirebase, config.appId, getLobbyDocRef, startRaceSequence, toast, quitRace]);

  // --- AI Actions ---
  const generateTeamName = useDebouncedCallback(async (pilotName: string) => {
    if (!pilotName || aiLoading) return;
    setAiLoading(true);
    try {
      const teamName = await generateTeamNameAction({ pilotName });
      setPlayerCar(prev => ({ ...prev, team: teamName.replace(/["']/g, '').trim() }));
    } catch(e) {
      console.error("AI team name generation failed", e);
      // Fallback to a default name
      setPlayerCar(prev => ({ ...prev, team: "Cyber Stallions" }));
    } finally {
      setAiLoading(false);
    }
  }, 500);

  const handlePilotNameChange = (name: string) => {
    setPlayerCar(p => ({ ...p, name }));
    generateTeamName(name);
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


  // --- Lobby Actions ---
  const createLobby = async () => {
    const { db } = getFirebase();
    if (!user || !db) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const lobbyDocRef = getLobbyDocRef(code);
    if (!lobbyDocRef) return;

    await setDoc(lobbyDocRef, {
      hostId: user.uid,
      status: 'waiting',
      createdAt: serverTimestamp(),
      laps: targetLaps,
      public: true,
      playerCount: 1,
    });
    await joinLobbyInternal(code, user.uid, true);
  };

  const joinLobby = async (code?: string) => {
    const { db } = getFirebase();
    const lobbyId = code || inputLobbyCode;
    if (!user || !lobbyId || !db) return;
    
    const finalCode = lobbyId.trim().toUpperCase();

    const lobbyDocRef = getLobbyDocRef(finalCode);
    if (!lobbyDocRef) return;

    const lobbyDoc = await getDoc(lobbyDocRef);
    if (!lobbyDoc.exists()) {
      toast({ variant: 'destructive', title: "Lobi bulunamadı!", description: "Lütfen kodu kontrol edin." });
      return;
    }

    setTargetLaps(lobbyDoc.data().laps || 3);
    const isLobbyHost = lobbyDoc.data().hostId === user.uid;

    await joinLobbyInternal(finalCode, user.uid, isLobbyHost);
  };

  const joinLobbyInternal = async (code: string, uid: string, isLobbyHost: boolean) => {
    const { db } = getFirebase();
    if (!db) return;
    
    const playerRef = getPlayerDocRef(code, uid);
    if (!playerRef) return;

    const lobbyRef = getLobbyDocRef(code);
    if (!lobbyRef) return;

    const playersSnap = await getDocs(collection(lobbyRef, 'players'));

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

    await updateDoc(lobbyRef, { playerCount: playersSnap.size + 1 });

    setLobbyCode(code);
    setIsHost(isLobbyHost);
    setGameState('lobby');
  };

  const startRaceByHost = async () => {
    if (!isHost || !lobbyCode) return;
    const lobbyDocRef = getLobbyDocRef(lobbyCode);
    if (!lobbyDocRef) return;
    await updateDoc(lobbyDocRef, { status: 'started' });
  };
  
  const refreshLobbies = useCallback(async () => {
    const lobbiesColRef = getLobbiesCollectionRef();
    if (!lobbiesColRef) return;

    setLobbiesLoading(true);
    try {
        const q = query(lobbiesColRef, where('public', '==', true), where('status', '==', 'waiting'), limit(10));
        const snap = await getDocs(q);
        const lobbies: Lobby[] = [];
        snap.forEach(doc => {
            lobbies.push({ id: doc.id, ...doc.data() } as Lobby);
        });
        setPublicLobbies(lobbies);
    } catch(e) {
        console.error("Error fetching public lobbies:", e);
        toast({ variant: "destructive", title: "Lobiler alınamadı" });
    } finally {
        setLobbiesLoading(false);
    }
  }, [getLobbiesCollectionRef, toast]);

  useEffect(() => {
    if (gameState === 'menu') {
        refreshLobbies();
    }
  }, [gameState, refreshLobbies]);

  const handleAdminLogin = useCallback(() => {
    if (isAdmin) {
      toast({ title: "Admin çıkışı yapıldı." });
      setIsAdmin(false);
      return;
    }
    const pass = prompt("Admin şifresini girin:");
    if (pass === "123gorkem") {
      setIsAdmin(true);
      toast({ title: "Admin girişi başarılı!", description: "Özel yetkiler aktif." });
    } else if (pass) {
      toast({ variant: 'destructive', title: "Şifre yanlış!", description: "Admin girişi başarısız." });
    }
  }, [isAdmin, toast]);

  const kickPlayer = useCallback(async (playerId: string) => {
    if (!isAdmin || !lobbyCode) return;
    const playerRef = getPlayerDocRef(lobbyCode, playerId);
    if (!playerRef) return;
    await deleteDoc(playerRef);
    toast({ title: "Oyuncu Atıldı", description: `Oyuncu ${playerId} lobiden atıldı.` })
  }, [isAdmin, lobbyCode, getPlayerDocRef, toast]);

  const resetDatabase = useCallback(async () => {
    const { db } = getFirebase();
    if (!db) {
      toast({ variant: 'destructive', title: "Veritabanı sıfırlanamadı." });
      return;
    }
    const lobbiesColRef = getLobbiesCollectionRef();
    if (!lobbiesColRef) {
      toast({ variant: 'destructive', title: "Lobi referansı alınamadı." });
      return;
    }

    toast({ title: "Veritabanı sıfırlanıyor...", description: "Lütfen bekleyin." });

    try {
      const querySnapshot = await getDocs(query(lobbiesColRef));
      const batch = writeBatch(db);

      if (querySnapshot.empty) {
        toast({ title: "Veritabanı zaten boş.", description: "Silinecek lobi bulunamadı." });
        return;
      }

      for (const lobbyDoc of querySnapshot.docs) {
        const playersColRef = collection(db, lobbyDoc.ref.path, 'players');
        const playersSnapshot = await getDocs(playersColRef);
        playersSnapshot.forEach(playerDoc => {
          batch.delete(playerDoc.ref);
        });
        batch.delete(lobbyDoc.ref);
      }

      await batch.commit();

      toast({ title: "Veritabanı Sıfırlandı", description: `${querySnapshot.size} lobi ve tüm oyuncular başarıyla silindi.` });
      quitRace();

    } catch (error) {
      console.error("Error resetting database:", error);
      toast({ variant: 'destructive', title: "Sıfırlama Hatası", description: "Veritabanı temizlenirken bir hata oluştu." });
    }
  }, [getFirebase, getLobbiesCollectionRef, quitRace, toast]);

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
  if (!config.checked || connectionStatus === 'connecting' || !user) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <Loader2 className="h-16 w-16 text-accent animate-spin" />
        <div className="ml-4 text-muted-foreground">
          {connectionStatus === 'error' ? 'Bağlantı Hatası. Firebase yapılandırmasını kontrol edin.' : 'Yükleniyor...'}
        </div>
      </div>
    );
  }

  if (gameState === 'menu') {
    return <MenuScreen {...{ playerCar, setPlayerCar, aiLoading, onGenerateTeamName: () => generateTeamName(playerCar.name), onPilotNameChange: handlePilotNameChange, inputLobbyCode, setInputLobbyCode, joinLobby, createLobby, connectionStatus, resetDatabase, isAdmin, handleAdminLogin, publicLobbies, refreshLobbies, lobbiesLoading, assistEnabled, setAssistEnabled }} />;
  }
  if (gameState === 'lobby') {
    return <LobbyScreen {...{ lobbyCode, lobbyPlayers, isHost, startRaceByHost, quitRace, userId: user?.uid ?? null, isAdmin, kickPlayer }} />;
  }
  if (gameState === 'race') {
    return <RaceScreen {...{ playerCar, opponents, setGameState, lapInfo, setLapInfo, syncMultiplayer, triggerRaceEngineer, radioMessage, radioLoading, quitRace, isAdmin, kickPlayer, assistEnabled, onRaceFinish }} />;
  }
  if (gameState === 'finished') {
    return <FinishedScreen playerCar={playerCar} setGameState={setGameState} leaderboard={finalLeaderboard} />;
  }

  // Default loading/initial state
  return (
    <div className="h-screen w-full bg-background flex items-center justify-center">
      <Loader2 className="h-16 w-16 text-accent animate-spin" />
    </div>
  );
}
