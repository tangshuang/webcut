// @ts-ignore
import BFM from 'browser-md5-file';

/**
 * 将 base64 数据转换为 File 对象
 * @param base64 base64 数据
 * @param filename 文件名
 * @param mimeType 文件类型
 * @returns File 对象
 */
export function base64ToFile(base64: string, filename: string, mimeType: string): File {
  const arr = base64.split(',');
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mimeType });
}

/**
 * 将 Blob 对象转换为 base64 数据 URL
 * @param blob Blob 对象
 * @returns base64 数据 URL
 */
export function blobToBase64DataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 File 对象转换为 base64 数据 URL
 * @param file File 对象
 * @returns base64 数据 URL
 */
export function fileToBase64DataURL(file: File): Promise<string> {
  return blobToBase64DataURL(file);
}

export function downloadBlob(blob: Blob, filename: string) {
    const URL = (window.URL || window.webkitURL);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 10000);
}


export function getFileMd5(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        new BFM().md5(file, (err: Error, md5: string) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(md5);
        });
    });
}

export function blobToFile(blob: Blob, fileName: string) {
    return new File([blob], fileName, { type: blob.type });
}
