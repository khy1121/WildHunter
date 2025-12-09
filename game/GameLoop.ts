
import { CANVAS_WIDTH, CANVAS_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, ENEMIES, WEAPONS, PASSIVES } from "../constants";
import { BaseStats, CharacterDef, EnemyDef, GameState, PassiveId, Vector2, WeaponId, WeaponDef, PassiveDef, UserSaveData, UpgradeId, MapDef, MapId } from "../types";

class Entity {
  x: number = 0;
  y: number = 0;
  active: boolean = false;
  radius: number = 10;
  color: string = '#fff';
}

class Enemy extends Entity {
  id: string = 'BAT';
  hp: number = 10;
  maxHp: number = 10;
  damage: number = 5;
  speed: number = 1;
  xpValue: number = 1;
  pushback: Vector2 = { x: 0, y: 0 };
  spriteType: string = 'BAT';
  frame: number = 0;
}

class Projectile extends Entity {
  vx: number = 0;
  vy: number = 0;
  damage: number = 10;
  duration: number = 1000;
  spawnTime: number = 0;
  penetration: number = 1;
  knockback: number = 0;
  weaponId: WeaponId = WeaponId.MAGIC_WAND;
  hitList: number[] = []; 
  rotation: number = 0;
  // Visuals
  rotationSpeed: number = 0;
  followPlayer: boolean = false; // For sword swings attached to player
  startAngle: number = 0; // For arcs
  visualType: string = 'PROJECTILE';
}

class DamageText extends Entity {
  text: string = '';
  life: number = 0;
  vy: number = -1;
  isCrit: boolean = false;
}

class Gem extends Entity {
  value: number = 1;
  type: 'XP' | 'COIN' | 'CHICKEN' = 'XP';
}

export class GameEngine {
  ctx: CanvasRenderingContext2D | null = null;
  animationFrameId: number = 0;
  lastTime: number = 0;

  // Input
  joystickVector: Vector2 = { x: 0, y: 0 };

  // Game State
  state: GameState;
  
  // Camera
  camera: { x: number, y: number } = { x: 0, y: 0 };

