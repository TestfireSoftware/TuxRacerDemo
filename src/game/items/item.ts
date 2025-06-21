import { ItemType } from "./item-types.ts";
import { Vector3, Vectors } from "../../math/vectors.ts";
import { GameContext } from "../game-context.ts";

export class Item {
  private collisionDiameter: number;
  private collisionRadius: number;

  public type: ItemType;
  public position: Vector3;
  public height: number;
  public diameter: number;
  public velocity: Vector3;
  public initialPosition: Vector3;

  public isCollected: boolean;

  constructor(
    type: ItemType,
    position: Vector3,
    height: number,
    diameter: number,
  ) {
    this.type = type;
    this.position = position;
    this.initialPosition = [...position] as Vector3;
    this.height = height;
    this.diameter = diameter;
    this.velocity = [0, 0, 0] as Vector3;

    this.isCollected = false;
    this.collisionDiameter = this.diameter * this.type.collisionDiameter;
    this.collisionRadius = this.collisionDiameter / 2;
  }

  public hasCollisionDuringMovement(
    item: Item,
    playerPosition: Vector3,
    lastPlayerPosition: Vector3,
  ): boolean {
    if (this.hasCollision(item, playerPosition)) {
      return true;
    }

    const movement = Vectors.subtract(playerPosition, lastPlayerPosition);
    const distance = Vectors.computeLength(movement);
    const numSteps = Math.floor(distance / this.collisionDiameter);
    if (numSteps === 0) {
      return false;
    }

    const step = Vectors.multiply(1 / (numSteps + 1), movement);

    let interpolatedPosition = lastPlayerPosition;
    for (let i = 0; i < numSteps; i++) {
      interpolatedPosition = Vectors.add(interpolatedPosition, step);
      if (this.hasCollision(item, interpolatedPosition)) {
        return true;
      }
    }

    return false;
  }

  private hasCollision(item: Item, position: Vector3): boolean {
    return (
      position[2] - this.collisionRadius < item.position[2] &&
      position[2] + this.collisionRadius > item.position[2] &&
      position[0] - this.collisionRadius < item.position[0] &&
      position[0] + this.collisionRadius > item.position[0] &&
      position[1] < item.position[1] + item.height
    );
  }

  public update(timeStep: number): void {
    // Don't update static items or collected items
    if (this.type.isStatic || this.isCollected) {
      return;
    }

    // Update position based on velocity
    this.position = Vectors.add(
      this.position,
      Vectors.multiply(timeStep, this.velocity)
    );

    // Keep item on terrain
    this.position[1] = GameContext.course.findYPosition(
      this.position[0],
      this.position[2]
    );

    // Enforce course boundaries
    const boundaryWidth =
      (GameContext.courseConfig.width - GameContext.courseConfig.playWidth) / 2;
    if (this.position[0] < boundaryWidth) {
      this.position[0] = boundaryWidth;
      this.velocity[0] = Math.abs(this.velocity[0]); // Bounce off
    }
    if (this.position[0] > GameContext.courseConfig.width - boundaryWidth) {
      this.position[0] = GameContext.courseConfig.width - boundaryWidth;
      this.velocity[0] = -Math.abs(this.velocity[0]); // Bounce off
    }
  }
}
