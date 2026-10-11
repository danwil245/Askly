import { z } from 'zod';
import * as authService from '../services/authService.js';
import {
  checkLoginAllowed,
  recordLoginFailure,
  clearLoginFailures,
} from '../middleware/antiSpam.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(200),
});

export const googleSchema = z.object({
  idToken: z.string().min(1, 'Missing Google credential'),
});

export async function signup(req, res, next) {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  const { email } = req.body;
  try {
    checkLoginAllowed(email); // per-email failed-attempt throttle
    const result = await authService.login(req.body);
    clearLoginFailures(email);
    res.json(result);
  } catch (err) {
    if (err instanceof AppError && err.code === ERROR_CODES.INVALID_CREDENTIALS) {
      recordLoginFailure(email);
    }
    next(err);
  }
}

export async function google(req, res, next) {
  try {
    const result = await authService.googleSignIn(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
