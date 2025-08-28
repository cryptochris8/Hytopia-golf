/**
 * Golf Game Manager - Following Hytopia SDK Guidelines
 * 
 * Manages the overall golf game flow:
 * - Turn-based gameplay
 * - Scoring system
 * - Course management
 * - Hole completion detection
 * - Game state tracking
 */

import {
  World,
  Player,
  Vector3Like,
  EntityEvent,
  Audio,
} from 'hytopia';

import GolfBallEntity from '../entities/GolfBallEntity.ts';
import GolfPlayerEntity from '../entities/GolfPlayerEntity.ts';

export interface GolfHole {
  id: number;
  name: string;
  par: number;
  teePosition: Vector3Like;
  holePosition: Vector3Like;
  holeRadius: number;
}

export interface PlayerScore {
  player: Player;
  golfEntity: GolfPlayerEntity;
  strokes: number[];        // Strokes per hole
  totalStrokes: number;
  currentHole: number;
}

export default class GolfGameManager {
  private _world: World;
  private _players: Map<string, PlayerScore> = new Map();
  private _currentPlayerIndex: number = 0;
  private _currentHole: number = 0;
  private _gameInProgress: boolean = false;
  private _holes: GolfHole[] = [];
  private _golfBall: GolfBallEntity | undefined;
  
  // Audio
  private _holeInOneAudio: Audio | undefined;
  private _gameStartAudio: Audio | undefined;
  private _gameEndAudio: Audio | undefined;

  constructor(world: World) {
    this._world = world;
    this._setupDefaultCourse();
    this._setupAudio();
  }

  /**
   * Add a player to the golf game
   */
  public addPlayer(player: Player, golfEntity: GolfPlayerEntity): void {
    const playerScore: PlayerScore = {
      player,
      golfEntity,
      strokes: [],
      totalStrokes: 0,
      currentHole: 0,
    };

    this._players.set(player.id, playerScore);
    
    // Set up player event listeners
    this._setupPlayerEvents(golfEntity);

    console.log(`Added player ${player.username} to golf game`);
    
    // Update all players about new player joining
    this._broadcastGameState();
  }

  /**
   * Remove a player from the golf game
   */
  public removePlayer(player: Player): void {
    this._players.delete(player.id);
    
    // If it was current player's turn, advance to next player
    if (this._gameInProgress && this._getCurrentPlayer()?.player.id === player.id) {
      this._nextPlayerTurn();
    }
    
    console.log(`Removed player ${player.username} from golf game`);
    this._broadcastGameState();
  }

  /**
   * Start a new golf game
   */
  public startGame(): void {
    if (this._players.size === 0) {
      console.warn('Cannot start golf game - no players');
      return;
    }

    this._gameInProgress = true;
    this._currentHole = 0;
    this._currentPlayerIndex = 0;

    // Reset all player scores
    this._players.forEach(playerScore => {
      playerScore.strokes = [];
      playerScore.totalStrokes = 0;
      playerScore.currentHole = 0;
    });

    // Create golf ball for the game
    this._createGolfBall();

    // Start first hole
    this._startHole(0);

    // Play game start sound
    if (this._gameStartAudio) {
      this._gameStartAudio.play(this._world);
    }

    console.log('Golf game started!');
    this._broadcastGameState();
  }

  /**
   * End the current golf game
   */
  public endGame(): void {
    if (!this._gameInProgress) return;

    this._gameInProgress = false;

    // End current player's turn
    const currentPlayer = this._getCurrentPlayer();
    if (currentPlayer) {
      currentPlayer.golfEntity.endTurn();
    }

    // Calculate final scores and winner
    const finalScores = this._calculateFinalScores();
    const winner = finalScores[0]; // Lowest score wins

    // Broadcast final results
    this._players.forEach(playerScore => {
      playerScore.player.ui.sendData({
        type: 'golf-game-end',
        winner: winner.player.username,
        finalScores: finalScores.map(score => ({
          playerName: score.player.username,
          totalStrokes: score.totalStrokes,
          strokes: score.strokes,
        })),
      });
    });

    // Play game end sound
    if (this._gameEndAudio) {
      this._gameEndAudio.play(this._world);
    }

    console.log(`Golf game ended! Winner: ${winner.player.username} with ${winner.totalStrokes} strokes`);
  }

