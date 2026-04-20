import { body } from "express-validator";

const allowedRoles = ["student", "teacher"];

export const registerValidator = [
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ min: 2 }).withMessage("Name is too short"),
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/[A-Z]/)
    .withMessage("Password must include an uppercase letter")
    .matches(/[0-9]/)
    .withMessage("Password must include a number"),
  body("role").isIn(allowedRoles).withMessage("Role must be student or teacher"),
  body("branch")
    .if(body("role").equals("student"))
    .trim()
    .notEmpty()
    .withMessage("Branch is required for students")
    .isLength({ min: 2 })
    .withMessage("Invalid branch"),
  body("year")
    .if(body("role").equals("student"))
    .trim()
    .notEmpty()
    .withMessage("Year is required for students"),
  body("division")
    .if(body("role").equals("student"))
    .trim()
    .notEmpty()
    .withMessage("Division is required for students"),
  body("rollNo")
    .if(body("role").equals("student"))
    .trim()
    .notEmpty()
    .withMessage("Roll number is required for students"),
];

export const loginValidator = [
  body("email").trim().isEmail().withMessage("Valid email is required").normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required"),
];
