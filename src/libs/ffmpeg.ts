import { FFmpeg, ProgressEventCallback, LogEventCallback, FFMessageLoadConfig } from '@ffmpeg/ffmpeg';
import {
    fetchFile,
    // toBlobURL
} from '@ffmpeg/util';
import { base64ToBlob } from './file';
import { createRandomString } from 'ts-fns';

import coreURL from '../../ffmpeg.wasm/ffmpeg-core.js?url';
import classWorkerURL from '../../ffmpeg.wasm/ffmpeg.worker.js?url';
import wasmURL from '../../ffmpeg.wasm/ffmpeg-core.wasm?url';

// const coreURL = new URL('./ffmpeg.wasm/ffmpeg-core.js', import.meta.url).href;
// const classWorkerURL = new URL('./ffmpeg.wasm/ffmpeg.worker.js', import.meta.url).href;
// const wasmURL = new URL('./ffmpeg.wasm/ffmpeg-core.wasm', import.meta.url).href;

const createFFmpegLoader = (config: FFMessageLoadConfig & { onLoaded?: (ffmpeg: FFmpeg) => void }) => {
    const { onLoaded, ...sources } = config;
    const ffmpeg = new FFmpeg();
    let isLoaded = -1; // -1: not loaded, 0: loading, 1: loaded
    let setReady: (ffmpeg: FFmpeg) => void;
    const isFFmpegReady = new Promise<FFmpeg>((resolve) => {
        setReady = resolve;
    });
    /**
     * Load FFmpeg. 注意，使用本函数加载ffmpeg后，禁止调用 ffmpeg.terminate 方法，否则无法再次加载
     * @param onLog
     * @returns
     */
    async function loadFFmpeg(onLog?: ProgressEventCallback | LogEventCallback): Promise<FFmpeg> {
        if (onLog) {
            ffmpeg.on('log', onLog as LogEventCallback);
            ffmpeg.on('progress', onLog as ProgressEventCallback);
        }

        const unlisten = () => {
            if (onLog) {
                ffmpeg.off('log', onLog as LogEventCallback);
                ffmpeg.off('progress', onLog as ProgressEventCallback);
            }
        };

        if (isLoaded === 1) {
            unlisten();
            return await isFFmpegReady;
        }

        if (isLoaded === 0) {
            unlisten();
            return await isFFmpegReady;
        }

        isLoaded = 0;
        try {
            await ffmpeg.load(sources);
            isLoaded = 1;
            setReady(ffmpeg);
            onLoaded?.(ffmpeg);
            return ffmpeg;
        }
        catch (e) {
            isLoaded = -1;
            throw e;
        }
        finally {
            unlisten();
        }
    }

    return loadFFmpeg;
};

/**
 * 加载FFmpeg多线程模式，需要网站配置：
 * 1. 主网站（调用ffmpeg的网站）输出 headers: {
       // 支持SharedArrayBuffer
       // https://github.com/ffmpegwasm/ffmpeg.wasm/issues/263
       'Cross-Origin-Opener-Policy': 'same-origin',
       'Cross-Origin-Embedder-Policy': 'require-corp',
     },
 * 2. 在脚本托管域名（CDN）输出 headers (开启CORS的前提下):
     'Cross-Origin-Resource-Policy': 'cross-origin',
   如果脚本不是托管在CDN上，则无视这一点。
 * 这种方案过于严格，会导致网站加载第三方脚本或图片时失败，因此，我们主要还是用下面的单线程方案
 */
// export const loadFFmpegInMultipleThread = createFFmpegLoader({
//     // coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core-mt.js`, 'text/javascript'),
//     // wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core-mt.wasm`, 'application/wasm'),
//     // workerURL: await toBlobURL(`${BASE_URL}/ffmpeg-core-mt.worker.js`, 'text/javascript'),
//     // classWorkerURL: await toBlobURL(`${BASE_URL}/ffmpeg.worker.js`, 'text/javascript'),
//     coreURL: `${BASE_URL}/ffmpeg-core-mt.js`,
//     wasmURL: `${BASE_URL}/ffmpeg-core-mt.wasm`,
//     workerURL: `${BASE_URL}/ffmpeg-core-mt.worker.js`,
//     classWorkerURL: `${BASE_URL}/ffmpeg.worker.js`,
// });

let isLoaded = false;
export const loadFFmpeg = createFFmpegLoader({
    // coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    // wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
    // classWorkerURL: await toBlobURL(`${BASE_URL}/ffmpeg.worker.js`, 'text/javascript'),
    coreURL,
    wasmURL,
    classWorkerURL,
    onLoaded: () => {
        isLoaded = true;
    },
});

export function isFFmpegLoaded() {
    return isLoaded;
}