  // Entities
  player: { 
    x: number; 
    y: number; 
    facing: number; // 1 or -1
    moveDir: number; // angle in radians (movement)
    aimAngle: number; // angle in radians (attack/looking)
    invulnTimer: number; 
    frame: number;
    attackTimer: number; // > 0 when attacking
    isMoving: boolean;
  } = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, facing: 1, moveDir: 0, aimAngle: 0, invulnTimer: 0, frame: 0, attackTimer: 0, isMoving: false };

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  gems: Gem[] = [];
  damageTexts: DamageText[] = [];

  // Pools
  enemyPool: Enemy[] = [];
  projectilePool: Projectile[] = [];
  gemPool: Gem[] = [];
  textPool: DamageText[] = [];

  // Systems
  weaponTimers: Record<string, number> = {};
  spawnTimer: number = 0;
  baseStats: BaseStats;
  selectedCharacter: CharacterDef;
  selectedMap: MapDef;
  globalUpgrades: UserSaveData;

  // Callbacks
  onLevelUp: (choices: any[]) => void;
  onGameOver: (stats: GameState) => void;
  onUpdateUI: (state: GameState) => void;

  constructor(char: CharacterDef, map: MapDef, savedData: UserSaveData, onLevelUp: any, onGameOver: any, onUpdateUI: any) {
    this.selectedCharacter = char;
    this.selectedMap = map;
    this.globalUpgrades = savedData;
    this.onLevelUp = onLevelUp;
    this.onGameOver = onGameOver;
    this.onUpdateUI = onUpdateUI;
    
    // Calculate Stats
    this.baseStats = { ...char.stats };
    this.applyGlobalUpgrades();

    this.state = {
      level: 1,
      xp: 0,
      xpToNextLevel: 10,
      time: 0,
      killCount: 0,
      totalCoins: savedData.coins,
      isPaused: false,
      isGameOver: false,
      hp: this.baseStats.maxHp,
      maxHp: this.baseStats.maxHp,
      weapons: { [char.startingWeapon]: 1 },
      passives: {},
    };

    // Pre-populate pools
    for(let i=0; i<400; i++) this.enemyPool.push(new Enemy());
    for(let i=0; i<200; i++) this.projectilePool.push(new Projectile());
    for(let i=0; i<300; i++) this.gemPool.push(new Gem());
    for(let i=0; i<100; i++) this.textPool.push(new DamageText());
    
    // Initial Camera
    this.updateCamera();
  }

  private applyGlobalUpgrades() {
    if (this.globalUpgrades.upgrades[UpgradeId.MIGHT]) this.baseStats.might += (this.globalUpgrades.upgrades[UpgradeId.MIGHT] * 0.05);
    if (this.globalUpgrades.upgrades[UpgradeId.ARMOR]) this.baseStats.maxHp += (this.globalUpgrades.upgrades[UpgradeId.ARMOR] * 10);
  }

  start(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    this.ctx!.imageSmoothingEnabled = false; 
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    cancelAnimationFrame(this.animationFrameId);
  }

  setJoystick(x: number, y: number) {
    this.joystickVector = { x, y };
  }

  // --- Logic ---

  private loop = (time: number) => {
    const dt = time - this.lastTime;
    this.lastTime = time;

    if (!this.state.isPaused && !this.state.isGameOver) {
      this.update(dt);
    }
    
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.state.time += dt;
    this.spawnTimer += dt;
    
    // Difficulty
    const minutes = this.state.time / 60000;
    const spawnRate = Math.max(100, 1500 - (minutes * 150)) / this.selectedMap.difficultyMultiplier; 
    const maxEnemies = Math.min(400, (50 + (minutes * 50)) * this.selectedMap.difficultyMultiplier);

    if (this.spawnTimer > spawnRate && this.enemies.length < maxEnemies) {
      this.spawnEnemy();
      this.spawnTimer = 0;
    }

    // Player Movement
    const speed = this.baseStats.moveSpeed;
    this.player.isMoving = false;
    
    // 1. Handle Movement
    if (Math.abs(this.joystickVector.x) > 0.1 || Math.abs(this.joystickVector.y) > 0.1) {
      this.player.isMoving = true;
      this.player.x += this.joystickVector.x * speed;
      this.player.y += this.joystickVector.y * speed;
      this.player.frame += dt * 0.015; // Faster animation
      
      this.player.moveDir = Math.atan2(this.joystickVector.y, this.joystickVector.x);
      
      // Update facing (Flip L/R) for Body Sprite
      if (Math.abs(this.joystickVector.x) > 0.1) {
         this.player.facing = this.joystickVector.x > 0 ? 1 : -1;
      }
    } else {
        // Reset frame to idle loop
        this.player.frame = 0;
    }

    // 2. Handle Aiming (Aim Angle)
    // Priority: Joystick (if moving) > Nearest Enemy (Auto-aim) > Previous Aim
    if (this.player.isMoving) {
        this.player.aimAngle = this.player.moveDir;
    } else {
        // Auto-aim nearest enemy if standing still
        let closestDist = 400; // Auto-aim range
        let closestTarget: Enemy | null = null;
        for (const e of this.enemies) {
            if (!e.active) continue;
            const d = Math.sqrt((e.x - this.player.x)**2 + (e.y - this.player.y)**2);
            if (d < closestDist) {
                closestDist = d;
                closestTarget = e;
            }
        }
        if (closestTarget) {
            this.player.aimAngle = Math.atan2(closestTarget.y - this.player.y, closestTarget.x - this.player.x);
        }
    }
    
    if (this.player.attackTimer > 0) this.player.attackTimer -= dt;

    // Clamp Player to World
    this.player.x = Math.max(20, Math.min(WORLD_WIDTH - 20, this.player.x));
    this.player.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, this.player.y));

    // Update Camera
    this.updateCamera();

    // Weapons
    this.handleWeapons(dt);

    // Entities
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateGems(dt);
    this.updateFloatingText(dt);

    // UI Sync
    if (Math.random() < 0.2) this.onUpdateUI({ ...this.state });
  }

  private updateCamera() {
    // Center the camera on the player
    this.camera.x = this.player.x - CANVAS_WIDTH / 2;
    this.camera.y = this.player.y - CANVAS_HEIGHT / 2;

    // Clamp camera to world bounds
    this.camera.x = Math.max(0, Math.min(this.camera.x, WORLD_WIDTH - CANVAS_WIDTH));
    this.camera.y = Math.max(0, Math.min(this.camera.y, WORLD_HEIGHT - CANVAS_HEIGHT));
  }

  private spawnEnemy() {
    const enemy = this.enemyPool.pop() || new Enemy();
    
    let typeIdx = 0;
    const minutes = this.state.time / 60000;
    if (minutes > 8) typeIdx = 3; 
    else if (minutes > 4) typeIdx = 2; 
    else if (minutes > 1) typeIdx = 1; 
    else typeIdx = 0; 

    if (Math.random() < 0.1 && typeIdx < ENEMIES.length - 1) typeIdx++;

    const type = ENEMIES[typeIdx];
    const angle = Math.random() * Math.PI * 2;
    // Spawn just outside the view (Canvas Width / 2 + Buffer)
    const radius = (Math.sqrt(CANVAS_WIDTH**2 + CANVAS_HEIGHT**2) / 2) + 100;
    
    // Spawn relative to player
    enemy.x = this.player.x + Math.cos(angle) * radius; 
    enemy.y = this.player.y + Math.sin(angle) * radius; 

    // Ensure inside world
    enemy.x = Math.max(0, Math.min(WORLD_WIDTH, enemy.x));
    enemy.y = Math.max(0, Math.min(WORLD_HEIGHT, enemy.y));

    enemy.id = type.id;
    enemy.hp = type.hp * (1 + minutes * 0.5) * this.selectedMap.difficultyMultiplier; 
    enemy.maxHp = enemy.hp;
    enemy.damage = type.damage * (1 + (this.selectedMap.difficultyMultiplier - 1) * 0.5);
    enemy.speed = type.speed * (1 + (this.selectedMap.difficultyMultiplier - 1) * 0.2);
    enemy.xpValue = type.xpValue;
    enemy.color = type.color;
    enemy.radius = type.radius;
    enemy.spriteType = type.spriteType;
    enemy.active = true;
    enemy.pushback = {x:0, y:0};
    enemy.frame = Math.random() * 10;
    
    this.enemies.push(enemy);
  }

  private updateEnemies(dt: number) {
    const playerRadius = 15;
    
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;

      e.frame += dt * 0.005;

      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      // Despawn if too far (Optimization)
      if (dist > 1000) {
        e.active = false;
        this.enemyPool.push(e);
        this.enemies.splice(i, 1);
        continue;
      }

      if (dist > 0) {
        e.x += (dx / dist) * e.speed * (dt / 16);
        e.y += (dy / dist) * e.speed * (dt / 16);
      }

      // Simple Repel
      for (let j = i + 1; j < Math.min(i + 5, this.enemies.length); j++) {
        const other = this.enemies[j];
        if (!other.active) continue;
        const ddx = e.x - other.x;
        const ddy = e.y - other.y;
        if (Math.abs(ddx) + Math.abs(ddy) < 20) { 
            const ddist = Math.sqrt(ddx*ddx + ddy*ddy);
            const minDst = e.radius + other.radius - 5; 
            if (ddist < minDst && ddist > 0) {
                const force = (minDst - ddist) * 0.1;
                e.x += (ddx/ddist) * force;
                e.y += (ddy/ddist) * force;
            }
        }
      }

      if (Math.abs(e.pushback.x) > 0.1 || Math.abs(e.pushback.y) > 0.1) {
        e.x += e.pushback.x;
        e.y += e.pushback.y;
        e.pushback.x *= 0.85;
        e.pushback.y *= 0.85;
      }

      if (dist < playerRadius + e.radius) {
        this.hitPlayer(e.damage);
      }
    }
  }

  private hitPlayer(dmg: number) {
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer -= 16;
      return;
    }
    this.state.hp -= dmg;
    this.player.invulnTimer = 300; 
    this.spawnText(Math.round(dmg), this.player.x, this.player.y - 20, '#ff0000');
    
    if (this.state.hp <= 0) {
      this.state.isGameOver = true;
      this.onGameOver(this.state);
    }
  }

  private handleWeapons(dt: number) {
    Object.entries(this.state.weapons).forEach(([wId, level]) => {
      if (!this.weaponTimers[wId]) this.weaponTimers[wId] = 0;
      this.weaponTimers[wId] -= dt;

      if (this.weaponTimers[wId] <= 0) {
        const weaponDef = WEAPONS[wId as WeaponId];
        let cd = weaponDef.cooldown * (1 - (this.baseStats.cooldown * 0.1));
        if (cd < 50) cd = 50; 
        this.weaponTimers[wId] = cd;
        this.fireWeapon(wId as WeaponId, weaponDef);
      }
    });
  }

  private fireWeapon(id: WeaponId, def: any) { 
    const amount = def.amount + this.baseStats.amount;
    
    // Trigger Player Attack Animation
    this.player.attackTimer = 300; 

    // Base aim direction from Player's current Aim Angle
    const baseAimX = Math.cos(this.player.aimAngle);
    const baseAimY = Math.sin(this.player.aimAngle);

    if (id === WeaponId.WHIP || id === WeaponId.BLOODY_TEAR) { // Great Sword logic
       // Fire primarily in aim direction
       this.spawnProjectile(id, def, {x: baseAimX, y: baseAimY});
       
       // If multi-shot, fire backwards too (Double-edged sword style)
       if (amount > 1) {
           setTimeout(() => this.spawnProjectile(id, def, {x: -baseAimX, y: -baseAimY}), 200);
       }
    } 
    else if (id === WeaponId.GARLIC) {
       const existing = this.projectiles.find(p => p.active && p.weaponId === WeaponId.GARLIC);
       if (!existing) {
         const p = this.spawnProjectile(id, def, {x:0, y:0});
         p.duration = 99999999;
         p.followPlayer = true;
       }
    } 
    else {
       // Projectiles
       for (let i = 0; i < amount; i++) {
          setTimeout(() => {
             const p = this.spawnProjectile(id, def, {x:0, y:0});
             
             if (def.visualType === 'SPIN' || def.visualType === 'PROJECTILE') {
                 // Spread
                 const spread = (i - (amount-1)/2) * 0.2; 
                 // Rotate aim vector by spread
                 const cos = Math.cos(spread);
                 const sin = Math.sin(spread);
                 const rx = baseAimX * cos - baseAimY * sin;
                 const ry = baseAimX * sin + baseAimY * cos;
                 
                 p.vx = rx * def.speed;
                 p.vy = ry * def.speed;
                 p.rotation = Math.atan2(p.vy, p.vx);
             } 
             else if (id === WeaponId.HOLY_WATER) {
                 const r = Math.random() * 100 + 50;
                 const theta = Math.random() * Math.PI * 2;
                 p.x = this.player.x + Math.cos(theta) * r;
                 p.y = this.player.y + Math.sin(theta) * r;
                 p.vx = 0; p.vy = 0;
             }
          }, i * (def.cooldown > 200 ? 50 : 20)); 
       }
    }
  }

  private spawnProjectile(wId: WeaponId, def: any, offsetDir: Vector2): Projectile {
    const p = this.projectilePool.pop() || new Projectile();
    p.active = true;
    p.weaponId = wId;
    p.damage = def.damage * this.baseStats.might;
    p.duration = def.duration * (this.state.passives[PassiveId.SPELLBINDER] ? 1.1 : 1);
    p.spawnTime = this.state.time;
    p.penetration = def.pierce;
    p.knockback = def.knockback;
    p.radius = (def.area > 10 ? def.area : 5) * this.baseStats.area;
    p.color = def.color;
    p.hitList = [];
    p.rotation = 0;
    p.visualType = def.visualType || 'PROJECTILE';
    p.followPlayer = false;
    p.rotationSpeed = 0;

    if (p.visualType === 'SPIN') p.rotationSpeed = 0.3;

    if (def.visualType === 'SLASH') {
        p.followPlayer = true;
        // Calculate exact rotation based on the input vector
        // If the vector is {0,0}, use aim angle as default
        if (offsetDir.x !== 0 || offsetDir.y !== 0) {
             p.rotation = Math.atan2(offsetDir.y, offsetDir.x);
        } else {
             p.rotation = this.player.aimAngle;
        }
    }
    
    // Initial pos
    p.x = this.player.x;
    p.y = this.player.y;

    if (wId === WeaponId.GARLIC) {
        p.followPlayer = true;
    }
    
    this.projectiles.push(p);
    return p;
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.active) continue;

      if (this.state.time - p.spawnTime > p.duration) {
        this.recycleProjectile(p, i);
        continue;
      }

      if (p.followPlayer) {
          p.x = this.player.x;
          p.y = this.player.y;
          // SLASH types rotate based on their init rotation, so we don't need to update it continuously unless we want it to stick to aim
      } else {
          // Standard physics
          p.x += p.vx;
          p.y += p.vy;
          
          if (p.weaponId === WeaponId.AXE) {
             p.vy += 0.2; // Gravity
          }
      }

      p.rotation += p.rotationSpeed;

      // Hit Detection
      for (const e of this.enemies) {
        if (!e.active) continue;
        // Optimization: Dist check first
        if (Math.abs(e.x - p.x) > p.radius + e.radius + 20) continue;

        const distSq = (e.x - p.x)**2 + (e.y - p.y)**2;
        const radSum = (p.radius + e.radius);
        
        if (distSq < radSum**2) {
          // Garlic/Zone special tick
          if (p.visualType === 'AURA' || p.visualType === 'ZONE' || p.visualType === 'SLASH') {
             const tick = Math.floor(this.state.time / (p.visualType === 'SLASH' ? 500 : 300));
             if ((e as any)[`lastHit_${p.weaponId}`] !== tick) {
                 (e as any)[`lastHit_${p.weaponId}`] = tick;
                 this.damageEnemy(e, p.damage, p.knockback);
             }
          } 
          else if (!p.hitList.includes((e as any).__uniqueId || 0)) { 
             if (!(e as any).__uniqueId) (e as any).__uniqueId = Math.random();
             
             this.damageEnemy(e, p.damage, p.knockback);
             p.hitList.push((e as any).__uniqueId);

             if (p.penetration !== -1) {
               p.penetration--;
               if (p.penetration <= 0) {
                 this.recycleProjectile(p, i);
                 break; 
               }
             }
          }
        }
      }
    }
  }

  private recycleProjectile(p: Projectile, index: number) {
    p.active = false;
    this.projectiles.splice(index, 1);
    this.projectilePool.push(p);
  }

  private damageEnemy(e: Enemy, dmg: number, knockback: number) {
    let finalDmg = dmg;
    let isCrit = false;
    if (this.baseStats.luck && Math.random() < this.baseStats.luck * 0.1) {
        finalDmg *= 2;
        isCrit = true;
    }

    e.hp -= finalDmg;
    this.spawnText(Math.round(finalDmg), e.x, e.y - 15, isCrit ? '#ffff00' : '#fff', isCrit);
    
    if (knockback > 0) {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const mag = Math.sqrt(dx*dx + dy*dy);
      if (mag > 0) {
        e.pushback.x = (dx/mag) * knockback;
        e.pushback.y = (dy/mag) * knockback;
      }
    }

    if (e.hp <= 0) {
      this.killEnemy(e);
    }
  }

  private killEnemy(e: Enemy) {
    e.active = false;
    this.state.killCount++;
    this.state.totalCoins += 1;
    this.spawnGem(e.x, e.y, e.xpValue);
    
    const idx = this.enemies.indexOf(e);
    if (idx > -1) {
      this.enemies.splice(idx, 1);
      this.enemyPool.push(e);
    }
  }

  private spawnGem(x: number, y: number, value: number) {
    const g = this.gemPool.pop() || new Gem();
    g.x = x;
    g.y = y;
    g.value = value;
    g.active = true;
    g.type = 'XP';
    if (Math.random() < 0.01) g.type = 'CHICKEN';
    else if (Math.random() < 0.05) { g.type = 'COIN'; g.value = 10; }
    this.gems.push(g);
  }

  private updateGems(dt: number) {
    const magnetRange = this.baseStats.magnet + (this.baseStats.area * 30); 
    
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dx = this.player.x - g.x;
      const dy = this.player.y - g.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < magnetRange) {
        g.x += (dx/dist) * 10;
        g.y += (dy/dist) * 10;
        if (dist < 15) this.collectGem(g, i);
      }
    }
  }

  private collectGem(g: Gem, index: number) {
    if (g.type === 'XP') this.state.xp += g.value;
    else if (g.type === 'COIN') { this.state.killCount += g.value; this.state.totalCoins += g.value; }
    else if (g.type === 'CHICKEN') { this.state.hp = Math.min(this.state.maxHp, this.state.hp + 30); this.spawnText(30, this.player.x, this.player.y, '#00ff00'); }

    g.active = false;
    this.gems.splice(index, 1);
    this.gemPool.push(g);

    if (this.state.xp >= this.state.xpToNextLevel) {
      this.levelUp();
    }
  }

  private levelUp() {
    this.state.level++;
    this.state.xp -= this.state.xpToNextLevel;
    this.state.xpToNextLevel = Math.floor(this.state.xpToNextLevel * 1.2) + 5;
    this.state.isPaused = true;
    this.onLevelUp(this.generateUpgradeChoices());
  }

  public applyUpgrade(item: WeaponDef | PassiveDef) {
    const isWeapon = 'damage' in item;
    if (isWeapon) {
        const currentLvl = this.state.weapons[item.id] || 0;
        this.state.weapons[item.id] = currentLvl + 1;
        const def = item as WeaponDef;
        if (def.color === '#be123c' || def.color === '#1d4ed8' || def.color === '#a16207' || def.color === '#475569') { 
             if (item.id === WeaponId.BLOODY_TEAR) delete this.state.weapons[WeaponId.WHIP];
             if (item.id === WeaponId.HOLY_WAND) delete this.state.weapons[WeaponId.MAGIC_WAND];
             if (item.id === WeaponId.DEATH_SPIRAL) delete this.state.weapons[WeaponId.AXE];
             if (item.id === WeaponId.THOUSAND_EDGE) delete this.state.weapons[WeaponId.KNIFE];
        }
    } else {
        const currentLvl = this.state.passives[item.id] || 0;
        this.state.passives[item.id] = currentLvl + 1;
        const pDef = item as PassiveDef;
        if(pDef.statModifier.might) this.baseStats.might += pDef.statModifier.might;
        if(pDef.statModifier.area) this.baseStats.area += pDef.statModifier.area;
        if(pDef.statModifier.cooldown) this.baseStats.cooldown += pDef.statModifier.cooldown;
        if(pDef.statModifier.maxHp) {
            this.baseStats.maxHp += pDef.statModifier.maxHp;
            this.state.hp += pDef.statModifier.maxHp;
        }
        if(pDef.statModifier.amount) this.baseStats.amount += pDef.statModifier.amount;
    }
    this.state.isPaused = false;
  }

  private generateUpgradeChoices() {
    const potential: (WeaponDef | PassiveDef)[] = [];
    const ownedWeapons = Object.keys(this.state.weapons);
    
    // Evolutions
    for (const wId of ownedWeapons) {
        const level = this.state.weapons[wId];
        const def = WEAPONS[wId as WeaponId];
        if (level >= 8 && def.evolvesTo && def.requiresPassive && this.state.passives[def.requiresPassive]) {
            potential.push(WEAPONS[def.evolvesTo]);
        }
    }
    // Upgrades & New
    if (potential.length < 3) {
        for (const wId of ownedWeapons) {
            if (this.state.weapons[wId] < 8 && !WEAPONS[wId as WeaponId].evolvesTo?.includes('EVO')) potential.push(WEAPONS[wId as WeaponId]);
        }
        if (ownedWeapons.length < 6) {
            Object.values(WEAPONS).forEach(w => {
                if (!this.state.weapons[w.id] && w.type !== '근접' /*Don't filter melee if we evolved*/ && !w.evolvesTo?.includes('EVO') && w.id !== WeaponId.BLOODY_TEAR && w.id !== WeaponId.DEATH_SPIRAL) {
                   potential.push(w);
                }
            });
        }
        Object.keys(this.state.passives).forEach(pId => {
            if (this.state.passives[pId] < 5) potential.push(PASSIVES[pId as PassiveId]);
        });
        if (Object.keys(this.state.passives).length < 6) {
            Object.values(PASSIVES).forEach(p => { if (!this.state.passives[p.id]) potential.push(p); });
        }
    }

    const shuffled = potential.sort(() => 0.5 - Math.random());
    const unique: any[] = [];
    const seen = new Set();
    for (const item of shuffled) {
        if (!seen.has(item.id)) { seen.add(item.id); unique.push(item); }
        if (unique.length >= 3) break;
    }
    if (unique.length === 0) unique.push({ id: 'COIN_BAG', name: '금화 주머니', description: '골드 50 획득', type: 'ITEM' });
    return unique;
  }

  private spawnText(val: number, x: number, y: number, color: string = '#fff', isCrit: boolean = false) {
    const t = this.textPool.pop() || new DamageText();
    t.text = val.toString();
    t.x = x + (Math.random() * 20 - 10);
    t.y = y;
    t.life = 1.0;
    t.active = true;
    t.vy = -1;
    t.color = color;
    t.isCrit = isCrit;
    this.damageTexts.push(t);
  }

  private updateFloatingText(dt: number) {
     for (let i = this.damageTexts.length - 1; i >= 0; i--) {
         const t = this.damageTexts[i];
         t.life -= dt / 800;
         t.y += t.vy * (dt / 16);
         if (t.life <= 0) {
             t.active = false;
             this.damageTexts.splice(i, 1);
             this.textPool.push(t);
         }
     }
  }

  // --- Rendering ---
  private draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // 1. Tiled Background
    const tileSize = 100;
    
    // We draw slightly larger than screen to prevent popping
    const startX = Math.floor(this.camera.x / tileSize) * tileSize;
    const startY = Math.floor(this.camera.y / tileSize) * tileSize;
    
    // Fill the whole background with base color first
    ctx.fillStyle = this.selectedMap.themeColors.backgroundA;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Apply Camera translation for the rest
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    // Render Checkerboard Tiles
    for (let x = startX; x < this.camera.x + CANVAS_WIDTH + tileSize; x += tileSize) {
        for (let y = startY; y < this.camera.y + CANVAS_HEIGHT + tileSize; y += tileSize) {
            // Determine tile index
            const xIndex = Math.floor(x / tileSize);
            const yIndex = Math.floor(y / tileSize);
            
            // Checkerboard logic
            const isAlt = (xIndex + yIndex) % 2 !== 0;
            ctx.fillStyle = isAlt ? this.selectedMap.themeColors.backgroundB : this.selectedMap.themeColors.backgroundA;
            ctx.fillRect(x, y, tileSize, tileSize);

            // Add details randomly based on deterministic seed from coords
            const seed = Math.sin(xIndex * 12.9898 + yIndex * 78.233) * 43758.5453;
            const rand = seed - Math.floor(seed);
            
            // Render Map Specific Details
            if (rand > 0.7) {
                ctx.fillStyle = this.selectedMap.themeColors.detail;
                
                if (this.selectedMap.id === MapId.OCEAN) {
                   // OCEAN: Bubbles and Waves
                   if (rand > 0.9) {
                       // Bubbles
                       ctx.strokeStyle = '#38bdf8';
                       ctx.lineWidth = 1;
                       ctx.beginPath(); ctx.arc(x + tileSize/2, y + tileSize/2, 4, 0, Math.PI*2); ctx.stroke();
                       ctx.beginPath(); ctx.arc(x + tileSize/2 + 6, y + tileSize/2 - 6, 2, 0, Math.PI*2); ctx.stroke();
                   } else {
                       // Wave pattern
                       ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                       ctx.lineWidth = 2;
                       ctx.beginPath();
                       ctx.moveTo(x + 10, y + 50);
                       ctx.bezierCurveTo(x + 30, y + 40, x + 70, y + 60, x + 90, y + 50);
                       ctx.stroke();
                   }
                } else if (this.selectedMap.id === MapId.PALACE) {
                   // PALACE: Ornate Floor
                   if (rand > 0.85) {
                       // Gold Diamond Center
                       ctx.fillStyle = '#fbbf24';
                       ctx.beginPath();
                       ctx.moveTo(x + tileSize/2, y + tileSize/4);
                       ctx.lineTo(x + tileSize*0.75, y + tileSize/2);
                       ctx.lineTo(x + tileSize/2, y + tileSize*0.75);
                       ctx.lineTo(x + tileSize/4, y + tileSize/2);
                       ctx.fill();
                   } else {
                       // Corner accents
                       ctx.fillStyle = '#b91c1c'; // Deep red accent
                       ctx.fillRect(x + 5, y + 5, 10, 10);
                       ctx.fillRect(x + tileSize - 15, y + 5, 10, 10);
                       ctx.fillRect(x + 5, y + tileSize - 15, 10, 10);
                       ctx.fillRect(x + tileSize - 15, y + tileSize - 15, 10, 10);
                   }
                } else {
                   // GARDEN: Flowers and Grass
                   if (rand > 0.9) {
                       // Flower
                       const petalColor = (rand > 0.95) ? '#f472b6' : '#facc15';
                       ctx.fillStyle = petalColor;
                       for(let k=0; k<5; k++) {
                           const theta = (k/5) * Math.PI*2;
                           ctx.beginPath(); 
                           ctx.arc(x + tileSize/2 + Math.cos(theta)*5, y + tileSize/2 + Math.sin(theta)*5, 3, 0, Math.PI*2); 
                           ctx.fill();
                       }
                       ctx.fillStyle = '#fff';
                       ctx.beginPath(); ctx.arc(x + tileSize/2, y + tileSize/2, 2, 0, Math.PI*2); ctx.fill();
                   } else {
                       // Grass tuft
                       ctx.strokeStyle = '#14532d'; // Darker green
                       ctx.lineWidth = 2;
                       ctx.beginPath();
                       ctx.moveTo(x + tileSize/2, y + tileSize/2);
                       ctx.lineTo(x + tileSize/2 - 5, y + tileSize/2 - 8);
                       ctx.moveTo(x + tileSize/2, y + tileSize/2);
                       ctx.lineTo(x + tileSize/2 + 5, y + tileSize/2 - 8);
                       ctx.stroke();
                   }
                }
            }
        }
    }

    // Gems
    for (const g of this.gems) {
        // Optimization: Cull gems outside view
        if (g.x < this.camera.x - 20 || g.x > this.camera.x + CANVAS_WIDTH + 20 ||
            g.y < this.camera.y - 20 || g.y > this.camera.y + CANVAS_HEIGHT + 20) continue;

        ctx.fillStyle = g.type === 'XP' ? '#3b82f6' : (g.type === 'COIN' ? '#eab308' : '#ef4444');
        ctx.beginPath();
        const s = 4;
        ctx.moveTo(g.x, g.y - s); ctx.lineTo(g.x + s, g.y); ctx.lineTo(g.x, g.y + s); ctx.lineTo(g.x - s, g.y);
        ctx.fill();
    }

    // Projectiles
    this.drawProjectiles(ctx);

    // Enemies
    for (const e of this.enemies) {
        if (!e.active) continue;
        // Optimization: Cull
        if (e.x < this.camera.x - 50 || e.x > this.camera.x + CANVAS_WIDTH + 50 ||
            e.y < this.camera.y - 50 || e.y > this.camera.y + CANVAS_HEIGHT + 50) continue;
            
        this.drawSprite(ctx, e.x, e.y, e.color, e.spriteType, e.frame, e.x < this.player.x ? 1 : -1, e.radius, false, 0);
    }

    // Player
    this.drawSprite(ctx, this.player.x, this.player.y, this.selectedCharacter.color, this.selectedCharacter.skinType, this.player.frame, this.player.facing, 15, this.player.attackTimer > 0, this.player.aimAngle);

    // Text (World Space)
    ctx.textAlign = 'center';
    for (const t of this.damageTexts) {
        ctx.font = t.isCrit ? 'bold 20px Arial' : '12px Arial';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(t.text, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
    }

    // --- CAMERA TRANSFORM END ---
    ctx.restore();
    
    // Borders indicating world edge
    if (this.camera.x <= 0) { ctx.fillStyle='rgba(255,0,0,0.1)'; ctx.fillRect(0,0,10,CANVAS_HEIGHT); }
    if (this.camera.x >= WORLD_WIDTH - CANVAS_WIDTH) { ctx.fillStyle='rgba(255,0,0,0.1)'; ctx.fillRect(CANVAS_WIDTH-10,0,10,CANVAS_HEIGHT); }
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D) {
      for (const p of this.projectiles) {
        // Optimization: Cull
        if (p.x < this.camera.x - p.radius - 100 || p.x > this.camera.x + CANVAS_WIDTH + 100 ||
            p.y < this.camera.y - p.radius - 100 || p.y > this.camera.y + CANVAS_HEIGHT + 100) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        ctx.fillStyle = p.color;

        if (p.visualType === 'SLASH') {
             const progress = (this.state.time - p.spawnTime) / p.duration;
             // Cubic ease-out for a "snappy" feel
             const ease = 1 - Math.pow(1 - progress, 3); 
             
             // Expand quickly, then fade
             const currentRadius = p.radius * (0.5 + 0.6 * ease);
             
             // Opacity: Solid start, fade out end
             ctx.globalAlpha = Math.max(0, 1.0 - Math.pow(progress, 2));

             // Dynamic Gradient
             const gradient = ctx.createRadialGradient(0, 0, currentRadius * 0.4, 0, 0, currentRadius * 1.1);
             gradient.addColorStop(0.5, `rgba(0,0,0,0)`); // Clear center
             gradient.addColorStop(0.7, p.color);
             gradient.addColorStop(0.95, '#ffffff'); // Shiny edge
             gradient.addColorStop(1, `rgba(255,255,255,0)`); // Soft fade out
             
             ctx.fillStyle = gradient;
             
             // Draw Crescent Arc
             const angleWidth = Math.PI / 1.5; 
             const startAngle = -angleWidth / 2;
             const endAngle = angleWidth / 2;

             ctx.beginPath();
             ctx.arc(0, 0, currentRadius, startAngle, endAngle);
             ctx.bezierCurveTo(
                 currentRadius * 0.6, endAngle * 0.3,
                 currentRadius * 0.6, startAngle * 0.3,
                 Math.cos(startAngle) * currentRadius, Math.sin(startAngle) * currentRadius
             );
             ctx.fill();

             // Core Slash Line
             ctx.strokeStyle = '#fff';
             ctx.lineWidth = 3 * (1 - progress);
             ctx.beginPath();
             ctx.arc(0, 0, currentRadius * 0.9, startAngle + 0.2, endAngle - 0.2);
             ctx.stroke();

             // PARTICLES
             const particleCount = 15;
             ctx.fillStyle = p.color;
             
             for(let i=0; i<particleCount; i++) {
                 const seed = (p.spawnTime + i * 1357) % 1000;
                 const rand = seed / 1000;
                 const pAngle = startAngle + (angleWidth * rand);
                 const pDist = currentRadius * (0.8 + 0.4 * rand) + (progress * 20 * rand);
                 const pSize = (4 * (1 - progress)) * (0.5 + rand * 0.5);
                 
                 ctx.globalAlpha = Math.max(0, 1 - progress - (rand * 0.2));
                 ctx.beginPath();
                 ctx.arc(Math.cos(pAngle) * pDist, Math.sin(pAngle) * pDist, pSize, 0, Math.PI*2);
                 ctx.fill();
             }
        } 
        else if (p.visualType === 'SPIN') {
             // Shuriken / Axe
             if (p.weaponId === WeaponId.AXE || p.weaponId === WeaponId.DEATH_SPIRAL) {
                ctx.fillRect(-6, -6, 12, 12);
             } else {
                // Shuriken 4-point star
                ctx.beginPath();
                for(let i=0; i<4; i++) {
                    ctx.rotate(Math.PI/2);
                    ctx.moveTo(0,0);
                    ctx.lineTo(5, -12);
                    ctx.lineTo(-5, -12);
                }
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill();
             }
        }
        else if (p.visualType === 'PROJECTILE') {
             if (p.weaponId.includes('WAND')) {
                 // Magic Ball with trail
                 ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.fill();
                 ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-2, -2, 2, 0, Math.PI*2); ctx.fill();
                 // Simple trail
                 ctx.globalAlpha = 0.3;
                 ctx.fillStyle = p.color;
                 ctx.fillRect(-15, -2, 10, 4);
                 ctx.fillRect(-25, -1, 8, 2);
             } else {
                 // Generic Daggers
                 ctx.fillRect(-10, -2, 20, 4);
                 ctx.fillRect(5, -4, 4, 8); // Handle
             }
        }
        else if (p.visualType === 'AURA') {
             ctx.globalAlpha = 0.2;
             ctx.fillStyle = '#fb7185';
             ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
             ctx.strokeStyle = '#fb7185'; ctx.lineWidth = 2; ctx.stroke();
        }
        else if (p.visualType === 'ZONE') {
             ctx.globalAlpha = 0.5;
             ctx.fillStyle = '#0ea5e9';
             ctx.beginPath(); ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2); ctx.fill();
             ctx.fillStyle = '#fff';
             ctx.fillRect(-2, -15, 4, 15); // Vial shape roughly
        }

        ctx.restore();
    }
  }

  private drawSprite(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, type: string, frame: number, facing: number, radius: number, isAttacking: boolean = false, aimAngle: number = 0) {
      ctx.save();
      ctx.translate(x, y);
      
      const bounce = Math.abs(Math.sin(frame)) * 3;
      const walkCycle = Math.sin(frame * 2); 
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 5, radius * 0.8, radius * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- Body (Scaled) ---
      // We scale just the body part so legs/head flip naturally
      ctx.save();
      ctx.scale(facing, 1);
      
      // Legs (Walking)
      if (type !== 'BAT' && type !== 'GHOST' && type !== 'BOSS') {
          ctx.fillStyle = '#1f2937'; // Dark pants
          // Left Leg
          ctx.save();
          ctx.translate(-4, -5);
          ctx.rotate(walkCycle * 0.5);
          ctx.fillRect(-2, 0, 4, 8);
          ctx.restore();
          // Right Leg
          ctx.save();
          ctx.translate(4, -5);
          ctx.rotate(-walkCycle * 0.5);
          ctx.fillRect(-2, 0, 4, 8);
          ctx.restore();
      }

      // Main Body
      ctx.fillStyle = color;

      if (type === 'KNIGHT' || type === 'WARRIOR') {
          // Armor Body
          ctx.fillRect(-6, -18 - bounce, 12, 14);
          // Belt
          ctx.fillStyle = '#4b5563';
          ctx.fillRect(-6, -8 - bounce, 12, 3);
          // Head (Helmet)
          ctx.fillStyle = '#e5e7eb'; 
          ctx.fillRect(-7, -29 - bounce, 14, 12);
          // Visor
          ctx.fillStyle = '#111';
          ctx.fillRect(2, -25 - bounce, 4, 2);
      } 
      else if (type === 'WIZARD' || type === 'MAGE') {
          // Robe
          ctx.beginPath();
          ctx.moveTo(0, -32 - bounce);
          ctx.lineTo(8, -5);
          ctx.lineTo(-8, -5);
          ctx.fill();
          // Hat
          ctx.fillStyle = '#4c1d95';
          ctx.beginPath();
          ctx.moveTo(-10, -30 - bounce);
          ctx.lineTo(10, -30 - bounce);
          ctx.lineTo(0, -45 - bounce);
          ctx.fill();
      }
      else if (type === 'ROGUE' || type === 'RANGER') {
          // Hood/Cloak
          ctx.fillStyle = '#166534';
          ctx.fillRect(-6, -22 - bounce, 12, 12);
          ctx.fillRect(-6, -10 - bounce, 12, 10); // Tunic
          // Face in shadow
          ctx.fillStyle = '#000';
          ctx.fillRect(-3, -20 - bounce, 6, 4);
          // Eyes
          ctx.fillStyle = '#fff';
          ctx.fillRect(-1, -19 - bounce, 1, 1);
          ctx.fillRect(2, -19 - bounce, 1, 1);
      }
      else if (type === 'BAT') {
          const wingFlap = Math.sin(frame * 2) * 5;
          ctx.fillStyle = '#ef4444';
          ctx.beginPath(); ctx.arc(0, -10 + bounce, 6, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = '#7f1d1d';
          ctx.beginPath(); ctx.moveTo(0, -10 + bounce); ctx.lineTo(15, -20 + bounce + wingFlap); ctx.lineTo(5, -5 + bounce); ctx.fill();
          ctx.beginPath(); ctx.moveTo(0, -10 + bounce); ctx.lineTo(-15, -20 + bounce + wingFlap); ctx.lineTo(-5, -5 + bounce); ctx.fill();
      }
      else if (type === 'SKELETON') {
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(-5, -24 - bounce, 10, 10); // Skull
          ctx.fillRect(-4, -12 - bounce, 8, 12); // Ribs
          ctx.fillStyle = '#000'; ctx.fillRect(1, -22 - bounce, 2, 2);
          // Bone legs
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(-4, -5, 2, 8);
          ctx.fillRect(2, -5, 2, 8);
      }
      else if (type === 'GHOST') {
          ctx.globalAlpha = 0.8; // Slightly transparent
          ctx.fillStyle = color;
          
          // Ghost body shape (Round top, wavy bottom)
          ctx.beginPath();
          ctx.moveTo(-10, 0 + bounce);
          ctx.quadraticCurveTo(0, -25 + bounce, 10, 0 + bounce); // Head
          ctx.lineTo(10, 10 + bounce);
          
          // Wavy bottom
          const wave = Math.sin(frame * 3) * 2;
          ctx.lineTo(5, 5 + bounce + wave);
          ctx.lineTo(0, 10 + bounce - wave);
          ctx.lineTo(-5, 5 + bounce + wave);
          ctx.lineTo(-10, 10 + bounce);
          ctx.closePath();
          ctx.fill();
          
          // Glowing Eyes
          ctx.fillStyle = '#fff';
          ctx.shadowColor = '#fff';
          ctx.shadowBlur = 5;
          ctx.beginPath(); ctx.arc(-4, -5 + bounce, 2, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(4, -5 + bounce, 2, 0, Math.PI*2); ctx.fill();
          
          // Reset context
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1.0;
      }
      else if (type === 'BOSS') {
           ctx.scale(2, 2);
           ctx.fillStyle = '#7f1d1d'; ctx.fillRect(-6, -15 - bounce, 12, 16);
           ctx.fillStyle = '#000'; ctx.fillRect(-7, -26 - bounce, 14, 12);
           ctx.fillStyle = 'red'; ctx.fillRect(2, -22 - bounce, 2, 2); ctx.fillRect(-4, -22 - bounce, 2, 2);
           // Cape
           ctx.fillStyle = '#000'; ctx.fillRect(-8, -15-bounce, 2, 15); ctx.fillRect(6, -15-bounce, 2, 15);
      }
      
      ctx.restore(); // End Body Scale

      // --- Arms / Weapons (Aiming) ---
      // These are NOT scaled by facing, but rotated by aimAngle directly for true 360 aiming.
      // We might need to adjust Z-index (draw before or after body) depending on angle, but drawing on top is usually fine for this style.
      
      if (type === 'KNIGHT' || type === 'WARRIOR' || type === 'WIZARD' || type === 'MAGE' || type === 'ROGUE' || type === 'RANGER') {
          ctx.save();
          ctx.translate(0, -18 - bounce); // Shoulder pivot
          ctx.rotate(aimAngle);

          // Render Hand/Weapon relative to rotated arm
          if (type === 'KNIGHT' || type === 'WARRIOR') {
             // Weapon Arm
             if (isAttacking) {
                 // Thrust/Slash offset
                 ctx.translate(5, 0); 
             }
             ctx.fillStyle = '#9ca3af';
             ctx.fillRect(0, -2, 6, 4); // Arm
             // Sword
             ctx.fillStyle = '#cbd5e1';
             ctx.fillRect(6, -2, 20, 4); // Blade horizontal
             ctx.fillStyle = '#475569';
             ctx.fillRect(4, -6, 2, 12); // Guard
          }
          else if (type === 'WIZARD' || type === 'MAGE') {
             // Staff
             ctx.translate(6, 0);
             if (isAttacking) ctx.translate(3, 0); 
             ctx.fillStyle = '#92400e';
             ctx.fillRect(0, -2, 20, 2); // Staff length
             ctx.fillStyle = '#3b82f6';
             ctx.beginPath(); ctx.arc(18, -1, 4, 0, Math.PI*2); ctx.fill(); // Orb
          }
          else if (type === 'ROGUE' || type === 'RANGER') {
             // Dagger Hand
             ctx.translate(6, 0);
             if (isAttacking) ctx.translate(5, 0);
             ctx.fillStyle = '#fca5a5'; // Skin
             ctx.fillRect(0,-2,4,4);
             ctx.fillStyle = '#94a3b8'; // Knife
             ctx.beginPath(); ctx.moveTo(2, -2); ctx.lineTo(10, 0); ctx.lineTo(2, 2); ctx.fill();
          }
          ctx.restore();
      }

      ctx.restore(); // End Sprite Translate
  }
}
