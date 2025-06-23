import { GlContext } from "../../gl/gl-context.ts";
import { GlUtil } from "../../gl/gl-util.ts";
import { Snowball } from "./snowball.ts";
import { Matrices } from "../../math/matrices.ts";
import { ShaderFactory, ShaderLightSettings } from "../shader-factory.ts";
import { Shaders } from "../../gl/shaders.ts";
import { Settings } from "../../settings.ts";

export class SnowballRenderer {
  private static readonly VERTEX_SHADER = `#version 300 es

in vec4 a_Position;

uniform mat4 u_ModelViewMatrix;
uniform mat4 u_ProjectionMatrix;

$$lighting-function$$

out vec3 v_LightColor;
out float v_FogFactor;

void main() {
  vec4 eyePosition = u_ModelViewMatrix * a_Position;
  gl_Position = u_ProjectionMatrix * eyePosition;
  
  v_LightColor = vec3(1.0); // Snowballs are white
  v_FogFactor = computeFogFactor(eyePosition);
}
`;

  private static readonly FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 v_LightColor;
in float v_FogFactor;

out vec4 outColor;

$$lighting-function$$

void main() {
  vec4 snowballColor = vec4(0.95, 0.95, 1.0, 1.0); // Slightly blue-white
  outColor = computeFinalColor(snowballColor);
}
`;

  private static readonly SHADER_LIGHT_SETTINGS: ShaderLightSettings = {
    useMaterial: false,
    useStaticNormal: false,
    useNormalMatrix: false,
  };

  private shader: WebGLProgram;
  private modelViewMatrixUniformLocation: WebGLUniformLocation;
  private projectionMatrixUniformLocation: WebGLUniformLocation;
  private vertexArray: WebGLVertexArrayObject;
  private numIndices: number;

  public async init(): Promise<void> {
    const gl = GlContext.gl;

    this.shader = ShaderFactory.createShader(
      SnowballRenderer.VERTEX_SHADER,
      SnowballRenderer.FRAGMENT_SHADER,
      SnowballRenderer.SHADER_LIGHT_SETTINGS,
      gl,
    );

    [
      this.modelViewMatrixUniformLocation,
      this.projectionMatrixUniformLocation,
    ] = Shaders.getUniformLocations(
      this.shader,
      gl,
      "u_ModelViewMatrix",
      "u_ProjectionMatrix",
    );

    const [positionAttributeLocation] = Shaders.getAttributeLocations(
      this.shader,
      gl,
      "a_Position",
    );

    // Create sphere geometry for snowball
    const { positions, indices } = this.createSphereGeometry(0.3, 8, 6);
    this.numIndices = indices.length;

    this.vertexArray = GlUtil.createAndBindVertexArray(gl);
    GlUtil.bindPositions(positions, positionAttributeLocation, gl);
    GlUtil.bindIndices(indices, gl);
  }

  public draw(snowballs: Snowball[], gl: WebGL2RenderingContext): void {
    if (snowballs.length === 0) return;

    gl.useProgram(this.shader);

    gl.uniformMatrix4fv(
      this.projectionMatrixUniformLocation,
      false,
      GlContext.perspectiveMatrix,
    );

    gl.bindVertexArray(this.vertexArray);

    snowballs.forEach((snowball) => {
      if (!snowball.active || !this.isInClipDistance(snowball)) {
        return;
      }

      GlContext.modelViewMatrix.push();

      GlContext.modelViewMatrix.multiply(
        Matrices.createTranslation(...snowball.position),
      );

      gl.uniformMatrix4fv(
        this.modelViewMatrixUniformLocation,
        false,
        GlContext.modelViewMatrix.current,
      );

      gl.drawElements(
        gl.TRIANGLES,
        this.numIndices,
        gl.UNSIGNED_SHORT,
        0,
      );

      GlContext.modelViewMatrix.pop();
    });
  }

  private isInClipDistance(snowball: Snowball): boolean {
    const viewZ = GlContext.cameraPosition[2];
    const snowballZ = snowball.position[2];
    if (viewZ - snowballZ > Settings.FAR_CLIPPING_DISTANCE) {
      return false;
    }
    return snowballZ - viewZ <= Settings.BACKWARD_CLIPPING_DISTANCE;
  }

  private createSphereGeometry(
    radius: number,
    widthSegments: number,
    heightSegments: number,
  ): { positions: number[]; indices: number[] } {
    const positions: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y <= heightSegments; y++) {
      const v = y / heightSegments;
      const phi = v * Math.PI;

      for (let x = 0; x <= widthSegments; x++) {
        const u = x / widthSegments;
        const theta = u * Math.PI * 2;

        const xPos = -radius * Math.cos(theta) * Math.sin(phi);
        const yPos = radius * Math.cos(phi);
        const zPos = radius * Math.sin(theta) * Math.sin(phi);

        positions.push(xPos, yPos, zPos);
      }
    }

    for (let y = 0; y < heightSegments; y++) {
      for (let x = 0; x < widthSegments; x++) {
        const a = (widthSegments + 1) * y + x;
        const b = (widthSegments + 1) * (y + 1) + x;
        const c = (widthSegments + 1) * (y + 1) + (x + 1);
        const d = (widthSegments + 1) * y + (x + 1);

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    return { positions, indices };
  }
}
