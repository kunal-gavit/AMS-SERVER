import express from "express";
import {
	createLecture,
	createSubject,
	createUser,
	deleteLecture,
	deleteSubject,
	deleteUser,
	enrollStudent,
	getAllLectures,
	getAllSubjects,
	getSystemStats,
	listUsers,
	searchStudents,
	updateLecture,
	updateSubject,
	updateUser,
} from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.get("/stats", getSystemStats);
router.get("/search", searchStudents);
router.get("/subjects", getAllSubjects);
router.post("/subjects", createSubject);
router.put("/subjects/:id", updateSubject);
router.delete("/subjects/:id", deleteSubject);

router.get("/lectures", getAllLectures);
router.post("/lectures", createLecture);
router.put("/lectures/:id", updateLecture);
router.delete("/lectures/:id", deleteLecture);

router.get("/users", listUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

router.post("/enroll", enrollStudent);

export default router;
