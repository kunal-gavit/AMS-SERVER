import express from "express";
import {
  exportAttendanceCsv,
  generateWeeklyReport,
  getLeaderboard,
  listAtRiskStudents,
  sendLowAttendanceAlerts,
} from "../controllers/advancedController.js";
import { authorize, protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/leaderboard", getLeaderboard);
router.get("/at-risk", authorize("teacher", "admin"), listAtRiskStudents);
router.get("/weekly-report", authorize("teacher", "admin"), generateWeeklyReport);
router.get("/attendance/export", authorize("teacher", "admin"), exportAttendanceCsv);
router.post("/alerts/low-attendance", authorize("admin"), sendLowAttendanceAlerts);

export default router;
