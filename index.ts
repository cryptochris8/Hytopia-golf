/**
 * Golf Game - Built with Hytopia SDK
 * 
 * A complete golf game implementation using only default Hytopia assets
 * and following strict SDK guidelines for physics and mechanics.
 * 
 * Features:
 * - Realistic golf ball physics using ColliderShape.BALL
 * - Turn-based multiplayer gameplay
 * - Power meter and aiming system
 * - Course built with default block types
 * - Scoring system with par tracking
 * - Audio effects using default SFX
 */

import {
  startServer,
  PlayerEvent,
  BlockType,
  Vector3Like,
  Audio,
} from 'hytopia';

import worldMap from './assets/map.json';
import GolfPlayerEntity from './src/entities/GolfPlayerEntity.ts';
import GolfGameManager from './src/managers/GolfGameManager.ts';

/**
 * Start our golf game server following Hytopia SDK guidelines
 */
startServer(world => {
  console.log('🏌️ Starting Golf Game Server...');

  /**
   * Enable debug rendering for development
   * This helps visualize golf ball physics and colliders
   * Disable in production for better performance
   */
  world.simulation.enableDebugRendering(true);

  /**
   * Load the world map
   * We'll use the default map and modify it for golf
   */
  world.loadMap(worldMap);

  /**
   * Set up lighting for a nice golf course atmosphere
   */
  world.setAmbientLightIntensity(0.8);  // Bright daylight for golf
  world.setDirectionalLightIntensity(6); // Strong sun for outdoor golf

  /**
   * Create custom block types for our golf course using default assets
   * Following SDK guidelines for block type creation
   */
  setupGolfCourseBlocks(world);

  /**
   * Build a basic golf course using the blocks
   */
  buildGolfCourse(world);

  /**
   * Initialize the golf game manager
   */
  const golfGameManager = new GolfGameManager(world);

  /**
   * Play peaceful golf course ambient music
   */
  const ambientMusic = new Audio({
    uri: 'audio/music/hytopia-main-theme.mp3', // Use default peaceful theme
    loop: true,
    volume: 0.15, // Quiet background music
  });
  ambientMusic.play(world);

  /**
   * Handle players joining the golf game
   * Following SDK event handling patterns
   */
  world.on(PlayerEvent.JOINED_WORLD, ({ player }) => {
    console.log(`⛳ Player ${player.username} joined the golf game`);

    // Create a golf player entity with golf-specific controls
    const golfPlayerEntity = new GolfPlayerEntity({
      player,
      name: `Golfer ${player.username}`,
      hasClub: true, // Show golf club visual
      maxPower: 100, // Maximum shot power
      aimSensitivity: 1.0,
    });

    // Spawn player at the clubhouse area
    const spawnPosition = { x: 0, y: 3, z: -30 }; // Behind first tee
    golfPlayerEntity.spawn(world, spawnPosition);

    // Load golf-specific UI
    player.ui.load('ui/golf-hud.html');

    // Add player to golf game
    golfGameManager.addPlayer(player, golfPlayerEntity);

    // Send welcome messages with golf instructions
    world.chatManager.sendPlayerMessage(player, '🏌️ Welcome to Hytopia Golf!', '00FF88');
    world.chatManager.sendPlayerMessage(player, '⛳ Golf Controls:', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, '  🎯 Mouse: Aim your shot', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '  ⚡ Hold SPACE: Charge power', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '  🎥 Press F: Toggle aiming mode', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '  🔄 Press R: Reset ball (if stuck)', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '📊 Type /startgolf to begin the game!', '00FFFF');
  });

  /**
   * Handle players leaving the golf game
   * Clean up player entities and remove from game
   */
  world.on(PlayerEvent.LEFT_WORLD, ({ player }) => {
    console.log(`⛳ Player ${player.username} left the golf game`);
    
    // Remove player from golf game
    golfGameManager.removePlayer(player);
    
    // Clean up player entities
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => entity.despawn());
  });

  /**
   * Golf game commands following SDK chat command patterns
   */
  
  // Start golf game command
  world.chatManager.registerCommand('/startgolf', player => {
    golfGameManager.startGame();
    world.chatManager.sendWorldMessage('🏌️ Golf game started! Good luck everyone!', '00FF88');
  });

  // End golf game command
  world.chatManager.registerCommand('/endgolf', player => {
    golfGameManager.endGame();
    world.chatManager.sendWorldMessage('⛳ Golf game ended!', 'FF8800');
  });

  // Show golf help command
  world.chatManager.registerCommand('/golfhelp', player => {
    world.chatManager.sendPlayerMessage(player, '🏌️ Golf Game Commands:', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, '/startgolf - Start a new golf game', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '/endgolf - End current golf game', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '/golfscore - Show current scores', 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, '/golfhelp - Show this help', 'FFFFFF');
  });

  // Show current golf scores
  world.chatManager.registerCommand('/golfscore', player => {
    const gameState = golfGameManager.getGameState();
    
    if (!gameState.inProgress) {
      world.chatManager.sendPlayerMessage(player, '⛳ No golf game in progress', 'FF8800');
      return;
    }

    world.chatManager.sendPlayerMessage(player, '📊 Current Golf Scores:', 'FFFF00');
    world.chatManager.sendPlayerMessage(player, `🏌️ Hole: ${gameState.currentHole}/${gameState.totalHoles}`, 'FFFFFF');
    world.chatManager.sendPlayerMessage(player, `⭐ Current Player: ${gameState.currentPlayer}`, 'FFFFFF');
    
    if (gameState.leaderboard) {
      gameState.leaderboard.forEach((score, index) => {
        const position = index + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '🏌️';
        world.chatManager.sendPlayerMessage(
          player, 
          `${medal} ${position}. ${score.playerName}: ${score.totalStrokes} strokes`, 
          'FFFFFF'
        );
      });
    }
  });

  /**
   * Fun easter egg commands (keeping some from original boilerplate)
   */
  world.chatManager.registerCommand('/rocket', player => {
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => {
      entity.applyImpulse({ x: 0, y: 20, z: 0 });
    });
    world.chatManager.sendPlayerMessage(player, '🚀 FORE! ...wait, that\'s not how golf works!', 'FF00FF');
  });

  world.chatManager.registerCommand('/swing', player => {
    // Fun command that makes player do a swing animation
    world.entityManager.getPlayerEntitiesByPlayer(player).forEach(entity => {
      if ('startModelOneshotAnimations' in entity) {
        (entity as any).startModelOneshotAnimations(['attack']); // Use attack animation as swing
      }
    });
    world.chatManager.sendPlayerMessage(player, '🏌️ Practice swing!', '00FF88');
  });

  console.log('🏌️ Golf Game Server started successfully!');
  console.log('⛳ Players can join and use /startgolf to begin playing');
});

