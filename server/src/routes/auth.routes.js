import { Router } from 'express';
import {
  signup,
  login,
  google,
  me,
  signupSchema,
  loginSchema,
  googleSchema,
} from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/antiSpam.js';

export const authRouter = Router();

authRouter.post('/signup', authLimiter, validate(signupSchema, 'body'), signup);
authRouter.post('/login', authLimiter, validate(loginSchema, 'body'), login);
authRouter.post('/google', authLimiter, validate(googleSchema, 'body'), google);
authRouter.get('/me', requireAuth, me);