  /**
   * Get current game state for UI updates
   */
  public getGameState() {
    return {
      inProgress: this._gameInProgress,
      currentHole: this._currentHole + 1, // Display as 1-indexed
      totalHoles: this._holes.length,
      currentPlayer: this._getCurrentPlayer()?.player.username,
      leaderboard: this._calculateCurrentLeaderboard(),
    };
  }

  /**
   * Create a golf ball for the game
   */
  private _createGolfBall(): void {
    if (this._golfBall?.isSpawned) {
      this._golfBall.despawn();
    }

    this._golfBall = new GolfBallEntity();
    
    // Set up ball event listeners
    this._golfBall.on('ball-in-hole', () => this._handleBallInHole());
    this._golfBall.on('ball-in-water', () => this._handleWaterHazard());
    
    console.log('Golf ball created');
  }

  /**
   * Start a specific hole
   */
  private _startHole(holeIndex: number): void {
    if (holeIndex >= this._holes.length) {
      this._endGame();
      return;
    }

    this._currentHole = holeIndex;
    const hole = this._holes[holeIndex];

    // Place ball at tee position
    if (this._golfBall) {
      this._golfBall.spawn(this._world, hole.teePosition);
    }

    // Reset player turn index for new hole
    this._currentPlayerIndex = 0;

    // Broadcast hole start to all players
    this._players.forEach(playerScore => {
      playerScore.player.ui.sendData({
        type: 'golf-hole-start',
        holeNumber: holeIndex + 1,
        holeName: hole.name,
        par: hole.par,
        teePosition: hole.teePosition,
        holePosition: hole.holePosition,
      });
    });

    // Start first player's turn
    this._startPlayerTurn();

    console.log(`Started hole ${holeIndex + 1}: ${hole.name} (Par ${hole.par})`);
  }

  /**
   * Start current player's turn
   */
  private _startPlayerTurn(): void {
    const currentPlayer = this._getCurrentPlayer();
    if (!currentPlayer) return;

    // End previous player's turn
    this._players.forEach(playerScore => {
      if (playerScore !== currentPlayer) {
        playerScore.golfEntity.endTurn();
      }
    });

    // Set ball for current player
    if (this._golfBall) {
      currentPlayer.golfEntity.setGolfBall(this._golfBall);
    }

    // Start current player's turn
    currentPlayer.golfEntity.startTurn();

    // Broadcast turn change
    this._broadcastGameState();

    console.log(`Started turn for player ${currentPlayer.player.username}`);
  }

  /**
   * Advance to next player's turn
   */
  private _nextPlayerTurn(): void {
    // Check if ball is still moving
    if (this._golfBall?.isMoving()) {
      // Wait for ball to stop before advancing turn
      setTimeout(() => this._nextPlayerTurn(), 100);
      return;
    }

    this._currentPlayerIndex = (this._currentPlayerIndex + 1) % this._players.size;
    this._startPlayerTurn();
  }

  /**
   * Handle ball entering the hole
   */
  private _handleBallInHole(): void {
    if (!this._gameInProgress) return;

    const currentPlayer = this._getCurrentPlayer();
    if (!currentPlayer) return;

    const hole = this._holes[this._currentHole];
    const strokes = currentPlayer.golfEntity.getScore();

    // Record score
    currentPlayer.strokes[this._currentHole] = strokes;
    currentPlayer.totalStrokes += strokes;

    // Determine score type
    let scoreType = 'par';
    let scoreMessage = `Par ${hole.par}`;

    if (strokes === 1) {
      scoreType = 'hole-in-one';
      scoreMessage = 'HOLE IN ONE!';
      if (this._holeInOneAudio) {
        this._holeInOneAudio.play(this._world);
      }
    } else if (strokes < hole.par) {
      const under = hole.par - strokes;
      scoreType = under === 1 ? 'birdie' : under === 2 ? 'eagle' : 'albatross';
      scoreMessage = scoreType.toUpperCase();
    } else if (strokes > hole.par) {
      const over = strokes - hole.par;
      scoreType = over === 1 ? 'bogey' : over === 2 ? 'double-bogey' : 'triple-bogey+';
      scoreMessage = `+${over} ${scoreType.toUpperCase()}`;
    }

    // Broadcast hole completion
    this._players.forEach(playerScore => {
      playerScore.player.ui.sendData({
        type: 'golf-hole-complete',
        player: currentPlayer.player.username,
        strokes,
        par: hole.par,
        scoreType,
        scoreMessage,
        holeNumber: this._currentHole + 1,
      });
    });

    console.log(`${currentPlayer.player.username} completed hole ${this._currentHole + 1} in ${strokes} strokes (${scoreMessage})`);

    // Move to next hole after delay
    setTimeout(() => {
      this._startHole(this._currentHole + 1);
    }, 3000); // 3 second delay to show results
  }

