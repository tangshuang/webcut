import { WebCutBaseTransition, WebCutTransitionConfig } from './base-transition';

/**
 * WebGL转场效果基类
 * 提供WebGL相关的工具函数和基础实现
 */
abstract class WebGLTransition extends WebCutBaseTransition {
  protected canvas: OffscreenCanvas | null = null;
  protected gl: WebGL2RenderingContext | null = null;
  protected programs: Map<string, WebGLProgram> = new Map();
  protected textures: WebGLTexture[] = [];

  /**
   * 初始化WebGL上下文
   */
  protected initWebGL(width: number, height: number): void {
    if (!this.canvas || this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas = new OffscreenCanvas(width, height);
      this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl') as WebGL2RenderingContext;

      if (!this.gl) {
        throw new Error('WebGL not supported');
      }
    }
  }

  /**
   * 创建着色器
   */
  protected createShader(type: number, source: string): WebGLShader {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Shader compilation error: ${gl.getShaderInfoLog(shader)}`);
    }

    return shader;
  }

  /**
   * 创建着色器程序
   */
  protected createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl!;
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program linking error: ${gl.getProgramInfoLog(program)}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  /**
   * 创建纹理
   */
  protected createTexture(): WebGLTexture {
    const gl = this.gl!;
    const texture = gl.createTexture()!;
    this.textures.push(texture);
    return texture;
  }

  /**
   * 设置纹理数据
   */
  protected setupTexture(texture: WebGLTexture, frame: VideoFrame): void {
    const gl = this.gl!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame);
  }

  /**
   * 释放资源
   */
  dispose(): void {
    if (this.gl) {
      this.programs.forEach(program => {
        this.gl!.deleteProgram(program);
      });
      this.textures.forEach(texture => {
        this.gl!.deleteTexture(texture);
      });
      this.programs.clear();
      this.textures = [];
      this.gl = null;
    }
    this.canvas = null;
  }
}

// 顶点着色器源码
const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_texcoord;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texcoord = vec2((a_position.x + 1.0) / 2.0, 1.0 - (a_position.y + 1.0) / 2.0);
  }
`;

// 淡入淡出转场效果
export class FadeTransition extends WebGLTransition {
  name = 'fade';
  title = '淡入淡出';
  defaultDuration = 1000000; // 1秒
  defaultConfig: WebCutTransitionConfig = {};

  async apply(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number,
    _config: WebCutTransitionConfig
  ): Promise<VideoFrame> {
    const width = frame1.displayWidth;
    const height = frame1.displayHeight;

    // 初始化WebGL
    this.initWebGL(width, height);
    const gl = this.gl!;

    // 片段着色器源码
    const fragmentShaderSource = `
      precision highp float;
      varying vec2 v_texcoord;
      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform float u_progress;

      void main() {
        vec4 color1 = texture2D(u_texture1, v_texcoord);
        vec4 color2 = texture2D(u_texture2, v_texcoord);
        gl_FragColor = mix(color1, color2, u_progress);
      }
    `;

    // 创建或获取着色器程序
    let program = this.programs.get('fade');
    if (!program) {
      program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      this.programs.set('fade', program);
    }

    // 设置顶点缓冲区
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    // 使用着色器程序
    gl.useProgram(program);

    // 设置顶点属性
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 创建纹理
    const texture1 = this.createTexture();
    const texture2 = this.createTexture();

    // 设置纹理数据
    this.setupTexture(texture1, frame1);
    this.setupTexture(texture2, frame2);

    // 设置纹理采样器
    const texture1Location = gl.getUniformLocation(program, 'u_texture1');
    const texture2Location = gl.getUniformLocation(program, 'u_texture2');
    gl.uniform1i(texture1Location, 0);
    gl.uniform1i(texture2Location, 1);

    // 设置进度值
    const progressLocation = gl.getUniformLocation(program, 'u_progress');
    gl.uniform1f(progressLocation, progress);

    // 激活纹理单元
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);

    // 绘制
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 创建输出帧
    const outputFrame = new VideoFrame(this.canvas!, {
      timestamp: frame1.timestamp,
      duration: frame1.duration || undefined,
    });

    // 清理资源
    gl.deleteBuffer(positionBuffer);
    gl.deleteTexture(texture1);
    gl.deleteTexture(texture2);
    this.textures = this.textures.filter(t => t !== texture1 && t !== texture2);

    return outputFrame;
  }
}

// 滑动转场效果
export class SlideTransition extends WebGLTransition {
  name = 'slide';
  title = '滑动';
  defaultDuration = 1000000; // 1秒
  defaultConfig: WebCutTransitionConfig = {
    direction: 'left' // left, right, up, down
  };

