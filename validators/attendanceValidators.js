import { body, param, query } from "express-validator";

const objectId = /^[0-9a-fA-F]{24}$/;

export const markAttendanceValidator = [
  body("subjectId").matches(objectId).withMessage("Valid subjectId is required"),
  body("date").optional().isISO8601().withMessage("date must be ISO-8601"),
  body("students").isArray({ min: 1 }).withMessage("students must be a non-empty array"),
  body("students.*.id").matches(objectId).withMessage("Each student id must be valid"),
  body("students.*.status").isIn(["Present", "Absent"]).withMessage("Status must be Present or Absent"),
];

export const attendanceQueryValidator = [
  query("studentId").optional().matches(objectId).withMessage("studentId must be valid"),
  query("subjectId").optional().matches(objectId).withMessage("subjectId must be valid"),
  query("date").optional().isISO8601().withMessage("date must be ISO-8601"),
];

export const attendanceByStudentValidator = [param("studentId").matches(objectId).withMessage("Invalid studentId")];
export const attendanceBySubjectValidator = [param("subjectId").matches(objectId).withMessage("Invalid subjectId")];
export const attendanceByDateValidator = [param("date").isISO8601().withMessage("Invalid date")];
export const attendanceByIdValidator = [param("id").matches(objectId).withMessage("Invalid attendance id")];

export const createAttendanceValidator = [
  body("studentId").matches(objectId).withMessage("Valid studentId is required"),
  body("subjectId").matches(objectId).withMessage("Valid subjectId is required"),
  body("lectureId").matches(objectId).withMessage("Valid lectureId is required"),
  body("status").isIn(["Present", "Absent"]).withMessage("status must be Present or Absent"),
];

export const updateAttendanceValidator = [
  body("status").isIn(["Present", "Absent"]).withMessage("status must be Present or Absent"),
];
