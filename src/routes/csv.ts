import { Router } from 'express';
import { CsvController } from '../controllers/csvController';
import { authenticate } from '../middlewares/auth';
import { isAdminOrManager } from '../middlewares/rbac';
import { asyncHandler } from '../middlewares/errorHandler';
import multer from 'multer';

const router = Router();

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// All routes require authentication (Admin/Manager only)
router.use(authenticate);
router.use(isAdminOrManager);


router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(CsvController.upload)
);


router.get(
  '/:id/status',
  asyncHandler(CsvController.getStatus)
);

router.get(
  '/history',
  asyncHandler(CsvController.getHistory)
);

export default router;