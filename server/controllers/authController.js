import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { config } from '../config/env.js';

const signupSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(100) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email });
const tokenFor = (user) => jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: '7d' });

export async function signup(req, res) {
  const input = signupSchema.parse(req.body);
  const email = input.email.toLowerCase();
  if (await User.exists({ email })) throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
  let user;
  try { user = await User.create({ name: input.name, email, passwordHash: await bcrypt.hash(input.password, 12) }); }
  catch (error) { if (error?.code === 11000) throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS'); throw error; }
  res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
}

export async function login(req, res) {
  const input = loginSchema.parse(req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new AppError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  res.json({ user: publicUser(user), token: tokenFor(user) });
}

export async function me(req, res) {
  const user = await User.findById(req.auth.sub);
  if (!user) throw new AppError(401, 'Account no longer exists', 'UNAUTHORIZED');
  res.json({ user: publicUser(user) });
}
