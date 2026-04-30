const { z } = require('zod');

const email = z.string().trim().toLowerCase().email().max(255);

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const projectCreateSchema = z.object({
  name: z.string().trim().min(3).max(100),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,9}$/, 'Project key must be 2-10 uppercase letters, numbers, or underscores'),
  description: z.string().trim().max(1000).optional().default(''),
});

const projectPatchSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,9}$/)
    .optional(),
  description: z.string().trim().max(1000).optional(),
  archived: z.boolean().optional(),
});

const rolePatchSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

const taskCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(5000).optional().default(''),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional().default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const taskPatchSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

const memberAddSchema = z.object({
  userId: z.string().uuid(),
});

function validate(schema, payload) {
  return schema.parse(payload);
}

module.exports = {
  signupSchema,
  loginSchema,
  projectCreateSchema,
  projectPatchSchema,
  rolePatchSchema,
  taskCreateSchema,
  taskPatchSchema,
  memberAddSchema,
  validate,
};
