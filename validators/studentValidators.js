import { body } from "express-validator";

const objectId = /^[0-9a-fA-F]{24}$/;

export const simulateValidator = [
  body("subjectId").matches(objectId).withMessage("Valid subjectId is required"),
  body("futureClasses").optional().isInt({ min: 0, max: 200 }).withMessage("futureClasses must be 0-200"),
  body("expectedPresenceRate").optional().isFloat({ min: 0, max: 1 }).withMessage("expectedPresenceRate must be 0 to 1"),
];