  async apply(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number,
    config: WebCutTransitionConfig
  ): Promise<VideoFrame> {
    const width = frame1.displayWidth;
    const height = frame1.displayHeight;
    const direction = config.direction || this.defaultConfig.direction;

    // 初始化WebGL
    this.initWebGL(width, height);
    const gl = this.gl!;

    // 片段着色器源码
    const fragmentShaderSource = `
      precision highp float;
      varying vec2 v_texcoord;
      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform float u_progress;
      uniform int u_direction;

      void main() {
        vec2 coord = v_texcoord;
        float alpha = 0.0;

        // 0: left, 1: right, 2: up, 3: down
        if (u_direction == 0) {
          // 向左滑动: frame2 从右侧进入，覆盖 frame1
          alpha = step(coord.x, u_progress);
          vec4 color1 = texture2D(u_texture1, coord + vec2(u_progress, 0.0));
          vec4 color2 = texture2D(u_texture2, coord);
          gl_FragColor = mix(color1, color2, alpha);
        } else if (u_direction == 1) {
          // 向右滑动: frame2 从左侧进入，覆盖 frame1
          alpha = step(1.0 - u_progress, coord.x);
          vec4 color1 = texture2D(u_texture1, coord - vec2(u_progress, 0.0));
          vec4 color2 = texture2D(u_texture2, coord);
          gl_FragColor = mix(color1, color2, alpha);
        } else if (u_direction == 2) {
          // 向上滑动: frame2 从底部进入，覆盖 frame1
          alpha = step(coord.y, u_progress);
          vec4 color1 = texture2D(u_texture1, coord + vec2(0.0, u_progress));
          vec4 color2 = texture2D(u_texture2, coord);
          gl_FragColor = mix(color1, color2, alpha);
        } else {
          // 向下滑动: frame2 从顶部进入，覆盖 frame1
          alpha = step(1.0 - u_progress, coord.y);
          vec4 color1 = texture2D(u_texture1, coord - vec2(0.0, u_progress));
          vec4 color2 = texture2D(u_texture2, coord);
          gl_FragColor = mix(color1, color2, alpha);
        }
      }
    `;

    // 创建或获取着色器程序
    let program = this.programs.get('slide');
    if (!program) {
      program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      this.programs.set('slide', program);
    }

    // 设置顶点缓冲区
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    // 使用着色器程序
    gl.useProgram(program);

    // 设置顶点属性
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 创建纹理
    const texture1 = this.createTexture();
    const texture2 = this.createTexture();

    // 设置纹理数据
    this.setupTexture(texture1, frame1);
    this.setupTexture(texture2, frame2);

    // 设置纹理采样器
    const texture1Location = gl.getUniformLocation(program, 'u_texture1');
    const texture2Location = gl.getUniformLocation(program, 'u_texture2');
    gl.uniform1i(texture1Location, 0);
    gl.uniform1i(texture2Location, 1);

    // 设置进度值
    const progressLocation = gl.getUniformLocation(program, 'u_progress');
    gl.uniform1f(progressLocation, progress);

    // 设置方向
    const directionMap = { left: 0, right: 1, up: 2, down: 3 };
    const directionLocation = gl.getUniformLocation(program, 'u_direction');
    gl.uniform1i(directionLocation, directionMap[direction as keyof typeof directionMap] || 0);

    // 激活纹理单元
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);

