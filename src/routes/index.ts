import { Router } from 'express';
import authRoutes from './auth';
import leadRoutes from './leads';
import callTaskRoutes from './callTasks';
import csvRoutes from './csv';
import reportRoutes from './reports';

const router = Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/call-tasks', callTaskRoutes);
router.use('/csv', csvRoutes);
router.use('/reports', reportRoutes);

export default router;