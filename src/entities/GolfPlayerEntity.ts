/**
 * Golf Player Entity - Following Hytopia SDK Guidelines
 * 
 * Extends DefaultPlayerEntity to add golf-specific functionality:
 * - Golf swing mechanics with power meter
 * - Aiming system using camera controls
 * - Golf club visual representation
 * - Turn-based gameplay integration
 */

import {
  DefaultPlayerEntity,
  PlayerEntityOptions,
  Vector3Like,
  QuaternionLike,
  World,
  Player,
  EntityEvent,
  BaseEntityControllerEvent,
  Audio,
  Entity,
} from 'hytopia';

import GolfBallEntity from './GolfBallEntity.ts';

export interface GolfPlayerEntityOptions extends PlayerEntityOptions {
  // Golf-specific options
  maxPower?: number;        // Maximum shot power (0-100)
  aimSensitivity?: number;  // Camera aim sensitivity
  hasClub?: boolean;        // Whether player has golf club visible
}

export default class GolfPlayerEntity extends DefaultPlayerEntity {
  public readonly maxPower: number;
  public readonly aimSensitivity: number;
  
  // Golf game state
  private _currentPower: number = 0;
  private _isCharging: boolean = false;
  private _isAiming: boolean = false;
  private _golfClub: Entity | undefined;
  private _currentBall: GolfBallEntity | undefined;
  private _shotCount: number = 0;
  private _isPlayerTurn: boolean = false;
  private _hasClub: boolean;

  // Audio
  private _swingAudio: Audio | undefined;
  private _chargingAudio: Audio | undefined;

  constructor(options: GolfPlayerEntityOptions & { player: Player }) {
    super(options);

    this.maxPower = options.maxPower ?? 100;
    this.aimSensitivity = options.aimSensitivity ?? 1.0;
    this._hasClub = options.hasClub !== false; // Default to true

    // Set up golf-specific controls
    this._setupGolfControls();
    
    // Golf club will be created when entity is spawned
    // (can't create child entities before parent is spawned)
  }

  /**
   * Set the golf ball this player will hit
   */
  public setGolfBall(ball: GolfBallEntity): void {
    this._currentBall = ball;
    console.log(`Player ${this.player.username} assigned to ball`);
  }

  /**
   * Start player's turn
   */
  public startTurn(): void {
    this._isPlayerTurn = true;
    this._shotCount = 0;
    
    // Send turn notification to player
    this.player.ui.sendData({
      type: 'golf-turn-start',
      message: 'Your turn! Use Mouse to aim, hold Space to charge power',
      shotCount: this._shotCount,
    });

    // Enable aiming mode
    this._startAiming();
    
    console.log(`Started turn for player ${this.player.username}`);
  }

  /**
   * End player's turn
   */
  public endTurn(): void {
    this._isPlayerTurn = false;
    this._isAiming = false;
    this._isCharging = false;
    this._currentPower = 0;

    // Send turn end notification
    this.player.ui.sendData({
      type: 'golf-turn-end',
      shotCount: this._shotCount,
    });

    console.log(`Ended turn for player ${this.player.username} - Total shots: ${this._shotCount}`);
  }

  /**
   * Get player's current score (shot count)
   */
  public getScore(): number {
    return this._shotCount;
  }

  /**
   * Check if it's currently this player's turn
   */
  public isPlayerTurn(): boolean {
    return this._isPlayerTurn;
  }

  /**
   * Override spawn to set up golf club and audio
   */
  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    
    // Set up audio first
    this._setupAudio(world);
    
    // Set up golf UI
    this._setupGolfUI();
    