    // 绘制
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 创建输出帧
    const outputFrame = new VideoFrame(this.canvas!, {
      timestamp: frame1.timestamp,
      duration: frame1.duration || undefined,
    });

    // 清理资源
    gl.deleteBuffer(positionBuffer);
    gl.deleteTexture(texture1);
    gl.deleteTexture(texture2);
    this.textures = this.textures.filter(t => t !== texture1 && t !== texture2);

    return outputFrame;
  }
}

// 缩放转场效果
export class ZoomTransition extends WebGLTransition {
  name = 'zoom';
  title = '缩放';
  defaultDuration = 1000000; // 1秒
  defaultConfig: WebCutTransitionConfig = {
    direction: 'in' // in, out
  };

  async apply(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number,
    config: WebCutTransitionConfig
  ): Promise<VideoFrame> {
    const width = frame1.displayWidth;
    const height = frame1.displayHeight;
    const direction = config.direction || this.defaultConfig.direction;

    // 初始化WebGL
    this.initWebGL(width, height);
    const gl = this.gl!;

    // 片段着色器源码
    const fragmentShaderSource = `
      precision highp float;
      varying vec2 v_texcoord;
      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform float u_progress;
      uniform bool u_zoomIn;

      // 优化的 ease-in-out 曲线，使用四次方曲线实现更平滑的过渡
      float easeInOutQuartic(float t) {
        return t < 0.5 ? 8.0 * t * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 4.0) / 2.0;
      }

      void main() {
        vec2 center = vec2(0.5, 0.5);
        vec2 coord = v_texcoord;

        // 使用更平滑的四次方缓动曲线
        float t = easeInOutQuartic(u_progress);

        // 缩放参数
        float maxZoom = 1.2;
        float minZoom = 0.8;
        float midZoom = 1.0;
        float fadeRange = maxZoom - midZoom;

        float zoom1, zoom2;

        if (u_zoomIn) {
          // 放大转场：
          // frame1: 从正常大小缩小到 minZoom
          // frame2: 从 maxZoom 缩小到正常大小
          zoom1 = midZoom - t * (midZoom - minZoom); // 1.0 → 0.8
          zoom2 = maxZoom - t * fadeRange; // 1.2 → 1.0
        } else {
          // 缩小转场：
          // frame1: 从 maxZoom 缩小到正常大小
          // frame2: 从正常大小放大到 maxZoom
          zoom1 = maxZoom - t * fadeRange; // 1.2 → 1.0
          zoom2 = midZoom + t * fadeRange; // 1.0 → 1.2
        }

        // 计算纹理坐标，确保中心点固定
        vec2 coord1 = center + (coord - center) / zoom1;
        vec2 coord2 = center + (coord - center) / zoom2;

        // 严格限制纹理坐标在 [0.0, 1.0] 范围内，防止越界采样
        vec2 clampedCoord1 = clamp(coord1, 0.0, 1.0);
        vec2 clampedCoord2 = clamp(coord2, 0.0, 1.0);

        // 采样纹理
        vec4 color1 = texture2D(u_texture1, clampedCoord1);
        vec4 color2 = texture2D(u_texture2, clampedCoord2);

        // 使用原始进度进行混合，确保过渡与视觉效果同步
        gl_FragColor = mix(color1, color2, u_progress);
      }
    `;

    // 创建或获取着色器程序
    let program = this.programs.get('zoom');
    if (!program) {
      program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      this.programs.set('zoom', program);
    }

    // 设置顶点缓冲区
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    // 使用着色器程序
    gl.useProgram(program);

    // 设置顶点属性
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 创建纹理
    const texture1 = this.createTexture();
    const texture2 = this.createTexture();

    // 设置纹理数据
    this.setupTexture(texture1, frame1);
    this.setupTexture(texture2, frame2);

    // 设置纹理采样器
    const texture1Location = gl.getUniformLocation(program, 'u_texture1');
    const texture2Location = gl.getUniformLocation(program, 'u_texture2');
    gl.uniform1i(texture1Location, 0);
    gl.uniform1i(texture2Location, 1);

    // 设置进度值
    const progressLocation = gl.getUniformLocation(program, 'u_progress');
    gl.uniform1f(progressLocation, progress);

    // 设置缩放方向
    const zoomInLocation = gl.getUniformLocation(program, 'u_zoomIn');
    gl.uniform1i(zoomInLocation, direction === 'in' ? 1 : 0);

    // 激活纹理单元
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);

