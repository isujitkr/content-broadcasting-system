const express = require('express');
const router = express.Router();

const ContentController = require('../controllers/content.controller');
const { authenticate, principalOnly, teacherOnly, staffOnly } = require('../middlewares/auth.middleware');
const { publicBroadcastLimiter } = require('../middlewares/rateLimiter.middleware');
const {
  uploadContentValidator,
  approveContentValidator,
  rejectContentValidator,
  contentListQueryValidator,
} = require('../middlewares/validation.middleware');
const upload = require('../middlewares/multer.middleware');

router.get(
  '/live/:teacherIdentifier',
  publicBroadcastLimiter,
  ContentController.getLiveContent
);

router.get('/subjects', authenticate, staffOnly, ContentController.getSubjects);

router.post(
  '/upload',
  authenticate,
  teacherOnly,
  upload.single('file'),
  uploadContentValidator,
  ContentController.upload
);

router.get(
  '/my',
  authenticate,
  teacherOnly,
  contentListQueryValidator,
  ContentController.getMyContent
);

router.get(
  '/all',
  authenticate,
  principalOnly,
  contentListQueryValidator,
  ContentController.getAllContent
);

router.get(
  '/pending',
  authenticate,
  principalOnly,
  contentListQueryValidator,
  ContentController.getPendingContent
);

router.get(
  '/broadcast/overview',
  authenticate,
  principalOnly,
  ContentController.getAllLiveContent
);

router.get('/:id', authenticate, staffOnly, ContentController.getContentById);

router.patch(
  '/:id/approve',
  authenticate,
  principalOnly,
  approveContentValidator,
  ContentController.approveContent
);

router.patch(
  '/:id/reject',
  authenticate,
  principalOnly,
  rejectContentValidator,
  ContentController.rejectContent
);

router.delete('/:id', authenticate, staffOnly, ContentController.deleteContent);

module.exports = router;