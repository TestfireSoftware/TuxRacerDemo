import { Vector3, Vectors } from "../../math/vectors.ts";
import { GameContext } from "../game-context.ts";

export class Snowball {
  public position: Vector3;
  public velocity: Vector3;
  public radius: number = 0.3;
  public lifetime: number = 0;
  public maxLifetime: number = 3; // Snowball disappears after 3 seconds
  public active: boolean = true;

  constructor(position: Vector3, targetPosition: Vector3, speed: number = 15) {
    this.position = [...position] as Vector3;
    
    // Calculate velocity towards target
    const direction = Vectors.normalize(
      Vectors.subtract(targetPosition, position)
    );
    
    // Add some arc to the throw
    direction[1] += 0.3; // Aim slightly upward for arc
    
    this.velocity = Vectors.multiply(speed, Vectors.normalize(direction));
  }

  public update(timeStep: number): void {
    if (!this.active) return;

    this.lifetime += timeStep;
    
    // Check if snowball has expired
    if (this.lifetime > this.maxLifetime) {
      this.active = false;
      return;
    }

    // Update position
    this.position = Vectors.add(
      this.position,
      Vectors.multiply(timeStep, this.velocity)
    );

    // Apply gravity
    this.velocity[1] -= 9.81 * timeStep;

    // Check ground collision
    const groundY = GameContext.course.findYPosition(
      this.position[0],
      this.position[2]
    );
    
    if (this.position[1] <= groundY + this.radius) {
      this.active = false;
    }

    // Check if out of bounds
    const boundaryWidth =
      (GameContext.courseConfig.width - GameContext.courseConfig.playWidth) / 2;
    if (
      this.position[0] < boundaryWidth ||
      this.position[0] > GameContext.courseConfig.width - boundaryWidth ||
      this.position[2] > 0 ||
      this.position[2] < -GameContext.courseConfig.length
    ) {
      this.active = false;
    }
  }

  public checkPlayerCollision(): boolean {
    if (!this.active) return false;

    const playerPos = GameContext.player.position;
    const distance = Vectors.computeLength(
      Vectors.subtract(this.position, playerPos)
    );

    // Check if snowball hits player (considering player's approximate radius)
    const playerRadius = 0.5;
    return distance < this.radius + playerRadius;
  }
}
