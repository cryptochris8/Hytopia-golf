/**
 * Golf Ball Entity - Following Hytopia SDK Guidelines
 * 
 * This entity represents a golf ball with realistic physics:
 * - Uses ColliderShape.BALL for perfect golf ball physics
 * - Proper bouncing and rolling mechanics
 * - Collision detection for holes and hazards
 * - Visual representation using default assets
 */

import {
  Entity,
  EntityOptions,
  RigidBodyType,
  ColliderShape,
  Vector3Like,
  QuaternionLike,
  EntityEvent,
  World,
  Audio,
} from 'hytopia';

export interface GolfBallEntityOptions extends Partial<EntityOptions> {
  // Golf-specific ball properties
  ballRadius?: number;
  ballRestitution?: number;  // Bounciness (0-1)
  ballFriction?: number;     // Rolling resistance (0-1) 
  ballMass?: number;         // Ball weight
  gravityScale?: number;     // Gravity effect on ball
}

export default class GolfBallEntity extends Entity {
  public readonly ballRadius: number;
  public readonly ballRestitution: number;
  public readonly ballFriction: number;
  public readonly ballMass: number;
  private _bounceAudio: Audio | undefined;
  private _rollAudio: Audio | undefined;
  private _isRolling: boolean = false;

  constructor(options: GolfBallEntityOptions = {}) {
    // Golf ball standard specifications in meters
    const ballRadius = options.ballRadius ?? 0.021;  // Standard golf ball radius
    const ballRestitution = options.ballRestitution ?? 0.6;  // Golf ball bounce
    const ballFriction = options.ballFriction ?? 0.3;        // Rolling resistance
    const ballMass = options.ballMass ?? 0.045;              // Golf ball mass in kg
    const gravityScale = options.gravityScale ?? 1.0;

    super({
      // Visual representation using default assets
      // Option 1: Use a small block entity with sphere collider
      blockTextureUri: 'blocks/snow.png',  // White color for golf ball
      blockHalfExtents: { 
        x: ballRadius, 
        y: ballRadius, 
        z: ballRadius 
      },
      
      // Rigid body options following SDK guidelines
      rigidBodyOptions: {
        type: RigidBodyType.DYNAMIC,  // Dynamic for realistic physics
        gravityScale,
        linearDamping: 0.1,   // Slight air resistance
        angularDamping: 0.05, // Minimal spin resistance
        
        // Golf ball collider - CRITICAL for proper golf physics
        colliders: [{
          shape: ColliderShape.BALL,  // Perfect sphere for golf ball
          radius: ballRadius,
          mass: ballMass,
          restitution: ballRestitution,  // Bounce factor
          friction: ballFriction,        // Rolling resistance
          
          // Collision callback for ball interactions
          onCollision: (other, started) => this._handleCollision(other, started),
        }]
      },
      
      // Pass through other options
      ...options,
    });

    // Store golf ball properties
    this.ballRadius = ballRadius;
    this.ballRestitution = ballRestitution;
    this.ballFriction = ballFriction;
    this.ballMass = ballMass;

    // Set up ball behavior events
    this._setupBallEvents();
  }

  /**
   * Hit the golf ball with specified force and direction
   * Following SDK guidelines for applying impulse forces
   */
  public hit(direction: Vector3Like, force: number): void {
    if (!this.isSpawned) {
      console.warn('Cannot hit golf ball - entity not spawned');
      return;
    }

    // Calculate impulse vector (force * direction * mass for realistic physics)
    const impulse = {
      x: direction.x * force * this.ballMass,
      y: direction.y * force * this.ballMass,
      z: direction.z * force * this.ballMass,
    };

    // Apply impulse using SDK method
    this.applyImpulse(impulse);

    // Play hit sound effect
    this._playHitSound();

    console.log(`Golf ball hit with force ${force} in direction:`, direction);
  }

  /**
   * Stop the ball (useful for rules like out of bounds)
   */
  public stopBall(): void {
    if (!this.isSpawned) return;

    // Use SDK method to stop ball
    this.setLinearVelocity({ x: 0, y: 0, z: 0 });
    this.setAngularVelocity({ x: 0, y: 0, z: 0 });
    
    this._isRolling = false;
    this._stopRollSound();
  }

  /**
   * Reset ball position (for new hole or penalty)
   */
  public resetToPosition(position: Vector3Like): void {
    if (!this.isSpawned) return;

    // Stop ball first
    this.stopBall();
    
    // Move to new position using SDK method
    this.setPosition(position);
  }

  /**
   * Get current ball velocity (useful for game logic)
   */
  public getBallVelocity(): Vector3Like {
    return this.linearVelocity;
  }

  /**
   * Check if ball is moving
   */
  public isMoving(): boolean {
    const velocity = this.getBallVelocity();
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    return speed > 0.01; // Threshold for "stopped"
  }

