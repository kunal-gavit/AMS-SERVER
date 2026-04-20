import express from "express";
import { 
  getAtRiskStudents,
  getLectureWiseAttendance,
  getTeacherDashboard,
  markAttendance, 
  getTeacherAnalytics, 
  getTeacherSubjects, 
  getStudentsInSubject 
} from "../controllers/teacherController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("teacher"));

router.get("/dashboard", getTeacherDashboard);
router.get("/subjects", getTeacherSubjects);
router.get("/students/:subjectId", getStudentsInSubject);
router.post("/mark", markAttendance);
router.get("/analytics/:subjectId", getTeacherAnalytics);
router.get("/at-risk/:subjectId", getAtRiskStudents);
router.get("/lectures/:subjectId", getLectureWiseAttendance);

export default router;