/**
 * Set up custom block types for golf course
 * Following SDK guidelines for block type registration
 */
function setupGolfCourseBlocks(world: any): void {
  // Fairway grass (bright green)
  world.blockTypeRegistry.registerGenericBlockType({
    id: 100, // Custom block ID for fairway
    textureUri: 'blocks/grass', // Use default grass texture
    name: 'Fairway Grass',
  });

  // Rough grass (darker/different texture)
  world.blockTypeRegistry.registerGenericBlockType({
    id: 101,
    textureUri: 'blocks/oak-leaves.png', // Use oak leaves as rough grass
    name: 'Rough Grass',
  });

  // Sand trap
  world.blockTypeRegistry.registerGenericBlockType({
    id: 102,
    textureUri: 'blocks/sand.png', // Use default sand
    name: 'Sand Trap',
  });

  // Water hazard
  world.blockTypeRegistry.registerGenericBlockType({
    id: 103,
    textureUri: 'blocks/water-still.png',
    name: 'Water Hazard',
    isLiquid: true, // Makes it behave like water
  });

  // Tee area
  world.blockTypeRegistry.registerGenericBlockType({
    id: 104,
    textureUri: 'blocks/stone.png', // Use stone for tee markers
    name: 'Tee Marker',
  });

  // Green (putting area)
  world.blockTypeRegistry.registerGenericBlockType({
    id: 105,
    textureUri: 'blocks/emerald-block.png', // Use emerald for bright green
    name: 'Putting Green',
  });

  console.log('⛳ Golf course block types registered');
}

