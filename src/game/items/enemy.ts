import { Item } from "./item.ts";
import { ItemType } from "./item-types.ts";
import { Vector3, Vectors } from "../../math/vectors.ts";
import { GameContext } from "../game-context.ts";
import { Snowball } from "./snowball.ts";
import { Sound } from "../audio/sound.ts";

export enum MovementPattern {
  PATROLLING = "patrolling",
  CIRCULAR = "circular",
  FOLLOWING = "following",
}

export interface EnemyConfig {
  movementPattern: MovementPattern;
  speed: number;
  // Patrolling config
  patrolStart?: Vector3;
  patrolEnd?: Vector3;
  // Circular config
  centerPoint?: Vector3;
  radius?: number;
  angularSpeed?: number;
  // Following config
  detectionRadius?: number;
  returnSpeed?: number;
}

export class Enemy extends Item {
  private movementPattern: MovementPattern;
  private speed: number;
  private time: number = 0;
  private animationTime: number = 0;
  private baseHeight: number;

  // Patrolling state
  private patrolStart: Vector3;
  private patrolEnd: Vector3;
  private movingToEnd: boolean = true;

  // Circular movement state
  private centerPoint: Vector3;
  private radius: number;
  private angularSpeed: number;
  private angle: number = 0;

  // Following state
  private detectionRadius: number;
  private returnSpeed: number;
  private isFollowing: boolean = false;

  // Snowball throwing (for snowman enemies)
  public snowballs: Snowball[] = [];
  private throwCooldown: number = 0;
  private throwCooldownTime: number = 2; // Throw every 2 seconds
  private throwRange: number = 25; // Range to start throwing

  constructor(
    type: ItemType,
    position: Vector3,
    height: number,
    diameter: number,
    config: EnemyConfig
  ) {
    super(type, position, height, diameter);
    
    this.movementPattern = config.movementPattern;
    this.speed = config.speed;
    this.baseHeight = height;

    // Initialize patrolling
    this.patrolStart = config.patrolStart || [...position] as Vector3;
    this.patrolEnd = config.patrolEnd || [position[0] + 10, position[1], position[2]] as Vector3;

    // Initialize circular movement
    this.centerPoint = config.centerPoint || [...position] as Vector3;
    this.radius = config.radius || 5;
    this.angularSpeed = config.angularSpeed || 1;

    // Initialize following
    this.detectionRadius = config.detectionRadius || 15;
    this.returnSpeed = config.returnSpeed || this.speed * 0.5;
  }

  public update(timeStep: number): void {
    if (this.isCollected) {
      return;
    }

    this.time += timeStep;

    switch (this.movementPattern) {
      case MovementPattern.PATROLLING:
        this.updatePatrolling(timeStep);
        break;
      case MovementPattern.CIRCULAR:
        this.updateCircular(timeStep);
        break;
      case MovementPattern.FOLLOWING:
        this.updateFollowing(timeStep);
        break;
    }

    // Keep enemy on terrain
    this.position[1] = GameContext.course.findYPosition(
      this.position[0],
      this.position[2]
    );

    // Enforce course boundaries
    const boundaryWidth =
      (GameContext.courseConfig.width - GameContext.courseConfig.playWidth) / 2;
    
    if (this.position[0] < boundaryWidth) {
      this.position[0] = boundaryWidth;
      if (this.movementPattern === MovementPattern.PATROLLING) {
        this.movingToEnd = !this.movingToEnd;
      }
    }
    if (this.position[0] > GameContext.courseConfig.width - boundaryWidth) {
      this.position[0] = GameContext.courseConfig.width - boundaryWidth;
      if (this.movementPattern === MovementPattern.PATROLLING) {
        this.movingToEnd = !this.movingToEnd;
      }
    }

    // Add animation effects
    this.updateAnimation(timeStep);
    
    // Update snowball throwing for snowman enemies
    if (this.type.texture === "enemy_snowman.webp") {
      this.updateSnowballThrowing(timeStep);
    }
  }

  private updateAnimation(timeStep: number): void {
    this.animationTime += timeStep;

    // Add bobbing effect for moving enemies
    const velocityMagnitude = Vectors.computeLength(this.velocity);
    if (velocityMagnitude > 0.1) {
      // Bobbing frequency based on speed
      const bobbingFrequency = 2 + velocityMagnitude * 0.3;
      const bobbingAmplitude = 0.1;
      
      // Update height with bobbing
      const bobbing = Math.sin(this.animationTime * bobbingFrequency) * bobbingAmplitude;
      this.height = this.baseHeight + bobbing;
    }

    // Scale animation for yeti when following
    if (this.movementPattern === MovementPattern.FOLLOWING && this.isFollowing) {
      // Pulsing effect when chasing
      const pulseScale = 1 + Math.sin(this.animationTime * 4) * 0.05;
      this.diameter = this.diameter * pulseScale;
    }
  }

