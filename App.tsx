import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/GameLoop';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CHARACTERS, SHOP_UPGRADES, MAPS, EVOLUTION_WEAPON_IDS, WEAPONS } from './constants';
import { CharacterType, GameState, WeaponDef, PassiveDef, UserSaveData, UpgradeId, MapId, WeaponId } from './types';

// Screens
enum Screen {
  MAIN = 'MAIN',
  CHAR_SELECT = 'CHAR_SELECT',
  MAP_SELECT = 'MAP_SELECT',
  GAME = 'GAME',
  SHOP = 'SHOP',
  SETTINGS = 'SETTINGS'
}

const DEFAULT_SAVE: UserSaveData = {
  coins: 0,
  upgrades: {}
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  // App State
  const [screen, setScreen] = useState<Screen>(Screen.MAIN);
  const [saveData, setSaveData] = useState<UserSaveData>(DEFAULT_SAVE);
  
  // Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [upgradeChoices, setUpgradeChoices] = useState<any[]>([]); 
  const [gameOverStats, setGameOverStats] = useState<GameState | null>(null);
  const [character, setCharacter] = useState<CharacterType | null>(null);
  const [selectedMap, setSelectedMap] = useState<MapId | null>(null);
  const [isPauseMenuOpen, setIsPauseMenuOpen] = useState(false);

  // Evolution State
  const [evolvedItem, setEvolvedItem] = useState<WeaponDef | null>(null);

  // Settings
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [joystickScale, setJoystickScale] = useState(1.0);

  // Joystick State
  const joystickRef = useRef<HTMLDivElement>(null);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const [joystickOrigin, setJoystickOrigin] = useState<{x:number, y:number} | null>(null);

  // Load Save
  useEffect(() => {
    const saved = localStorage.getItem('webSurvivorsSave');
    if (saved) {
      try {
        setSaveData(JSON.parse(saved));
      } catch (e) {
        console.error("Save load failed", e);
      }
    }
  }, []);

  // Persist Save
  const updateSave = (newData: UserSaveData) => {
      setSaveData(newData);
      localStorage.setItem('webSurvivorsSave', JSON.stringify(newData));
  };

  useEffect(() => {
    if (screen === Screen.GAME && canvasRef.current && character && selectedMap) {
      const engine = new GameEngine(
        CHARACTERS[character],
        MAPS[selectedMap],
        saveData,
        (choices: any[]) => {
            setUpgradeChoices(choices);
            setShowLevelUp(true);
        },
        (finalStats: GameState) => {
            setGameOverStats(finalStats);
            const newSave = {
                ...saveData,
                coins: finalStats.totalCoins 
            };
            updateSave(newSave);
        },
        (state: GameState) => setGameState(state)
      );
      
      engine.start(canvasRef.current);
      engineRef.current = engine;
      
      // Reset states
      setIsPauseMenuOpen(false);
      setShowLevelUp(false);
      setGameOverStats(null);
      setEvolvedItem(null);

      return () => engine.stop();
    }
  }, [screen, character, selectedMap]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (screen !== Screen.GAME || showLevelUp || gameOverStats || isPauseMenuOpen || evolvedItem) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setJoystickOrigin({ x: clientX, y: clientY });
    setJoystickPos({ x: 0, y: 0 });
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickOrigin || !engineRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const dx = clientX - joystickOrigin.x;
    const dy = clientY - joystickOrigin.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = 50 * joystickScale;
    
    const limitedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);
    
    const jx = Math.cos(angle) * limitedDist;
    const jy = Math.sin(angle) * limitedDist;

    setJoystickPos({ x: jx, y: jy });
    engineRef.current.setJoystick(jx / maxDist, jy / maxDist);
  };

  const handleTouchEnd = () => {
    setJoystickOrigin(null);
    setJoystickPos({ x: 0, y: 0 });
    if (engineRef.current) engineRef.current.setJoystick(0, 0);
  };

  const playEvolutionFanfare = () => {
    if (!soundEnabled || !window.AudioContext) return;
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playNote = (freq: number, start: number, dur: number, type: OscillatorType = 'square') => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.1, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur);
        }

        // Victory Fanfare
        playNote(523.25, 0.0, 0.15); // C5
        playNote(523.25, 0.15, 0.15); // C5
        playNote(523.25, 0.3, 0.15); // C5
        playNote(659.25, 0.45, 0.3); // E5
        playNote(783.99, 0.75, 0.3); // G5
        playNote(1046.50, 1.05, 1.5, 'triangle'); // C6
    } catch(e) {
        console.error("Audio play failed", e);
    }
  }

  const selectUpgrade = (item: any) => { 
    if (item.id === 'COIN_BAG') {
         engineRef.current!.state.totalCoins += 50;
         setShowLevelUp(false);
         engineRef.current!.state.isPaused = false;
    } else if (item.id === 'POTION') {
        engineRef.current!.state.hp = engineRef.current!.state.maxHp;
        setShowLevelUp(false);
        engineRef.current!.state.isPaused = false;
    } else {
        const isEvolution = EVOLUTION_WEAPON_IDS.includes(item.id);
        
        engineRef.current?.applyUpgrade(item);
        setShowLevelUp(false);
        
        if (isEvolution) {
            // Keep game paused for animation
            if (engineRef.current) engineRef.current.state.isPaused = true;
            setEvolvedItem(item);
            playEvolutionFanfare();
            
            setTimeout(() => {
                setEvolvedItem(null);
                if (engineRef.current) engineRef.current.state.isPaused = false;
            }, 3500); // 3.5s animation duration
        }
    }
  };

  const buyGlobalUpgrade = (up: typeof SHOP_UPGRADES[0]) => {
      const currentLevel = saveData.upgrades[up.id] || 0;
      if (currentLevel >= up.maxLevel) return;
      
      const cost = Math.floor(up.cost * Math.pow(up.costScaling, currentLevel));
      if (saveData.coins >= cost) {
          const newSave = { ...saveData };
          newSave.coins -= cost;
          newSave.upgrades[up.id] = currentLevel + 1;
          updateSave(newSave);
      }
  };

  // --- Menu Actions ---
  const togglePause = () => {
      if (!engineRef.current || showLevelUp || gameOverStats || evolvedItem) return;
      
      const nextState = !isPauseMenuOpen;
      setIsPauseMenuOpen(nextState);
      engineRef.current.state.isPaused = nextState;
      
      if (nextState) {
          setJoystickOrigin(null);
          setJoystickPos({ x: 0, y: 0 });
          engineRef.current.setJoystick(0, 0);
      }
  };

  const quitGame = () => {
      if (engineRef.current) engineRef.current.state.isPaused = true;
      setScreen(Screen.MAIN);
      setGameState(null);
  };

  // --- Screens ---

  const renderMainMenu = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white p-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
      <div className="text-6xl font-black text-red-600 mb-2 tracking-tighter drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)]">VAMPIRE<br/>SURVIVORS<br/><span className="text-2xl text-white block mt-2 tracking-widest font-normal opacity-80">WEB EDITION</span></div>
      
      <div className="mt-12 flex flex-col gap-4 w-64">
        <button onClick={() => setScreen(Screen.CHAR_SELECT)} className="py-4 bg-red-700 hover:bg-red-600 text-white font-bold rounded shadow-[0_4px_0_rgb(127,29,29)] active:shadow-none active:translate-y-1 transition-all border-2 border-red-900">
          게임 시작
        </button>
        <button onClick={() => setScreen(Screen.SHOP)} className="py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded shadow-[0_4px_0_rgb(146,64,14)] active:shadow-none active:translate-y-1 transition-all border-2 border-yellow-800 flex justify-center items-center gap-2">
          상점 <span className="text-xs bg-black/30 px-2 rounded-full">🪙 {saveData.coins}</span>
        </button>
        <button onClick={() => setScreen(Screen.SETTINGS)} className="py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded shadow-[0_4px_0_rgb(39,39,42)] active:shadow-none active:translate-y-1 transition-all border-2 border-zinc-800">
          설정
        </button>
      </div>
      <div className="mt-8 text-zinc-500 text-xs">v1.2.0 - HTML5 Canvas & React</div>
    </div>
  );

  const renderCharSelect = () => (
    <div className="flex flex-col items-center min-h-screen bg-zinc-900 text-white p-4">
       <h2 className="text-3xl font-bold mb-6 text-yellow-500">캐릭터 선택</h2>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
          {Object.values(CHARACTERS).map((char) => (
            <button
              key={char.id}
              onClick={() => { setCharacter(char.id); setScreen(Screen.MAP_SELECT); }}
              className="p-6 bg-zinc-800 border-2 border-zinc-700 hover:border-red-500 hover:bg-zinc-750 rounded-lg flex flex-col items-center transition-all group relative overflow-hidden"
            >
              <div className="w-16 h-16 mb-4 rounded shadow-lg transform group-hover:scale-110 transition-transform flex items-center justify-center" style={{ backgroundColor: char.color }}>
                  <div className="w-8 h-8 bg-black/20 rounded-full"></div> 
              </div>
              <span className="font-bold text-xl mb-1">{char.name}</span>
              <p className="text-xs text-zinc-400 text-center mb-4 min-h-[40px]">{char.description}</p>
              
              <div className="w-full bg-zinc-900 rounded p-2 text-xs grid grid-cols-2 gap-2 text-zinc-300">
                 <div>HP: {char.stats.maxHp}</div>
                 <div>이동속도: {char.stats.moveSpeed}</div>
              </div>
            </button>
          ))}
       </div>
       <button onClick={() => setScreen(Screen.MAIN)} className="mt-8 text-zinc-400 underline">뒤로 가기</button>
    </div>
  );

  const renderMapSelect = () => (
    <div className="flex flex-col items-center min-h-screen bg-zinc-900 text-white p-4">
       <h2 className="text-3xl font-bold mb-6 text-blue-400">맵 선택</h2>
       <div className="grid grid-cols-1 gap-4 w-full max-w-2xl">
          {Object.values(MAPS).map((map) => (
            <button
              key={map.id}
              onClick={() => { setSelectedMap(map.id); setGameState(null); setGameOverStats(null); setScreen(Screen.GAME); }}
              className="p-6 bg-zinc-800 border-2 border-zinc-700 hover:border-blue-500 hover:bg-zinc-750 rounded-lg flex items-center transition-all group relative overflow-hidden text-left"
            >
              <div className="w-20 h-20 mr-6 rounded shadow-lg shrink-0 border-2 border-white/20" style={{ background: `linear-gradient(45deg, ${map.themeColors.backgroundA}, ${map.themeColors.backgroundB})` }}>
              </div>
              <div>
                <span className="font-bold text-xl mb-1 block">{map.name}</span>
                <p className="text-sm text-zinc-400 mb-2">{map.description}</p>
                <div className="text-xs font-mono bg-black/40 px-2 py-1 inline-block rounded text-zinc-300">
                    난이도: {map.difficultyMultiplier}x
                </div>
              </div>
            </button>
          ))}
       </div>
       <button onClick={() => setScreen(Screen.CHAR_SELECT)} className="mt-8 text-zinc-400 underline">뒤로 가기</button>
    </div>
  );

  const renderShop = () => (
      <div className="flex flex-col items-center min-h-screen bg-zinc-900 text-white p-4">
        <div className="flex justify-between w-full max-w-2xl items-center mb-6">
            <h2 className="text-3xl font-bold text-yellow-500">강화 상점</h2>
            <div className="bg-black/50 px-4 py-2 rounded-full border border-yellow-700 text-yellow-400 font-bold text-xl">
                🪙 {saveData.coins.toLocaleString()}
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4 w-full max-w-2xl">
            {SHOP_UPGRADES.map(up => {
                const currentLevel = saveData.upgrades[up.id] || 0;
                const cost = Math.floor(up.cost * Math.pow(up.costScaling, currentLevel));
                const isMax = currentLevel >= up.maxLevel;
                const canAfford = saveData.coins >= cost;

                return (
                    <div key={up.id} className="flex items-center justify-between p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
                        <div>
                            <div className="font-bold text-lg text-yellow-100">{up.name} <span className="text-xs text-zinc-500 ml-2">Lv.{currentLevel}/{up.maxLevel}</span></div>
                            <div className="text-sm text-zinc-400">{up.description}</div>
                        </div>
                        <button 
                            disabled={isMax || !canAfford}
                            onClick={() => buyGlobalUpgrade(up)}
                            className={`px-6 py-2 rounded font-bold min-w-[100px] ${
                                isMax ? 'bg-zinc-600 text-zinc-400 cursor-not-allowed' :
                                canAfford ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-[0_2px_0_rgb(146,64,14)] active:translate-y-[2px] active:shadow-none' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                            }`}
                        >
                            {isMax ? 'MAX' : `🪙 ${cost}`}
                        </button>
                    </div>
                )
            })}
        </div>
        <button onClick={() => setScreen(Screen.MAIN)} className="mt-8 px-6 py-2 bg-zinc-700 rounded text-white font-bold">나가기</button>
      </div>
  );

  const renderSettings = () => (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white p-4">
          <h2 className="text-3xl font-bold mb-8">설정</h2>
          <div className="w-full max-w-md space-y-6">
              <div className="flex justify-between items-center bg-zinc-800 p-4 rounded">
                  <span>효과음</span>
                  <button onClick={() => setSoundEnabled(!soundEnabled)} className={`w-12 h-6 rounded-full transition-colors relative ${soundEnabled ? 'bg-green-500' : 'bg-zinc-600'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${soundEnabled ? 'left-7' : 'left-1'}`}></div>
                  </button>
              </div>
              <div className="bg-zinc-800 p-4 rounded">
                  <div className="flex justify-between mb-2">
                      <span>조이스틱 크기</span>
                      <span>{Math.round(joystickScale * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.5" max="1.5" step="0.1" 
                    value={joystickScale} 
                    onChange={(e) => setJoystickScale(parseFloat(e.target.value))}
                    className="w-full accent-red-500"
                  />
              </div>
          </div>
          <button onClick={() => setScreen(Screen.MAIN)} className="mt-8 px-8 py-3 bg-white text-black font-bold rounded">저장 및 나가기</button>
      </div>
  );

  if (screen === Screen.MAIN) return renderMainMenu();
  if (screen === Screen.CHAR_SELECT) return renderCharSelect();
  if (screen === Screen.MAP_SELECT) return renderMapSelect();
  if (screen === Screen.SHOP) return renderShop();
  if (screen === Screen.SETTINGS) return renderSettings();

  return (
    <div 
      className="fixed inset-0 bg-black overflow-hidden touch-none select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT} 
          className="bg-[#111] shadow-2xl image-pixelated"
          style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
        />
      </div>

      {/* HUD Layer */}
      <div className="absolute top-0 left-0 w-full p-2 md:p-4 flex justify-between pointer-events-none z-10">
        <div className="flex flex-col gap-1 w-full max-w-md">
          {/* XP Bar */}
          <div className="w-full h-6 bg-zinc-900 border-2 border-zinc-600 rounded-full relative overflow-hidden shadow-lg">
             <div 
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300" 
                style={{ width: `${gameState ? Math.min(100, (gameState.xp / gameState.xpToNextLevel) * 100) : 0}%` }}
             />
             <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-md">
               LV {gameState?.level}
             </div>
          </div>
          
          <div className="flex gap-4 mt-1">
             <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-yellow-400 font-mono text-sm border border-yellow-900/50">
                <span className="text-lg">💀</span> {gameState?.killCount}
             </div>
             {/* HP Bar */}
             <div className="flex-1 h-6 bg-zinc-900 border border-zinc-700 rounded relative overflow-hidden">
                <div 
                    className="h-full bg-red-600 transition-all duration-200"
                    style={{ width: `${gameState ? Math.max(0, (gameState.hp / gameState.maxHp) * 100) : 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">
                    {gameState ? Math.ceil(gameState.hp) : 0} / {gameState ? gameState.maxHp : 0}
                </span>
             </div>
          </div>
        </div>

        <div className="flex gap-2">
            <div className="text-white font-mono text-2xl font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,1)] bg-black/40 px-3 py-1 rounded h-fit">
            {gameState ? new Date(gameState.time).toISOString().substr(14, 5) : "00:00"}
            </div>
            <button 
                onClick={togglePause}
                className="pointer-events-auto bg-zinc-800/80 w-10 h-10 flex items-center justify-center rounded border border-zinc-600 hover:bg-zinc-700 text-white shadow-lg active:scale-95 transition-transform"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
        </div>
      </div>

      {/* Weapon Slots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none opacity-80">
          {gameState && Object.entries(gameState.weapons).map(([id, lvl]) => {
              const def = WEAPONS[id as WeaponId] || {};
              return (
                  <div key={id} className="w-8 h-8 bg-zinc-900 border border-zinc-600 flex items-center justify-center relative">
                      <div className="text-lg leading-none">{def.icon || '⚔️'}</div>
                      <span className="absolute bottom-0 right-0 bg-black text-[8px] px-1 text-white">{lvl}</span>
                  </div>
              )
          })}
      </div>

      {/* Joystick Visual */}
      {joystickOrigin && (
        <div 
          className="absolute rounded-full border-2 border-white/20 pointer-events-none"
          style={{ 
            width: 100 * joystickScale,
            height: 100 * joystickScale,
            left: joystickOrigin.x - (50 * joystickScale), 
            top: joystickOrigin.y - (50 * joystickScale),
          }}
        >
          <div 
            className="absolute rounded-full bg-white/40 shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            style={{
              width: 50 * joystickScale,
              height: 50 * joystickScale,
              left: (50 * joystickScale) + joystickPos.x,
              top: (50 * joystickScale) + joystickPos.y,
              transform: 'translate(-50%, -50%)'
            }}
          />
        </div>
      )}

      {/* Pause Menu Modal */}
      {isPauseMenuOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200 pointer-events-auto backdrop-blur-sm">
            <div className="bg-zinc-900 border-2 border-zinc-600 p-6 rounded-lg flex flex-col gap-4 w-72 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
                <h2 className="text-3xl font-bold text-center mb-2 text-white italic tracking-wider">PAUSED</h2>
                
                <button 
                    onClick={togglePause} 
                    className="py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow-[0_4px_0_rgb(29,78,216)] active:shadow-none active:translate-y-1 transition-all border border-blue-400"
                >
                    계속하기
                </button>
                
                <div className="h-px bg-zinc-700 my-1"></div>
                
                <button 
                    onClick={() => setSoundEnabled(!soundEnabled)} 
                    className="py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded flex justify-between px-4 border border-zinc-600"
                >
                    <span>소리</span>
                    <span className={soundEnabled ? "text-green-400" : "text-red-400"}>{soundEnabled ? 'ON' : 'OFF'}</span>
                </button>
                
                <button 
                    onClick={quitGame} 
                    className="py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded shadow-[0_4px_0_rgb(127,29,29)] active:shadow-none active:translate-y-1 transition-all border border-red-900 mt-2"
                >
                    포기하고 나가기
                </button>
            </div>
        </div>
      )}

      {/* Evolution Overlay */}
      {evolvedItem && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[60] animate-in fade-in duration-700 pointer-events-none">
            {/* Rotating Light Rays */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <div className="w-[800px] h-[800px] bg-[conic-gradient(from_0deg,transparent_0deg,gold_20deg,transparent_40deg,gold_60deg,transparent_80deg,gold_100deg,transparent_120deg,gold_140deg,transparent_160deg,gold_180deg,transparent_200deg,gold_220deg,transparent_240deg,gold_260deg,transparent_280deg,gold_300deg,transparent_320deg,gold_340deg,transparent_360deg)] animate-[spin_4s_linear_infinite]" />
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-700 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)] tracking-tighter mb-8 scale-150 animate-pulse">
                EVOLUTION!
            </h1>
            
            <div className="relative animate-bounce">
                <div className="w-48 h-48 bg-gradient-to-br from-yellow-700 to-black rounded-xl border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.5)] flex items-center justify-center transform rotate-3">
                     <span className="text-8xl filter drop-shadow-lg">{evolvedItem.icon}</span>
                </div>
                <div className="absolute inset-0 border-4 border-white opacity-50 rounded-xl animate-ping"></div>
            </div>

            <div className="mt-8 text-center z-10">
                <h2 className="text-3xl font-bold text-white mb-2">{evolvedItem.name}</h2>
                <p className="text-yellow-200 text-lg max-w-md">{evolvedItem.description}</p>
            </div>
        </div>
      )}

      {/* Level Up Modal */}
      {showLevelUp && !evolvedItem && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in zoom-in duration-200 p-4 pointer-events-auto">
          <div className="bg-[#1a1a2e] border-2 border-[#ffd700] p-1 rounded-lg max-w-lg w-full shadow-[0_0_50px_rgba(234,179,8,0.2)]">
            <div className="border border-[#ffd700] p-4 rounded h-full flex flex-col">
                <h2 className="text-3xl text-center font-black text-[#ffd700] mb-2 tracking-widest drop-shadow-md">LEVEL UP!</h2>
                <div className="h-0.5 w-full bg-[#ffd700] mb-4 opacity-50"></div>
                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
                {upgradeChoices.map((item, i) => (
                    <button 
                    key={i}
                    onClick={(e) => { e.stopPropagation(); selectUpgrade(item); }}
                    className="flex items-center p-3 bg-[#16213e] hover:bg-[#0f3460] border border-[#0f3460] hover:border-[#ffd700] transition-all rounded group relative overflow-hidden"
                    >
                    <div className="w-14 h-14 rounded bg-[#1a1a2e] flex items-center justify-center mr-4 border border-[#0f3460] group-hover:border-[#ffd700] shrink-0">
                        <div className="text-3xl">{'damage' in item ? (item as any).icon : (item as any).id === 'COIN_BAG' ? '💰' : '✨'}</div>
                    </div>
                    <div className="flex-1 text-left z-10">
                        <div className="flex justify-between items-baseline mb-1">
                            <span className="font-bold text-lg text-[#e94560] group-hover:text-[#ffd700] transition-colors">{item.name}</span>
                            <span className="text-[10px] text-zinc-400 uppercase tracking-wider bg-black/40 px-1 rounded">{'damage' in item ? (item as WeaponDef).type : (item.type || '패시브')}</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-tight">{item.description}</p>
                    </div>
                    </button>
                ))}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameOverStats && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4 animate-in fade-in duration-500 pointer-events-auto">
           <h2 className="text-5xl font-black text-red-600 mb-2 tracking-widest drop-shadow-[0_0_10px_red]">YOU DIED</h2>
           <div className="bg-zinc-800 p-8 rounded border border-zinc-700 w-full max-w-sm mb-8 text-center">
               <div className="text-zinc-400 text-sm mb-1">생존 시간</div>
               <div className="text-3xl font-mono font-bold text-white mb-6">{new Date(gameOverStats.time).toISOString().substr(14, 5)}</div>
               
               <div className="grid grid-cols-2 gap-4 text-left">
                   <div className="bg-zinc-900 p-3 rounded">
                       <div className="text-xs text-zinc-500">처치 수</div>
                       <div className="text-xl text-yellow-500 font-bold">💀 {gameOverStats.killCount}</div>
                   </div>
                   <div className="bg-zinc-900 p-3 rounded">
                       <div className="text-xs text-zinc-500">레벨</div>
                       <div className="text-xl text-blue-500 font-bold">LV {gameOverStats.level}</div>
                   </div>
               </div>
               <div className="mt-4 text-sm text-green-400">
                   획득 골드: +{gameOverStats.killCount} 🪙
               </div>
           </div>
           
           <button 
             onClick={() => setScreen(Screen.MAIN)}
             className="px-10 py-4 bg-white hover:bg-zinc-200 text-black font-black text-xl rounded shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:scale-105 transition-transform"
           >
             메인으로
           </button>
        </div>
      )}
    </div>
  );
}