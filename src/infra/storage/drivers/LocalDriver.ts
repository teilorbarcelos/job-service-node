import fs from 'fs/promises';
import path from 'path';
import { StorageProvider } from '../StorageProvider.js';
import { logger } from '../../../shared/utils/logger.js';

export class LocalDriver implements StorageProvider {
  readonly name = 'Local';
  private uploadDir: string;
  private baseUrl: string;

  constructor(uploadDir: string = 'uploads', baseUrl: string = '') {
    this.uploadDir = uploadDir;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async saveFile(fileName: string, data: Buffer | string): Promise<string> {
    const fullPath = path.join(process.cwd(), this.uploadDir, fileName);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return `${this.baseUrl}/${this.uploadDir}/${fileName}`.replace(/\/+/g, '/');
  }

  async getFile(fileName: string): Promise<Buffer> {
    const fullPath = path.join(process.cwd(), this.uploadDir, fileName);
    return fs.readFile(fullPath);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const fileName = fileUrl.split('/').pop();
    if (!fileName) return;
    const fullPath = path.join(process.cwd(), this.uploadDir, fileName);
    try {
      await fs.unlink(fullPath);
    } catch {
      logger.error('[Storage System] Falha ao deletar arquivo');
    }
  }

  async exists(fileName: string): Promise<boolean> {
    const fullPath = path.join(process.cwd(), this.uploadDir, fileName);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(fileName: string): string {
    return `${this.baseUrl}/${this.uploadDir}/${fileName}`.replace(/\/+/g, '/');
  }
}