/**
 * Build a basic golf course using default blocks
 * Creates a simple 3-hole course layout
 */
function buildGolfCourse(world: any): void {
  console.log('🏗️ Building golf course...');

  // Build Hole 1 - Starter hole (Par 3)
  buildHole1(world);
  
  // Build Hole 2 - Dogleg right (Par 4) 
  buildHole2(world);
  
  // Build Hole 3 - Long drive (Par 5)
  buildHole3(world);

  // Add some decorative elements
  addCourseDecorations(world);

  console.log('⛳ Golf course construction completed!');
}

/**
 * Build Hole 1 - Simple straight hole
 */
function buildHole1(world: any): void {
  // Tee area
  buildRectangle(world, { x: -12, y: 1, z: -2 }, { x: -8, y: 1, z: 2 }, 104); // Tee markers
  buildRectangle(world, { x: -11, y: 2, z: -1 }, { x: -9, y: 2, z: 1 }, 100); // Fairway on tee

  // Fairway
  buildRectangle(world, { x: -8, y: 1, z: -3 }, { x: 8, y: 1, z: 3 }, 100); // Main fairway

  // Rough around fairway
  buildRectangle(world, { x: -8, y: 1, z: -5 }, { x: 8, y: 1, z: -4 }, 101); // North rough
  buildRectangle(world, { x: -8, y: 1, z: 4 }, { x: 8, y: 1, z: 5 }, 101);   // South rough

  // Green area
  buildCircle(world, { x: 10, y: 1, z: 0 }, 3, 105); // Putting green

  // Hole marker (small stone circle)
  buildCircle(world, { x: 10, y: 2, z: 0 }, 1, 104);
}

/**
 * Build Hole 2 - Dogleg right with sand trap
 */
function buildHole2(world: any): void {
  // Tee area
  buildRectangle(world, { x: -17, y: 1, z: 8 }, { x: -13, y: 1, z: 12 }, 104);
  buildRectangle(world, { x: -16, y: 2, z: 9 }, { x: -14, y: 2, z: 11 }, 100);

  // First part of fairway (straight)
  buildRectangle(world, { x: -13, y: 1, z: 7 }, { x: -3, y: 1, z: 13 }, 100);

  // Dogleg part (turning right)
  buildRectangle(world, { x: -3, y: 1, z: 7 }, { x: 5, y: 1, z: 10 }, 100);
  buildRectangle(world, { x: 5, y: 1, z: -7 }, { x: 8, y: 1, z: 7 }, 100);

  // Sand trap in the corner of dogleg
  buildCircle(world, { x: 0, y: 1, z: 5 }, 2, 102);

  // Green
  buildCircle(world, { x: 15, y: 1, z: -5 }, 3, 105);
  buildCircle(world, { x: 15, y: 2, z: -5 }, 1, 104);

  // Rough areas
  buildRectangle(world, { x: -13, y: 1, z: 14 }, { x: -3, y: 1, z: 16 }, 101);
  buildRectangle(world, { x: -13, y: 1, z: 5 }, { x: -3, y: 1, z: 6 }, 101);
}

/**
 * Build Hole 3 - Long par 5 with water hazard
 */