  /**
   * Handle ball going into water hazard
   */
  private _handleWaterHazard(): void {
    const currentPlayer = this._getCurrentPlayer();
    if (!currentPlayer) return;

    // Add penalty stroke
    currentPlayer.golfEntity['_shotCount']++; // Access private property (in real implementation, add public method)

    // Reset ball to safe position (simplified - should be drop zone)
    const hole = this._holes[this._currentHole];
    if (this._golfBall) {
      this._golfBall.resetToPosition(hole.teePosition);
    }

    // Notify player
    currentPlayer.player.ui.sendData({
      type: 'golf-penalty',
      type_penalty: 'water',
      message: 'Water hazard! +1 penalty stroke. Ball placed back at tee.',
    });

    console.log(`${currentPlayer.player.username} hit into water hazard - penalty stroke`);
  }

  /**
   * Set up event listeners for a golf player entity
   */
  private _setupPlayerEvents(golfEntity: GolfPlayerEntity): void {
    golfEntity.on('golf-shot', () => {
      // After a shot, wait for ball to stop then advance turn
      setTimeout(() => {
        if (!this._golfBall?.isMoving()) {
          this._nextPlayerTurn();
        }
      }, 1000); // Give ball time to settle
    });
  }

  /**
   * Get current active player
   */
  private _getCurrentPlayer(): PlayerScore | undefined {
    const players = Array.from(this._players.values());
    return players[this._currentPlayerIndex];
  }

  /**
   * Calculate current leaderboard
   */
  private _calculateCurrentLeaderboard() {
    return Array.from(this._players.values())
      .map(playerScore => ({
        playerName: playerScore.player.username,
        totalStrokes: playerScore.totalStrokes,
        currentHole: this._currentHole + 1,
        strokes: playerScore.strokes,
      }))
      .sort((a, b) => a.totalStrokes - b.totalStrokes);
  }

  /**
   * Calculate final scores
   */
  private _calculateFinalScores() {
    return Array.from(this._players.values())
      .sort((a, b) => a.totalStrokes - b.totalStrokes);
  }

  /**
   * Broadcast current game state to all players
   */
  private _broadcastGameState(): void {
    const gameState = this.getGameState();
    
    this._players.forEach(playerScore => {
      playerScore.player.ui.sendData({
        type: 'golf-game-state',
        ...gameState,
        isYourTurn: this._getCurrentPlayer()?.player.id === playerScore.player.id,
      });
    });
  }

  /**
   * Set up default golf course using existing blocks
   */
  private _setupDefaultCourse(): void {
    // Create a simple 3-hole course
    this._holes = [
      {
        id: 1,
        name: 'Starter Hole',
        par: 3,
        teePosition: { x: -10, y: 2, z: 0 },
        holePosition: { x: 10, y: 2, z: 0 },
        holeRadius: 0.5,
      },
      {
        id: 2,
        name: 'Dogleg Right',
        par: 4,
        teePosition: { x: -15, y: 2, z: 10 },
        holePosition: { x: 15, y: 2, z: -5 },
        holeRadius: 0.5,
      },
      {
        id: 3,
        name: 'Long Drive',
        par: 5,
        teePosition: { x: 0, y: 2, z: -20 },
        holePosition: { x: 0, y: 2, z: 25 },
        holeRadius: 0.5,
      },
    ];

    console.log(`Set up golf course with ${this._holes.length} holes`);
  }

  /**
   * Set up audio using default Hytopia assets
   */
  private _setupAudio(): void {
    this._holeInOneAudio = new Audio({
      uri: 'audio/sfx/ui/success.mp3', // Use UI success sound for hole-in-one
      volume: 0.8,
      referenceDistance: 20,
      cutoffDistance: 50,
    });

    this._gameStartAudio = new Audio({
      uri: 'audio/sfx/ui/start.mp3', // Use UI start sound for game start
      volume: 0.6,
      referenceDistance: 15,
      cutoffDistance: 30,
    });

    this._gameEndAudio = new Audio({
      uri: 'audio/sfx/ui/complete.mp3', // Use UI complete sound for game end
      volume: 0.7,
      referenceDistance: 20,
      cutoffDistance: 40,
    });
  }
}
