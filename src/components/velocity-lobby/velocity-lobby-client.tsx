
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User, signInWithCustomToken, Auth } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, serverTimestamp, updateDoc, getDoc, Firestore, writeBatch, getDocs, query, deleteDoc } from 'firebase/firestore';

import { MenuScreen } from './menu-screen';
import { LobbyScreen } from './lobby-screen';
import { RaceScreen } from './race-screen';
import { FinishedScreen } from './finished-screen';
import { generateTeamName as generateTeamNameAction, getRaceEngineerMessage } from '@/app/actions';
import { TEAMS } from '@/lib/constants';
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
  const [isAdmin, setIsAdmin] = useState(false);
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
  
  const getLobbyDocRef = useCallback((code: string) => {
    const { db } = getFirebase();
    if (!db || !config.appId) return null;
    return doc(db, 'artifacts', config.appId, 'public', 'data', 'lobbies', code);
  }, [config.appId, getFirebase]);
  
  const getLobbiesCollectionRef = useCallback(() => {
    const { db } = getFirebase();
    if (!db || !config.appId) return null;
    return collection(db, 'artifacts', config.appId, 'public', 'data', 'lobbies');
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

  const quitRace = useCallback(() => {
    setGameState('menu');
    setLobbyCode("");
    setInputLobbyCode("");
    setLobbyPlayers([]);
    setOpponents({});
    setIsHost(false);
  }, []);

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
  }, [config, toast, getFirebase]);

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
      if (doc.exists() && gameState === 'lobby') {
        const data = doc.data();
        if (data.status === 'started') {
          startRaceSequence(data.laps || 3);
        }
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
        }
        if (d.id !== user.uid) {
          opps[d.id] = playerData as Opponent;
        }
      });
      
      if (!playerExists && gameState !== 'menu') {
        toast({ variant: 'destructive', title: "Atıldın!", description: "Lobiden atıldın."});
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
      laps: targetLaps
    });
    await joinLobbyInternal(code, user.uid, true);
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
    
    setTargetLaps(lobbyDoc.data().laps || 3);
    const isLobbyHost = lobbyDoc.data().hostId === user.uid;
    
    await joinLobbyInternal(code, user.uid, isLobbyHost);
  };

  const joinLobbyInternal = async (code: string, uid: string, isLobbyHost: boolean) => {
      const playerRef = getPlayerDocRef(code, uid);
      if(!playerRef) return;

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
  
  const handleAdminLogin = () => {
    if (isAdmin) {
      toast({ title: "Admin çıkışı yapıldı."});
      setIsAdmin(false);
      return;
    }
    const pass = prompt("Admin şifresini girin:");
    if (pass === "123gorkem") {
      setIsAdmin(true);
      toast({ title: "Admin girişi başarılı!", description: "Özel yetkiler aktif."});
    } else if (pass) {
      toast({ variant: 'destructive', title: "Şifre yanlış!", description: "Admin girişi başarısız."});
    }
  };

  const kickPlayer = async (playerId: string) => {
    if (!isAdmin || !lobbyCode) return;
    const playerRef = getPlayerDocRef(lobbyCode, playerId);
    if (!playerRef) return;
    await deleteDoc(playerRef);
    toast({ title: "Oyuncu Atıldı", description: `Oyuncu ${playerId} lobiden atıldı.`})
  };

  const resetDatabase = async () => {
    if (!isAdmin) {
        toast({ variant: 'destructive', title: "Yetki Gerekli", description: "Bu işlem için admin olmalısınız."});
        return;
    }
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
  if (!config.config || connectionStatus === 'connecting' || !user) {
    return (
      <div className="h-screen w-full bg-background flex items-center justify-center">
        <Loader2 className="h-16 w-16 text-accent animate-spin" />
        <p className="text-muted-foreground ml-4">Yükleniyor...</p>
      </div>
    );
  }

  if (gameState === 'menu') {
    return <MenuScreen {...{ playerCar, setPlayerCar, aiLoading, generateTeamName, inputLobbyCode, setInputLobbyCode, joinLobby, createLobby, connectionStatus, resetDatabase, isAdmin, handleAdminLogin }} />;
  }
  if (gameState === 'lobby') {
    return <LobbyScreen {...{ lobbyCode, lobbyPlayers, isHost, startRaceByHost, quitRace, userId: user?.uid ?? null, isAdmin, kickPlayer }} />;
  }
  if (gameState === 'race') {
    return <RaceScreen {...{ playerCar, opponents, setGameState, lapInfo, setLapInfo, syncMultiplayer, triggerRaceEngineer, radioMessage, radioLoading, quitRace, isAdmin, kickPlayer }} />;
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
