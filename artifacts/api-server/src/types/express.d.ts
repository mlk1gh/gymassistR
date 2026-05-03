declare namespace Express {
  interface Request {
    userId: string;
    userIsAdmin?: boolean;
  }
}
