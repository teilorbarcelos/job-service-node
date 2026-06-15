export interface StorageProvider {
  name: string;
  saveFile(fileName: string, data: Buffer | string): Promise<string>;
  getFile(fileName: string): Promise<Buffer>;
  deleteFile(fileUrl: string): Promise<void>;
  exists(fileName: string): Promise<boolean>;
  getUrl(fileName: string): string;
  getPresignedUrl?(fileKey: string): Promise<string>;
}
