import Phaser from 'phaser';
import { clamp, moveTowards, wrapAngle } from '../utils/math';

export interface SteeringParams {
  maxSpeed: number;
  maxAcceleration: number;
  maxTurnRate: number;
}

export function steerVelocity(
  currentVelocity: Phaser.Math.Vector2,
  from: Phaser.Math.Vector2,
  to: Phaser.Math.Vector2,
  params: SteeringParams,
  dtSeconds: number
): Phaser.Math.Vector2 {
  const desiredDirection = to.clone().subtract(from);
  if (desiredDirection.lengthSq() < 0.001) {
    return currentVelocity.clone();
  }

  desiredDirection.normalize();

  const currentSpeed = currentVelocity.length();
  const currentAngle = currentSpeed > 1 ? currentVelocity.angle() : desiredDirection.angle();
  const targetAngle = desiredDirection.angle();

  const angleDelta = wrapAngle(targetAngle - currentAngle);
  const limitedDelta = clamp(angleDelta, -params.maxTurnRate * dtSeconds, params.maxTurnRate * dtSeconds);
  const newAngle = currentAngle + limitedDelta;

  const desiredVelocity = new Phaser.Math.Vector2(Math.cos(newAngle), Math.sin(newAngle)).scale(params.maxSpeed);

  return new Phaser.Math.Vector2(
    moveTowards(currentVelocity.x, desiredVelocity.x, params.maxAcceleration * dtSeconds),
    moveTowards(currentVelocity.y, desiredVelocity.y, params.maxAcceleration * dtSeconds)
  );
}