function buildHole3(world: any): void {
  // Tee area
  buildRectangle(world, { x: -2, y: 1, z: -22 }, { x: 2, y: 1, z: -18 }, 104);
  buildRectangle(world, { x: -1, y: 2, z: -21 }, { x: 1, y: 2, z: -19 }, 100);

  // Long fairway
  buildRectangle(world, { x: -4, y: 1, z: -18 }, { x: 4, y: 1, z: 15 }, 100);

  // Water hazard across the fairway
  buildRectangle(world, { x: -6, y: 1, z: 0 }, { x: 6, y: 1, z: 5 }, 103);

  // Fairway continues after water
  buildRectangle(world, { x: -4, y: 1, z: 15 }, { x: 4, y: 1, z: 22 }, 100);

  // Large green
  buildCircle(world, { x: 0, y: 1, z: 25 }, 4, 105);
  buildCircle(world, { x: 0, y: 2, z: 25 }, 1, 104);

  // Rough on sides
  buildRectangle(world, { x: -7, y: 1, z: -18 }, { x: -5, y: 1, z: 22 }, 101);
  buildRectangle(world, { x: 5, y: 1, z: -18 }, { x: 7, y: 1, z: 22 }, 101);
}

/**
 * Add decorative elements to the course
 */
function addCourseDecorations(world: any): void {
  // Add some trees (using default blocks)
  // These are just decorative block structures
  
  // Tree near hole 1
  buildSimpleTree(world, { x: 15, y: 1, z: 8 });
  buildSimpleTree(world, { x: 15, y: 1, z: -8 });
  
  // Trees around hole 2
  buildSimpleTree(world, { x: -20, y: 1, z: 15 });
  buildSimpleTree(world, { x: 18, y: 1, z: -10 });
  
  // Trees around hole 3
  buildSimpleTree(world, { x: -10, y: 1, z: -25 });
  buildSimpleTree(world, { x: 10, y: 1, z: -25 });
  buildSimpleTree(world, { x: -8, y: 1, z: 30 });
  buildSimpleTree(world, { x: 8, y: 1, z: 30 });
}

/**
 * Helper function to build a simple tree using blocks
 */
function buildSimpleTree(world: any, position: Vector3Like): void {
  // Trunk using stone blocks (safe block ID that exists)
  world.chunkLattice.setBlock({ x: position.x, y: position.y + 1, z: position.z }, 1); // bricks for trunk
  world.chunkLattice.setBlock({ x: position.x, y: position.y + 2, z: position.z }, 1); // bricks for trunk
  world.chunkLattice.setBlock({ x: position.x, y: position.y + 3, z: position.z }, 1); // bricks for trunk
  
  // Leaves using grass blocks (green color for leaves)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue; // Skip center (trunk)
      world.chunkLattice.setBlock({ 
        x: position.x + dx, 
        y: position.y + 3, 
        z: position.z + dz 
      }, 100); // Use our fairway grass for leaves
      world.chunkLattice.setBlock({ 
        x: position.x + dx, 
        y: position.y + 4, 
        z: position.z + dz 
      }, 100); // Use our fairway grass for leaves
    }
  }
}

/**
 * Helper function to build a rectangle of blocks
 */
function buildRectangle(world: any, corner1: Vector3Like, corner2: Vector3Like, blockId: number): void {
  const minX = Math.min(corner1.x, corner2.x);
  const maxX = Math.max(corner1.x, corner2.x);
  const minY = Math.min(corner1.y, corner2.y);
  const maxY = Math.max(corner1.y, corner2.y);
  const minZ = Math.min(corner1.z, corner2.z);
  const maxZ = Math.max(corner1.z, corner2.z);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        world.chunkLattice.setBlock({ x, y, z }, blockId);
      }
    }
  }
}

/**
 * Helper function to build a circle of blocks
 */
function buildCircle(world: any, center: Vector3Like, radius: number, blockId: number): void {
  for (let x = center.x - radius; x <= center.x + radius; x++) {
    for (let z = center.z - radius; z <= center.z + radius; z++) {
      const distance = Math.sqrt((x - center.x) ** 2 + (z - center.z) ** 2);
      if (distance <= radius) {
        world.chunkLattice.setBlock({ x, y: center.y, z }, blockId);
      }
    }
  }
}