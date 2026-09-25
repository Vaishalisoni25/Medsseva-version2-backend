declare module 'compression' {
  import { Request, Response, NextFunction } from 'express';
  namespace compression {
    interface CompressionOptions {
      chunkSize?: number;
      filter?: (req: any, res: any) => boolean;
      level?: number;
      memLevel?: number;
      strategy?: number;
      threshold?: number | string;
      windowBits?: number;
      flush?: number;
      finishFlush?: number;
    }
    function filter(req: any, res: any): boolean;
  }
  function compression(options?: compression.CompressionOptions): (req: Request, res: Response, next: NextFunction) => void;
  export = compression;
}
