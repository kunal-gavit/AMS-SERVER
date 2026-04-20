import { body } from "express-validator";

const imagePattern = /^(https?:\/\/|data:image\/(png|jpeg|jpg|webp);base64,)/i;

export const updateProfileValidator = [
  body("name").optional({ values: "falsy" }).trim().isLength({ min: 2, max: 80 }).withMessage("Name must be 2-80 characters"),
  body("profileImage")
    .optional()
    .isString()
    .withMessage("profileImage must be a string")
    .bail()
    .custom((value) => value === "" || imagePattern.test(value))
    .withMessage("profileImage must be a valid URL or base64 image"),
  body("branch").optional({ values: "falsy" }).trim().isLength({ min: 2, max: 60 }).withMessage("Invalid branch"),
  body("year").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 20 }).withMessage("Invalid year"),
  body("division").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 20 }).withMessage("Invalid division"),
  body("rollNo").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 30 }).withMessage("Invalid roll number"),
  body("department").optional({ values: "falsy" }).trim().isLength({ min: 2, max: 80 }).withMessage("Invalid department"),
  body("designation").optional({ values: "falsy" }).trim().isLength({ min: 2, max: 80 }).withMessage("Invalid designation"),
  body("subjects").optional().isArray().withMessage("subjects must be an array"),
  body("subjects.*").optional().trim().isLength({ min: 1, max: 120 }).withMessage("Each subject must be non-empty"),
];

export const changePasswordValidator = [
  body("oldPassword").notEmpty().withMessage("oldPassword is required"),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("newPassword must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("newPassword must include an uppercase letter")
    .matches(/[0-9]/)
    .withMessage("newPassword must include a number"),
];
