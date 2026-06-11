import { Request, Response, NextFunction, RequestHandler } from 'express'

// Capture les rejets de promesse des handlers async et les transmet au
// middleware d'erreurs global (sinon Express ne les intercepte pas).
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
