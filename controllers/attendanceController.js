import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import Lecture from "../models/Lecture.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";

const parseDateStartEnd = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const ensureTeacherOwnsSubject = async (user, subjectId) => {
  if (user.role === "admin") return true;
  const subject = await Subject.findOne({ _id: subjectId, facultyId: user._id });
  return Boolean(subject);
};

export const markAttendance = async (req, res) => {
  try {
    const { subjectId, date, students, startTime = "09:00", endTime = "10:00", topic = "" } = req.body;

    if (!subjectId || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: "subjectId and non-empty students array are required" });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });

    const hasAccess = await ensureTeacherOwnsSubject(req.user, subjectId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Not authorized to mark attendance for this subject" });
    }

    const lectureDate = date ? new Date(date) : new Date();
    if (Number.isNaN(lectureDate.getTime())) {
      return res.status(400).json({ message: "Invalid lecture date" });
    }

    const lecture = await Lecture.create({
      subjectId,
      date: lectureDate,
      startTime,
      endTime,
      topic,
      createdBy: req.user._id,
    });

    const studentIds = students.map((entry) => entry.id);
    const enrollments = await Enrollment.find({ studentId: { $in: studentIds }, subjectId });
    const allowedSet = new Set(enrollments.map((entry) => String(entry.studentId)));

    const records = students
      .filter((entry) => allowedSet.has(String(entry.id)))
      .map((entry) => ({
        studentId: entry.id,
        subjectId,
        lectureId: lecture._id,
        status: entry.status === "Absent" ? "Absent" : "Present",
      }));

    if (records.length === 0) {
      return res.status(400).json({ message: "No valid enrolled students in request" });
    }

    await Attendance.insertMany(records, { ordered: false });

    return res.status(201).json({
      message: "Attendance marked successfully",
      lectureId: lecture._id,
      recordedCount: records.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAttendance = async (req, res) => {
  try {
    const { studentId, subjectId, date } = req.query;

    const filter = {};
    if (studentId) filter.studentId = studentId;
    if (subjectId) filter.subjectId = subjectId;

    if (req.user.role === "student") {
      filter.studentId = req.user._id;
    }

    let lectureFilter = null;
    if (date) {
      const range = parseDateStartEnd(date);
      if (!range) return res.status(400).json({ message: "Invalid date filter" });
      lectureFilter = { date: { $gte: range.start, $lte: range.end } };
    }

    const query = Attendance.find(filter)
      .populate("studentId", "name email")
      .populate("subjectId", "name code")
      .populate({
        path: "lectureId",
        select: "date startTime endTime topic",
        match: lectureFilter || {},
      })
      .sort({ createdAt: -1 });

    const rows = await query;
    const filteredRows = rows.filter((row) => row.lectureId);

    return res.json(filteredRows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAttendanceByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (req.user.role === "student" && String(req.user._id) !== String(studentId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const student = await User.findById(studentId).select("name email role");
    if (!student || student.role !== "student") return res.status(404).json({ message: "Student not found" });

    const records = await Attendance.find({ studentId })
      .populate("subjectId", "name code")
      .populate("lectureId", "date startTime endTime topic")
      .sort({ createdAt: -1 });

    return res.json({ student, total: records.length, records });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAttendanceBySubject = async (req, res) => {
  try {
    const { subjectId } = req.params;

    const hasAccess = await ensureTeacherOwnsSubject(req.user, subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const records = await Attendance.find({ subjectId })
      .populate("studentId", "name email")
      .populate("lectureId", "date startTime endTime topic")
      .sort({ createdAt: -1 });

    return res.json({ total: records.length, records });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAttendanceByDate = async (req, res) => {
  try {
    const { date } = req.params;
    const range = parseDateStartEnd(date);
    if (!range) return res.status(400).json({ message: "Invalid date" });

    const lectures = await Lecture.find({ date: { $gte: range.start, $lte: range.end } }).select("_id");
    const lectureIds = lectures.map((lecture) => lecture._id);

    const records = await Attendance.find({ lectureId: { $in: lectureIds } })
      .populate("studentId", "name email")
      .populate("subjectId", "name code")
      .populate("lectureId", "date startTime endTime topic")
      .sort({ createdAt: -1 });

    return res.json({ date, total: records.length, records });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const createAttendanceRecord = async (req, res) => {
  try {
    const { studentId, subjectId, lectureId, status } = req.body;

    const lecture = await Lecture.findById(lectureId);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    if (String(lecture.subjectId) !== String(subjectId)) {
      return res.status(400).json({ message: "lectureId does not belong to subjectId" });
    }

    const hasAccess = await ensureTeacherOwnsSubject(req.user, subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const isEnrolled = await Enrollment.findOne({ studentId, subjectId });
    if (!isEnrolled) {
      return res.status(400).json({ message: "Student is not enrolled in this subject" });
    }

    const existing = await Attendance.findOne({ studentId, lectureId });
    if (existing) {
      return res.status(400).json({ message: "Attendance already exists for this student and lecture" });
    }

    const record = await Attendance.create({ studentId, subjectId, lectureId, status });
    return res.status(201).json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id)
      .populate("studentId", "name email")
      .populate("subjectId", "name code")
      .populate("lectureId", "date startTime endTime topic");

    if (!record) return res.status(404).json({ message: "Attendance record not found" });

    if (req.user.role === "student" && String(record.studentId?._id) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "teacher") {
      const hasAccess = await ensureTeacherOwnsSubject(req.user, record.subjectId?._id || record.subjectId);
      if (!hasAccess) return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const updateAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ message: "Attendance record not found" });

    const hasAccess = await ensureTeacherOwnsSubject(req.user, record.subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    if (status) record.status = status;
    await record.save();

    return res.json(record);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteAttendanceRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ message: "Attendance record not found" });

    const hasAccess = await ensureTeacherOwnsSubject(req.user, record.subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    await record.deleteOne();
    return res.json({ message: "Attendance record deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
