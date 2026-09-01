import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
try {
  
      schema.parse(req.body);
      next();
    } catch (error: any) {
if (error instanceof ZodError || (error as any)?.errors) {
        const issues = (error as any).errors ?? (error as any).issues ?? [];
        return res.status(400).json({
          error: 'Validation failed',
          details: Array.isArray(issues) ? issues.map((e: any) => ({
            field: Array.isArray(e.path) ? e.path.join('.') : '',
            message: e.message
          })) : []
        });
      }
      next(error);
    }
  };
};
