import express from "express";
import {
  createAttendanceRecord,
  deleteAttendanceRecord,
  getAttendance,
  getAttendanceByDate,
  getAttendanceById,
  getAttendanceByStudent,
  getAttendanceBySubject,
  markAttendance,
  updateAttendanceRecord,
} from "../controllers/attendanceController.js";
import { authorize, protect } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  attendanceByIdValidator,
  attendanceByDateValidator,
  attendanceByStudentValidator,
  attendanceBySubjectValidator,
  attendanceQueryValidator,
  createAttendanceValidator,
  markAttendanceValidator,
  updateAttendanceValidator,
} from "../validators/attendanceValidators.js";

const router = express.Router();

router.use(protect);

router.get("/", attendanceQueryValidator, validateRequest, getAttendance);
router.get("/student/:studentId", attendanceByStudentValidator, validateRequest, getAttendanceByStudent);
router.get("/subject/:subjectId", attendanceBySubjectValidator, validateRequest, getAttendanceBySubject);
router.get("/date/:date", attendanceByDateValidator, validateRequest, getAttendanceByDate);
router.get("/:id", attendanceByIdValidator, validateRequest, getAttendanceById);

router.post("/", authorize("teacher", "admin"), createAttendanceValidator, validateRequest, createAttendanceRecord);
router.put("/:id", authorize("teacher", "admin"), attendanceByIdValidator, updateAttendanceValidator, validateRequest, updateAttendanceRecord);
router.delete("/:id", authorize("teacher", "admin"), attendanceByIdValidator, validateRequest, deleteAttendanceRecord);

router.post("/mark", authorize("teacher", "admin"), markAttendanceValidator, validateRequest, markAttendance);

export default router;
