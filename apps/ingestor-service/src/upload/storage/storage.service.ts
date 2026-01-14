export abstract class StorageService {
  abstract saveTemp(file: Express.Multer.File): Promise<{ storageUri: string; localPath?: string }>;
}