export async function execFFmpeg(args: {
    /** 输入文件 */
    input: string | File | Blob;
    /** 辅助，输入文件的格式，例如：mp4, mp3，当无法通过input来获取时，需要传此参数，不过经过观察，大部分情况下都需要传这个参数 */
    inputFormat?: string;
    /** 输出文件的格式，必传，让ffmpeg正确处理 */
    outputFormat?: string;
    /** 处理命令，注意，不要包含输入输出文件名 */
    command: string[] | ((args: { input: string, output: string }) => string[]),
    /** ffmpeg实例 */
    ffmpeg?: FFmpeg,
    /** 日志输出函数 */
    onLog?: ProgressEventCallback | LogEventCallback
}): Promise<{
    /** 输出文件名 */
    output: string;
    /** 输出文件的格式 */
    outputFormat: string;
    /** 输出文件的ArrayBuffer */
    buffer: ArrayBuffer;
    /** 输出文件的大小 */
    size: number;
    /** 输入文件 */
    input: string;
    /** 输入文件的格式 */
    inputFormat: string;
}> {
    const { input, command, inputFormat, outputFormat, onLog } = args;

    let ffmpeg = args.ffmpeg;
    if (!ffmpeg) {
        ffmpeg = await loadFFmpeg();
    }

    let inputExt;
    let inputBuffer;
    if (typeof input === 'string') {
        // dataURL
        if (input.indexOf('data:') === 0) {
            const blob = base64ToBlob(input);
            inputExt = inputFormat;
            inputBuffer = await fetchFile(blob);
        }
        // blob
        else if (input.indexOf('blob:') === 0) {
            inputBuffer = await fetchFile(input);
            inputExt = inputFormat;
        }
        // url
        else {
            const res = await fetch(input);
            const { headers } = res;
            const blob = await res.blob();
            inputBuffer = await fetchFile(blob);
            const [filepath] = input.split('?');
            inputExt = inputFormat || headers.get('X-File-Extension') || filepath.split('.').pop();
        }
    }
    else if (input instanceof File) {
        inputBuffer = await fetchFile(input);
        inputExt = inputFormat || (input as File).name.split('.').pop();
    }
    else {
        inputBuffer = await fetchFile(input);
        inputExt = inputFormat;
    }

    if (onLog) {
        ffmpeg.on('log', onLog as LogEventCallback);
        ffmpeg.on('progress', onLog as ProgressEventCallback);
    }

    const inputFileName = `${createRandomString(8)}.${inputExt}`;
    await ffmpeg.writeFile(inputFileName, inputBuffer);

    const outputExt = outputFormat || inputExt;
    const outputFileName = `${createRandomString(8)}.${outputExt}`;
    const argv = typeof command === 'function' ? command({ input: inputFileName, output: outputFileName }) : ['-i', inputFileName, ...command, outputFileName];
    await ffmpeg.exec(argv);

    const data = await ffmpeg.readFile(outputFileName);

    if (onLog) {
        ffmpeg.off('log', onLog as LogEventCallback);
        ffmpeg.off('progress', onLog as ProgressEventCallback);
    }

    await ffmpeg.deleteFile(outputFileName);
    await ffmpeg.deleteFile(inputFileName);

    // @ts-ignore
    const arrbuff = data.buffer;

    return {
        buffer: arrbuff,
        size: arrbuff.byteLength,
        input: inputFileName,
        output: outputFileName,
        inputFormat : inputExt!,
        outputFormat: outputExt!,
    };
}

export async function runFFmpeg(args: Parameters<typeof execFFmpeg>[0]): Promise<ArrayBuffer> {
    const { buffer } = await execFFmpeg(args);
    return buffer;
}

/**
 * 转码为MP4
 * @param inputFileSource 输入文件源，支持URL、File对象或Blob对象
 * @param ffmpeg FFmpeg实例，可选，默认会加载FFmpeg
 * @param onLog 日志输出函数，可选
 * @returns 转码后的MP4文件的ArrayBuffer
 */
export async function transcodeToMP4ByFFmpeg(inputFileSource: string | File | Blob, ffmpeg?: FFmpeg, onLog?: ProgressEventCallback | LogEventCallback): Promise<ArrayBuffer> {
    return await runFFmpeg({
        input: inputFileSource,
        outputFormat: 'mp4',
        command: ({ input, output }) => [
            '-i', input,
            '-c',
            'copy',
            '-movflags',
            'faststart',
            output,
        ],
        ffmpeg,
        onLog,
    });
}

/**
 * 从视频中提取音频
 * @param inputFileSource
 * @param ffmpeg
 * @param onLog
 * @returns
 */
export async function extractAudioFromVideo(inputFileSource: string | File | Blob, ffmpeg?: FFmpeg, onLog?: ProgressEventCallback | LogEventCallback): Promise<ArrayBuffer> {
    return await runFFmpeg({
        input: inputFileSource,
        outputFormat: 'mp3',
        command: ({ input, output }) => [
            '-i', input,
            '-vn',
            '-c:a', 'libmp3lame',
            '-q:a', '1',
            output,
        ],
        ffmpeg,
        onLog,
    });
}

/**
 * 截取音/视频文件
 */
export async function sliceByFFmpeg(inputFileSource: string | File | Blob, start: number, duration: number, ffmpeg?: FFmpeg, onLog?: ProgressEventCallback | LogEventCallback): Promise<ArrayBuffer> {
    return await runFFmpeg({
        input: inputFileSource,
        command: ({ input, output }) => [
            '-i', input,
            '-ss', start.toString(),
            '-t', duration.toString(),
            '-c', 'copy',
            output,
        ],
        ffmpeg,
        onLog,
    });
}