    // 绘制
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 创建输出帧
    const outputFrame = new VideoFrame(this.canvas!, {
      timestamp: frame1.timestamp,
      duration: frame1.duration || undefined,
    });

    // 清理资源
    gl.deleteBuffer(positionBuffer);
    gl.deleteTexture(texture1);
    gl.deleteTexture(texture2);
    this.textures = this.textures.filter(t => t !== texture1 && t !== texture2);

    return outputFrame;
  }
}

// 百叶窗转场效果
export class BlindsTransition extends WebGLTransition {
  name = 'blinds';
  title = '百叶窗';
  defaultDuration = 1000000; // 1秒
  defaultConfig: WebCutTransitionConfig = {
    count: 10, // 百叶窗数量
    direction: 'horizontal' // horizontal, vertical
  };

  async apply(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number,
    config: WebCutTransitionConfig
  ): Promise<VideoFrame> {
    const width = frame1.displayWidth;
    const height = frame1.displayHeight;
    const count = config.count || this.defaultConfig.count;
    const direction = config.direction || this.defaultConfig.direction;

    // 初始化WebGL
    this.initWebGL(width, height);
    const gl = this.gl!;

    // 片段着色器源码
    const fragmentShaderSource = `
      precision highp float;
      varying vec2 v_texcoord;
      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform float u_progress;
      uniform float u_count;
      uniform bool u_horizontal;

      void main() {
        vec2 coord = v_texcoord;
        float size = 1.0 / u_count;
        float index;
        float position;
        float alpha;

        if (u_horizontal) {
          // 水平百叶窗：垂直条纹
          index = floor(coord.x / size);
          position = fract(coord.x / size);

          // 偶数索引条纹从左到右显示frame2，奇数索引条纹从右到左显示frame2
          if (mod(index, 2.0) == 0.0) {
            alpha = step(position, u_progress);
          } else {
            alpha = step(1.0 - position, u_progress);
          }
        } else {
          // 垂直百叶窗：水平条纹
          index = floor(coord.y / size);
          position = fract(coord.y / size);

          // 偶数索引条纹从上到下显示frame2，奇数索引条纹从下到上显示frame2
          if (mod(index, 2.0) == 0.0) {
            alpha = step(position, u_progress);
          } else {
            alpha = step(1.0 - position, u_progress);
          }
        }

        vec4 color1 = texture2D(u_texture1, coord);
        vec4 color2 = texture2D(u_texture2, coord);

        gl_FragColor = mix(color1, color2, alpha);
      }
    `;

    // 创建或获取着色器程序
    let program = this.programs.get('blinds');
    if (!program) {
      program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      this.programs.set('blinds', program);
    }

    // 设置顶点缓冲区
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    // 使用着色器程序
    gl.useProgram(program);

    // 设置顶点属性
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 创建纹理
    const texture1 = this.createTexture();
    const texture2 = this.createTexture();

    // 设置纹理数据
    this.setupTexture(texture1, frame1);
    this.setupTexture(texture2, frame2);

    // 设置纹理采样器
    const texture1Location = gl.getUniformLocation(program, 'u_texture1');
    const texture2Location = gl.getUniformLocation(program, 'u_texture2');
    gl.uniform1i(texture1Location, 0);
    gl.uniform1i(texture2Location, 1);

    // 设置进度值
    const progressLocation = gl.getUniformLocation(program, 'u_progress');
    gl.uniform1f(progressLocation, progress);

    // 设置百叶窗数量
    const countLocation = gl.getUniformLocation(program, 'u_count');
    gl.uniform1f(countLocation, count);

    // 设置方向
    const horizontalLocation = gl.getUniformLocation(program, 'u_horizontal');
    gl.uniform1i(horizontalLocation, direction === 'horizontal' ? 1 : 0);

    // 激活纹理单元
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);