    // TODO: Golf club visual disabled temporarily to fix entity spawning issues
    // We'll add the golf club back once core gameplay is working
    // if (this._hasClub) {
    //   setTimeout(() => {
    //     this._createGolfClub();
    //     if (this._golfClub) {
    //       this._golfClub.spawn(world, position);
    //     }
    //   }, 100);
    // }
  }

  /**
   * Override despawn to cleanup golf club
   */
  public override despawn(): void {
    // Golf club cleanup disabled temporarily
    // if (this._golfClub?.isSpawned) {
    //   this._golfClub.despawn();
    // }
    
    super.despawn();
  }

  /**
   * Set up golf-specific input controls following SDK patterns
   */
  private _setupGolfControls(): void {
    // Use the controller's tick event for input handling
    this.controller?.on(BaseEntityControllerEvent.TICK_WITH_PLAYER_INPUT, ({ input }) => {
      if (!this._isPlayerTurn) return;

      // Power charging with spacebar
      if (input.sp && !this._isCharging && this._isAiming) {
        this._startCharging();
      } else if (!input.sp && this._isCharging) {
        this._executeShot();
      }

      // Update power while charging
      if (this._isCharging) {
        this._updatePower();
      }

      // Toggle aiming mode with 'F' key
      if (input.f && this._isPlayerTurn) {
        this._toggleAiming();
        // Cancel the input to prevent spam
        input.f = false;
      }

      // Reset shot with 'R' key (if allowed)
      if (input.r && this._isPlayerTurn && this._currentBall) {
        this._resetBall();
        input.r = false;
      }
    });
  }

  /**
   * Start aiming mode
   */
  private _startAiming(): void {
    if (!this._currentBall) return;

    this._isAiming = true;

    // Set camera to follow ball for aiming
    this.player.camera.setAttachedToEntity(this._currentBall);
    this.player.camera.setMode('third-person' as any); // Type assertion for compatibility
    this.player.camera.setOffset({ x: 0, y: 2, z: 5 }); // Position behind ball

    // Send aiming UI update
    this.player.ui.sendData({
      type: 'golf-aiming',
      isAiming: true,
      instructions: 'Move mouse to aim, hold SPACE to charge power',
    });

    console.log(`Player ${this.player.username} started aiming`);
  }

  /**
   * Toggle aiming mode on/off
   */
  private _toggleAiming(): void {
    if (this._isAiming) {
      this._stopAiming();
    } else {
      this._startAiming();
    }
  }

  /**
   * Stop aiming mode
   */
  private _stopAiming(): void {
    this._isAiming = false;

    // Return camera to player
    this.player.camera.setAttachedToEntity(this);
    this.player.camera.setOffset({ x: 0, y: 1.6, z: 0 });

    // Update UI
    this.player.ui.sendData({
      type: 'golf-aiming',
      isAiming: false,
    });
  }

  /**
   * Start power charging
   */
  private _startCharging(): void {
    this._isCharging = true;
    this._currentPower = 0;

    // Play charging sound
    if (this._chargingAudio && this.world) {
      this._chargingAudio.play(this.world, true); // Loop while charging
    }

    console.log(`Player ${this.player.username} started charging shot`);
  }

  /**
   * Update power while charging
   */
  private _updatePower(): void {
    if (!this._isCharging) return;

    // Increase power over time (power builds up over ~2 seconds)
    const powerIncrement = this.maxPower / (60 * 2); // 60 FPS * 2 seconds
    this._currentPower = Math.min(this._currentPower + powerIncrement, this.maxPower);

    // Send power update to UI
    this.player.ui.sendData({
      type: 'golf-power-meter',
      power: this._currentPower,
      maxPower: this.maxPower,
      isCharging: true,
    });
  }

  /**
   * Execute the golf shot
   */
  private _executeShot(): void {
    if (!this._isCharging || !this._currentBall || !this.world) return;

    this._isCharging = false;

    // Stop charging sound
    if (this._chargingAudio) {
      this._chargingAudio.stop();
    }

    // Calculate shot direction from camera facing direction
    const aimDirection = this.player.camera.facingDirection;
    
    // Calculate force based on power (scale appropriately)
    const force = (this._currentPower / this.maxPower) * 50; // Max force of 50

    // Execute the shot
    this._currentBall.hit(aimDirection, force);
    this._shotCount++;

    // Play swing sound
    if (this._swingAudio) {
      this._swingAudio.play(this.world, false, this.position);
    }

    // Update UI
    this.player.ui.sendData({
      type: 'golf-shot-executed',
      power: this._currentPower,
      force: force,
      direction: aimDirection,
      shotCount: this._shotCount,
    });

    this.player.ui.sendData({
      type: 'golf-power-meter',
      power: 0,
      maxPower: this.maxPower,
      isCharging: false,
    });

    // Reset power
    this._currentPower = 0;

    // Stop aiming after shot
    this._stopAiming();

    console.log(`Player ${this.player.username} executed shot ${this._shotCount} with power ${this._currentPower.toFixed(1)}`);

    // Emit shot event for game management
    this.emit('golf-shot', {
      player: this,
      ball: this._currentBall,
      power: this._currentPower,
      direction: aimDirection,
      shotCount: this._shotCount,
    });
  }

  /**
   * Reset ball position (for penalties, new holes, etc.)
   */
  private _resetBall(): void {
    if (!this._currentBall) return;

    // Reset ball to a reasonable position (could be last known good position)
    const resetPosition = { x: this.position.x, y: this.position.y + 1, z: this.position.z };
    this._currentBall.resetToPosition(resetPosition);

    this.player.ui.sendData({
      type: 'golf-message',
      message: 'Ball reset to position',
    });

    console.log(`Player ${this.player.username} reset ball position`);
  }

  /**
   * Create visual golf club using default assets
   */
  private _createGolfClub(): void {
    // Use an existing item model as golf club (sword model repurposed)
    this._golfClub = new Entity({
      parent: this,
      parentNodeName: 'hand_right_weapon_anchor', // Attach to right hand
      modelUri: 'models/items/sword.gltf', // Use default sword as golf club
      modelScale: 0.8,
      // Position and rotate to look more like a golf club
      relativePosition: { x: 0, y: -0.3, z: 0 },
      relativeRotation: { x: 0, y: 0, z: 0, w: 1 },
    });
  }

  /**
   * Set up audio using default Hytopia assets
   */
  private _setupAudio(world: World): void {
    // Swing sound
    this._swingAudio = new Audio({
      uri: 'audio/sfx/entity/attack.mp3', // Use attack sound for swing
      attachedToEntity: this,
      volume: 0.5,
      referenceDistance: 8,
      cutoffDistance: 20,
    });

    // Charging sound (optional - could be air whoosh)
    this._chargingAudio = new Audio({
      uri: 'audio/sfx/ambient/wind.mp3', // Use ambient wind for charging
      attachedToEntity: this,
      volume: 0.2,
      loop: true,
      referenceDistance: 5,
      cutoffDistance: 15,
    });
  }

  /**
   * Set up golf-specific UI
   */
  private _setupGolfUI(): void {
    // Send initial golf UI data
    this.player.ui.sendData({
      type: 'golf-init',
      playerName: this.player.username,
      maxPower: this.maxPower,
      isPlayerTurn: this._isPlayerTurn,
      shotCount: this._shotCount,
      controls: {
        aim: 'Mouse movement',
        charge: 'Hold SPACE',
        toggleAim: 'Press F',
        resetBall: 'Press R',
      },
    });
  }
}
