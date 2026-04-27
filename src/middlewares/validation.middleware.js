const { validationResult, body, param, query } = require("express-validator");

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
        value: e.value,
      })),
    });
  }
  next();
};

const allowedSubjects = ["math", "science","english","history","geography","physics","chemistry","biology","computer_science","physical_education"];

const registerValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2–100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain uppercase, lowercase, number, and special character",
    ),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["principal", "teacher"])
    .withMessage("Role must be principal or teacher"),

  validate,
];

const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email address")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  validate,
];

const uploadContentValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 3, max: 255 })
    .withMessage("Title must be 3–255 characters"),

  body("subject")
    .trim()
    .notEmpty()
    .withMessage("Subject is required")
    .toLowerCase()
    .isIn(allowedSubjects)
    .withMessage("Invalid subject. Allowed: math, science, english, history, geography, physics, chemistry, biology, computer_science, physical_education"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage("Description must not exceed 2000 characters"),

  body("start_time")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("start_time must be a valid ISO8601 date")
    .toDate(),

  body("end_time")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("end_time must be a valid ISO8601 date")
    .toDate()
    .custom((value, { req }) => {
      if (value && req.body.start_time) {
        if (new Date(value) <= new Date(req.body.start_time)) {
          throw new Error("end_time must be after start_time");
        }
      }
      return true;
    }),

  body("rotation_duration")
    .optional({ nullable: true })
    .isInt({ min: 1, max: 1440 })
    .withMessage("rotation_duration must be 1–1440 minutes"),

  validate,
];

const approveContentValidator = [
  param("id").notEmpty().withMessage("Content ID is required"),
  validate,
];

const rejectContentValidator = [
  param("id").notEmpty().withMessage("Content ID is required"),

  body("rejection_reason")
    .trim()
    .notEmpty()
    .withMessage("Rejection reason is required")
    .isLength({ min: 5, max: 1000 })
    .withMessage("Rejection reason must be 5–1000 characters"),

  validate,
];

const contentListQueryValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be 1–100"),

  query("status")
    .optional()
    .isIn(["uploaded", "pending", "approved", "rejected"])
    .withMessage("Invalid status value"),

  query("subject").optional().trim().isLength({ max: 100 }),

  validate,
];

module.exports = {
  validate,
  registerValidator,
  loginValidator,
  uploadContentValidator,
  approveContentValidator,
  rejectContentValidator,
  contentListQueryValidator,
};
