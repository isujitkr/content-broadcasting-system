const ContentModel = require("../models/content.model");
const ContentSlotModel = require("../models/contentSlot.model");
const ContentScheduleModel = require("../models/contentSchedule.model");
const { invalidateTeacherCache } = require("../config/redis");
const uploadToCloudinary = require("../utils/cloudinary");

class ContentService {
  static async uploadContent(
    { title, description, subject, start_time, end_time, rotation_duration },
    file,
    userId,
  ) {
    if (!file) {
      const error = new Error("File is required");
      error.statusCode = 400;
      throw error;
    }

    const normalizedSubject = subject.toLowerCase().trim();

    
    const cloudinaryResult = await uploadToCloudinary(file.path);

    if(!cloudinaryResult || !cloudinaryResult.secure_url) {
      const error = new Error("Failed to upload file to Cloudinary");
      error.statusCode = 500;
      throw error;
    }
  
    const content = await ContentModel.create({
      title,
      description,
      subject: normalizedSubject,
      file_url: cloudinaryResult.secure_url,
      cloudinary_public_id: cloudinaryResult.public_id,
      file_type: file.mimetype,
      file_size: file.size,
      file_original_name: file.originalname,
      uploaded_by: userId,
      start_time: start_time || null,
      end_time: end_time || null,
    });

    const slot = await ContentSlotModel.findOrCreate(normalizedSubject);

    const maxOrder = await ContentScheduleModel.getMaxRotationOrder(slot.id);
    await ContentScheduleModel.upsert({
      content_id: content.id,
      slot_id: slot.id,
      rotation_order: maxOrder + 1,
      duration: parseInt(rotation_duration) || 5,
    });

    const liveUrl = `${process.env.BASE_URL}/live/${userId}`;

    return {
      ...content,
      live_url: liveUrl,
    };
  }

  static async getContentById(id) {
    const content = await ContentModel.findById(id);
    if (!content) {
      const error = new Error("Content not found");
      error.statusCode = 404;
      throw error;
    }
    return content;
  }

  static async getAllContent(filters, user) {
    if (user.role === "teacher") {
      filters.uploaded_by = user.id;
    }
    return ContentModel.findAll(filters);
  }

  static async getPendingContent({ limit, offset }) {
    return ContentModel.findPending({ limit, offset });
  }

  static async approveContent(contentId, principalId, ipAddress) {
    const content = await ContentModel.findById(contentId);

    if (!content) {
      const error = new Error("Content not found");
      error.statusCode = 404;
      throw error;
    }

    if (content.status !== "pending") {
      const error = new Error(
        `Cannot approve content with status: ${content.status}`,
      );
      error.statusCode = 400;
      throw error;
    }

    const updated = await ContentModel.approve(contentId, principalId);

    await invalidateTeacherCache(content.uploaded_by);

    return updated;
  }

  static async rejectContent(
    contentId,
    principalId,
    rejectionReason,
    ipAddress,
  ) {
    const content = await ContentModel.findById(contentId);

    if (!content) {
      const error = new Error("Content not found");
      error.statusCode = 404;
      throw error;
    }

    if (content.status !== "pending") {
      const error = new Error(
        `Cannot reject content with status: ${content.status}`,
      );
      error.statusCode = 400;
      throw error;
    }

    const updated = await ContentModel.reject(
      contentId,
      principalId,
      rejectionReason,
    );

    await ContentScheduleModel.deactivate(contentId);

    await invalidateTeacherCache(content.uploaded_by);

    return updated;
  }

  static async deleteContent(contentId, user, ipAddress) {
    const content = await ContentModel.findById(contentId);

    if (!content) {
      const error = new Error("Content not found");
      error.statusCode = 404;
      throw error;
    }

    if (user.role === "teacher" && content.uploaded_by !== user.id) {
      const error = new Error("You can only delete your own content");
      error.statusCode = 403;
      throw error;
    }

    // Delete from Cloudinary if public_id exists
    // if (content.file_path) {
    //   try {
    //     await deleteFromCloudinary(content.file_path);
    //   } catch (err) {
    //     console.error('Cloudinary deletion error (non-blocking):', err.message);
    //   }
    // }

    await ContentScheduleModel.deactivate(contentId);

    await ContentModel.softDelete(contentId);

    await invalidateTeacherCache(content.uploaded_by);

    return true;
  }

  static async getSubjects() {
    return ContentSlotModel.findAll();
  }
}

module.exports = ContentService;
