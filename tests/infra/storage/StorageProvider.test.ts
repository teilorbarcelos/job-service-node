import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { LocalDriver } from '@/infra/storage/drivers/LocalDriver.js';
import { logger } from '@/shared/utils/logger.js';

vi.mock('fs/promises');

describe('LocalDriver', () => {
  let driver: LocalDriver;
  const uploadDir = 'test-uploads';

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new LocalDriver(uploadDir);
  });

  it('should save a file correctly', async () => {
    const fileName = 'test.txt';
    const data = 'test data';
    const expectedPath = path.join(process.cwd(), uploadDir, fileName);

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await driver.saveFile(fileName, data);

    expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(expectedPath), { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, data);
    expect(result).toBe(`/${uploadDir}/${fileName}`);
  });

  it('should get a file correctly', async () => {
    const fileName = 'test.txt';
    const data = Buffer.from('test data');
    vi.mocked(fs.readFile).mockResolvedValue(data);

    const result = await driver.getFile(fileName);

    expect(result).toBe(data);
    expect(fs.readFile).toHaveBeenCalledWith(path.join(process.cwd(), uploadDir, fileName));
  });

  it('should delete a file correctly', async () => {
    const fileUrl = `/${uploadDir}/test.txt`;
    const expectedPath = path.join(process.cwd(), uploadDir, 'test.txt');

    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    await driver.deleteFile(fileUrl);

    expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
  });

  it('should handle delete failure gracefully', async () => {
    const fileUrl = `/${uploadDir}/test.txt`;
    const loggerSpy = vi.spyOn(logger, 'error');
    
    vi.mocked(fs.unlink).mockRejectedValue(new Error('File not found'));

    await driver.deleteFile(fileUrl);

    expect(loggerSpy).toHaveBeenCalledWith('[Storage System] Falha ao deletar arquivo');
    loggerSpy.mockRestore();
  });

  it('should return early if fileUrl is invalid', async () => {
    await driver.deleteFile('');
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('should check if a file exists', async () => {
    const fileName = 'test.txt';
    vi.mocked(fs.access).mockResolvedValue(undefined);

    const exists = await driver.exists(fileName);

    expect(exists).toBe(true);
    expect(fs.access).toHaveBeenCalledWith(path.join(process.cwd(), uploadDir, fileName));
  });

  it('should return false if file does not exist', async () => {
    const fileName = 'nonexistent.txt';
    vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

    const exists = await driver.exists(fileName);

    expect(exists).toBe(false);
  });

  it('should return a URL correctly', () => {
    const fileName = 'test.txt';
    const result = driver.getUrl(fileName);
    expect(result).toBe(`/${uploadDir}/${fileName}`);
  });

  it('should use default values in constructor', () => {
    const defaultDriver = new LocalDriver();
    expect(defaultDriver.getUrl('test.txt')).toBe('/uploads/test.txt');
  });
});