  /**
   * Override spawn to set up audio
   */
  public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike): void {
    super.spawn(world, position, rotation);
    this._setupAudio(world);
  }

  /**
   * Override despawn to cleanup audio
   */
  public override despawn(): void {
    this._cleanupAudio();
    super.despawn();
  }

  /**
   * Set up ball physics events following SDK patterns
   */
  private _setupBallEvents(): void {
    // Monitor ball movement for rolling sound
    this.on(EntityEvent.TICK, () => {
      const wasRolling = this._isRolling;
      this._isRolling = this.isMoving();

      // Start/stop rolling sound based on movement
      if (this._isRolling && !wasRolling) {
        this._playRollSound();
      } else if (!this._isRolling && wasRolling) {
        this._stopRollSound();
      }
    });
  }

  /**
   * Handle ball collisions following SDK collision callback pattern
   */
  private _handleCollision(other: any, started: boolean): void {
    if (!started) return; // Only handle collision start

    // Play bounce sound on impact
    if (this.isMoving()) {
      this._playBounceSound();
    }

    // Check for special collision types
    if (other && typeof other === 'object') {
      // Handle hole detection (implement in golf game manager)
      if (other.name === 'GolfHole') {
        console.log('Golf ball entered hole!');
        // Emit event for golf game manager to handle
        this.emit('ball-in-hole', { ball: this, hole: other });
      }
      
      // Handle water hazard
      if (other.isLiquid) {
        console.log('Golf ball in water hazard!');
        this.emit('ball-in-water', { ball: this, position: this.position });
      }
      
      // Handle sand trap (sand blocks)
      if (other.name && other.name.includes('sand')) {
        console.log('Golf ball in sand trap!');
        // Increase friction temporarily
        this._applyTemporaryFriction(0.8, 2000); // Higher friction for 2 seconds
      }
    }
  }

  /**
   * Apply temporary friction change (for sand traps, rough, etc.)
   */
  private _applyTemporaryFriction(frictionMultiplier: number, durationMs: number): void {
    // Note: In a full implementation, you'd modify the collider's friction
    // This is a simplified version showing the pattern
    console.log(`Applying temporary friction: ${frictionMultiplier}x for ${durationMs}ms`);
    
    setTimeout(() => {
      console.log('Friction returned to normal');
    }, durationMs);
  }

  /**
   * Set up audio using default Hytopia assets
   */
  private _setupAudio(world: World): void {
    // Bounce sound using default SFX
    this._bounceAudio = new Audio({
      uri: 'audio/sfx/misc/pop.mp3',  // Using default SFX
      attachedToEntity: this,
      volume: 0.3,
      referenceDistance: 5,
      cutoffDistance: 20,
    });

    // Rolling sound (looped) using default SFX
    this._rollAudio = new Audio({
      uri: 'audio/sfx/step/gravel.mp3',  // Using default step sound for rolling
      attachedToEntity: this,
      loop: true,
      volume: 0.1,
      referenceDistance: 3,
      cutoffDistance: 10,
    });
  }

  /**
   * Play ball hit sound
   */
  private _playHitSound(): void {
    if (!this.world) return;

    // Use a different SFX for hitting
    const hitAudio = new Audio({
      uri: 'audio/sfx/entity/attack.mp3',  // Default attack sound for hit
      volume: 0.4,
      referenceDistance: 8,
      cutoffDistance: 25,
    });

    hitAudio.play(this.world, false, this.position);
  }

  /**
   * Play bounce sound
   */
  private _playBounceSound(): void {
    if (!this.world || !this._bounceAudio) return;
    this._bounceAudio.play(this.world, false, this.position);
  }

  /**
   * Start rolling sound
   */
  private _playRollSound(): void {
    if (!this.world || !this._rollAudio) return;
    this._rollAudio.play(this.world, true); // Loop the rolling sound
  }

  /**
   * Stop rolling sound
   */
  private _stopRollSound(): void {
    if (!this._rollAudio) return;
    this._rollAudio.stop();
  }

  /**
   * Cleanup audio resources
   */
  private _cleanupAudio(): void {
    this._bounceAudio = undefined;
    this._rollAudio = undefined;
  }
}

/**
 * Factory function for creating golf balls with preset configurations
 */
export class GolfBallFactory {
  /**
   * Create a standard golf ball
   */
  static createStandardBall(options?: GolfBallEntityOptions): GolfBallEntity {
    return new GolfBallEntity({
      ballRadius: 0.021,      // Standard golf ball
      ballRestitution: 0.6,   // Normal bounce
      ballFriction: 0.3,      // Normal friction
      ballMass: 0.045,        // Standard weight
      ...options,
    });
  }

  /**
   * Create a driving range ball (slightly different physics)
   */
  static createRangeBall(options?: GolfBallEntityOptions): GolfBallEntity {
    return new GolfBallEntity({
      ballRadius: 0.021,
      ballRestitution: 0.5,   // Less bouncy
      ballFriction: 0.4,      // More friction
      ballMass: 0.048,        // Slightly heavier
      ...options,
    });
  }
}