  private updatePatrolling(timeStep: number): void {
    const target = this.movingToEnd ? this.patrolEnd : this.patrolStart;
    const toTarget = Vectors.subtract(target, this.position);
    const distance = Vectors.computeLength(toTarget);

    if (distance < 0.5) {
      // Reached target, switch direction
      this.movingToEnd = !this.movingToEnd;
    } else {
      // Move towards target
      const direction = Vectors.normalize(toTarget);
      this.velocity = Vectors.multiply(this.speed, direction);
      this.position = Vectors.add(
        this.position,
        Vectors.multiply(timeStep, this.velocity)
      );
    }
  }

  private updateCircular(timeStep: number): void {
    this.angle += this.angularSpeed * timeStep;
    
    // Calculate new position on circle
    const x = this.centerPoint[0] + Math.cos(this.angle) * this.radius;
    const z = this.centerPoint[2] + Math.sin(this.angle) * this.radius;
    
    // Calculate velocity for smooth movement
    const newPosition: Vector3 = [x, this.position[1], z];
    this.velocity = Vectors.multiply(
      1 / timeStep,
      Vectors.subtract(newPosition, this.position)
    );
    
    this.position = newPosition;
  }

  private updateFollowing(timeStep: number): void {
    const playerPosition = GameContext.player.position;
    const toPlayer = Vectors.subtract(playerPosition, this.position);
    const distanceToPlayer = Vectors.computeLength(toPlayer);

    if (distanceToPlayer < this.detectionRadius && !GameContext.player.isAirborne) {
      // Follow player
      this.isFollowing = true;
      const direction = Vectors.normalize(toPlayer);
      this.velocity = Vectors.multiply(this.speed, direction);
    } else if (this.isFollowing) {
      // Return to initial position
      const toHome = Vectors.subtract(this.initialPosition, this.position);
      const distanceToHome = Vectors.computeLength(toHome);
      
      if (distanceToHome < 0.5) {
        this.isFollowing = false;
        this.velocity = [0, 0, 0] as Vector3;
      } else {
        const direction = Vectors.normalize(toHome);
        this.velocity = Vectors.multiply(this.returnSpeed, direction);
      }
    }

    if (Vectors.computeLength(this.velocity) > 0) {
      this.position = Vectors.add(
        this.position,
        Vectors.multiply(timeStep, this.velocity)
      );
    }
  }

  private updateSnowballThrowing(timeStep: number): void {
    // Update cooldown
    if (this.throwCooldown > 0) {
      this.throwCooldown -= timeStep;
    }

    // Update existing snowballs
    this.snowballs = this.snowballs.filter(snowball => {
      snowball.update(timeStep);
      
      // Check collision with player
      if (snowball.checkPlayerCollision()) {
        // Slow down the player when hit
        const knockback = 0.7; // Reduce speed to 70%
        GameContext.player.velocity = Vectors.multiply(
          knockback,
          GameContext.player.velocity
        );
        GameContext.soundPlayer.playSound(Sound.TREE_HIT);
        return false; // Remove snowball
      }
      
      return snowball.active;
    });

    // Check if should throw new snowball
    const playerPos = GameContext.player.position;
    const toPlayer = Vectors.subtract(playerPos, this.position);
    const distanceToPlayer = Vectors.computeLength(toPlayer);

    if (
      distanceToPlayer < this.throwRange &&
      this.throwCooldown <= 0 &&
      !GameContext.player.isAirborne &&
      this.snowballs.length < 3 // Max 3 snowballs at once
    ) {
      // Throw a snowball
      const throwPosition: Vector3 = [
        this.position[0],
        this.position[1] + this.height * 0.8, // Throw from upper part of snowman
        this.position[2]
      ];
      
      // Lead the target based on player velocity
      const leadTime = distanceToPlayer / 15; // Snowball speed
      const predictedPos = Vectors.add(
        playerPos,
        Vectors.multiply(leadTime, GameContext.player.velocity)
      );
      
      this.snowballs.push(new Snowball(throwPosition, predictedPos));
      this.throwCooldown = this.throwCooldownTime;
    }
  }
}
