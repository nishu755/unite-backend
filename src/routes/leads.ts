import { Router } from 'express';
import { LeadController } from '../controllers/leadController';
import { authenticate } from '../middlewares/auth';
import { isAdminOrManager } from '../middlewares/rbac';
import { validate, schemas } from '../middlewares/validation';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);


router.get(
    '/stats',
    isAdminOrManager,
    asyncHandler(LeadController.getStats)
);


router.get(
    '/search',
    asyncHandler(LeadController.search)
);


router.post(
    '/image-upload-url',
    validate(schemas.imageUploadUrl),
    asyncHandler(LeadController.getImageUploadUrl)
);


router.get(
    '/',
    asyncHandler(LeadController.getAll)
);


router.post(
    '/',
    validate(schemas.createLead),
    asyncHandler(LeadController.create)
);


router.get(
    '/:id',
    asyncHandler(LeadController.getById)
);

router.put(
    '/:id',
    validate(schemas.updateLead),
    asyncHandler(LeadController.update)
);


router.delete(
    '/:id',
    isAdminOrManager,
    asyncHandler(LeadController.delete)
);


router.post(
    '/:id/assign',
    isAdminOrManager,
    validate(schemas.assignLead),
    asyncHandler(LeadController.assign)
);

export default router;