    // 绘制
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 创建输出帧
    const outputFrame = new VideoFrame(this.canvas!, {
      timestamp: frame1.timestamp,
      duration: frame1.duration || undefined,
    });

    // 清理资源
    gl.deleteBuffer(positionBuffer);
    gl.deleteTexture(texture1);
    gl.deleteTexture(texture2);
    this.textures = this.textures.filter(t => t !== texture1 && t !== texture2);

    return outputFrame;
  }
}

// 溶解转场效果
// @ts-ignore
export class DissolveTransition extends WebGLTransition {
  name = 'dissolve';
  title = '溶解';
  defaultDuration = 1000000; // 1秒
  defaultConfig: WebCutTransitionConfig = {
    seed: 12345 // 随机种子
  };

  async apply(
    frame1: VideoFrame,
    frame2: VideoFrame,
    progress: number,
    config: WebCutTransitionConfig
  ): Promise<VideoFrame> {
    const width = frame1.displayWidth;
    const height = frame1.displayHeight;
    const seed = config.seed || this.defaultConfig.seed;

    // 初始化WebGL
    this.initWebGL(width, height);
    const gl = this.gl!;

    // 片段着色器源码 - 包含简单的随机函数
    const fragmentShaderSource = `
      precision highp float;
      varying vec2 v_texcoord;
      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform float u_progress;
      uniform float u_seed;

      // 简单的随机函数
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      void main() {
        vec2 coord = v_texcoord;
        float rnd = random(coord + u_seed);
        float alpha = step(rnd, u_progress);

        vec4 color1 = texture2D(u_texture1, coord);
        vec4 color2 = texture2D(u_texture2, coord);

        gl_FragColor = mix(color1, color2, alpha);
      }
    `;

    // 创建或获取着色器程序
    let program = this.programs.get('dissolve');
    if (!program) {
      program = this.createProgram(vertexShaderSource, fragmentShaderSource);
      this.programs.set('dissolve', program);
    }

    // 设置顶点缓冲区
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    // 使用着色器程序
    gl.useProgram(program);

    // 设置顶点属性
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 创建纹理
    const texture1 = this.createTexture();
    const texture2 = this.createTexture();

    // 设置纹理数据
    this.setupTexture(texture1, frame1);
    this.setupTexture(texture2, frame2);

    // 设置纹理采样器
    const texture1Location = gl.getUniformLocation(program, 'u_texture1');
    const texture2Location = gl.getUniformLocation(program, 'u_texture2');
    gl.uniform1i(texture1Location, 0);
    gl.uniform1i(texture2Location, 1);

    // 设置进度值
    const progressLocation = gl.getUniformLocation(program, 'u_progress');
    gl.uniform1f(progressLocation, progress);

    // 设置随机种子
    const seedLocation = gl.getUniformLocation(program, 'u_seed');
    gl.uniform1f(seedLocation, seed as number);

    // 激活纹理单元
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);

    // 绘制
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 创建输出帧
    const outputFrame = new VideoFrame(this.canvas!, {
      timestamp: frame1.timestamp,
      duration: frame1.duration || undefined,
    });

    // 清理资源
    gl.deleteBuffer(positionBuffer);
    gl.deleteTexture(texture1);
    gl.deleteTexture(texture2);
    this.textures = this.textures.filter(t => t !== texture1 && t !== texture2);

    return outputFrame;
  }
}
