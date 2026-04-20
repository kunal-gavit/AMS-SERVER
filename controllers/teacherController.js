import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import Lecture from "../models/Lecture.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import { statusFromPercentage } from "../services/analyticsService.js";

const ensureTeacherSubjectAccess = async (teacherId, subjectId) => {
  const subject = await Subject.findOne({ _id: subjectId, facultyId: teacherId });
  return Boolean(subject);
};

export const getTeacherSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find({ facultyId: req.user._id, isActive: { $ne: false } }).select("name code branch semester");
    return res.json(subjects);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getStudentsInSubject = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const hasAccess = await ensureTeacherSubjectAccess(req.user._id, subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const enrollments = await Enrollment.find({ subjectId }).populate("studentId", "name email");
    const students = enrollments
      .filter((entry) => entry.studentId)
      .map((entry) => ({
        _id: entry.studentId._id,
        name: entry.studentId.name,
        email: entry.studentId.email,
      }));

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const markAttendance = async (req, res) => {
  try {
    const { subjectId, date, students, startTime = "09:00", endTime = "10:00", topic = "" } = req.body;

    if (!subjectId || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: "subjectId and students are required" });
    }

    const hasAccess = await ensureTeacherSubjectAccess(req.user._id, subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const lecture = await Lecture.create({
      subjectId,
      date: date ? new Date(date) : new Date(),
      startTime,
      endTime,
      topic,
      createdBy: req.user._id,
    });

    const enrolled = await Enrollment.find({
      subjectId,
      studentId: { $in: students.map((entry) => entry.id) },
    });

    const enrolledSet = new Set(enrolled.map((entry) => String(entry.studentId)));

    const docs = students
      .filter((entry) => enrolledSet.has(String(entry.id)))
      .map((entry) => ({
        studentId: entry.id,
        subjectId,
        lectureId: lecture._id,
        status: entry.status === "Absent" ? "Absent" : "Present",
      }));

    if (docs.length === 0) {
      return res.status(400).json({ message: "No enrolled students found in payload" });
    }

    await Attendance.insertMany(docs, { ordered: false });

    return res.status(201).json({
      message: "Attendance marked successfully",
      lectureId: lecture._id,
      records: docs.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getTeacherAnalytics = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const hasAccess = await ensureTeacherSubjectAccess(req.user._id, subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const enrollments = await Enrollment.find({ subjectId }).populate("studentId", "name email");

    const studentStats = await Promise.all(
      enrollments
        .filter((entry) => entry.studentId)
        .map(async (entry) => {
          const records = await Attendance.find({ studentId: entry.studentId._id, subjectId });
          const total = records.length;
          const attended = records.filter((record) => record.status === "Present").length;
          const percentage = total === 0 ? 0 : Number(((attended / total) * 100).toFixed(2));

          return {
            id: entry.studentId._id,
            name: entry.studentId.name,
            email: entry.studentId.email,
            attended,
            total,
            percentage,
            status: statusFromPercentage(percentage),
          };
        })
    );

    const classAverage =
      studentStats.length === 0
        ? 0
        : Number((studentStats.reduce((acc, item) => acc + item.percentage, 0) / studentStats.length).toFixed(2));

    return res.json({
      subjectId,
      classAverage,
      atRiskCount: studentStats.filter((item) => item.status === "At Risk").length,
      warningCount: studentStats.filter((item) => item.status === "Warning").length,
      safeCount: studentStats.filter((item) => item.status === "Safe").length,
      studentStats,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAtRiskStudents = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const threshold = Number(req.query.threshold || 75);

    const hasAccess = await ensureTeacherSubjectAccess(req.user._id, subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const enrollments = await Enrollment.find({ subjectId }).populate("studentId", "name email");

    const list = [];
    for (const enrollment of enrollments) {
      if (!enrollment.studentId) continue;
      const records = await Attendance.find({ studentId: enrollment.studentId._id, subjectId });
      const total = records.length;
      const attended = records.filter((item) => item.status === "Present").length;
      const percentage = total === 0 ? 0 : Number(((attended / total) * 100).toFixed(2));
      if (percentage < threshold) {
        list.push({
          studentId: enrollment.studentId._id,
          name: enrollment.studentId.name,
          email: enrollment.studentId.email,
          percentage,
          status: statusFromPercentage(percentage),
        });
      }
    }

    list.sort((a, b) => a.percentage - b.percentage);
    return res.json({ threshold, count: list.length, students: list });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getLectureWiseAttendance = async (req, res) => {
  try {
    const { subjectId } = req.params;
    const hasAccess = await ensureTeacherSubjectAccess(req.user._id, subjectId);
    if (!hasAccess) return res.status(403).json({ message: "Forbidden" });

    const lectures = await Lecture.find({ subjectId }).sort({ date: -1 });

    const result = await Promise.all(
      lectures.map(async (lecture) => {
        const rows = await Attendance.find({ lectureId: lecture._id }).populate("studentId", "name email");
        const present = rows.filter((row) => row.status === "Present").length;
        const absent = rows.length - present;

        return {
          lectureId: lecture._id,
          date: lecture.date,
          startTime: lecture.startTime,
          endTime: lecture.endTime,
          topic: lecture.topic,
          total: rows.length,
          present,
          absent,
          percentage: rows.length === 0 ? 0 : Number(((present / rows.length) * 100).toFixed(2)),
          students: rows.map((row) => ({
            studentId: row.studentId?._id,
            name: row.studentId?.name,
            email: row.studentId?.email,
            status: row.status,
          })),
        };
      })
    );

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getClassAnalytics = getTeacherAnalytics;

export const getTeacherDashboard = async (req, res) => {
  try {
    const subjects = await Subject.find({ facultyId: req.user._id, isActive: { $ne: false } }).select("name code");

    const aggregate = await Promise.all(
      subjects.map(async (subject) => {
        const enrollments = await Enrollment.find({ subjectId: subject._id });
        const studentIds = enrollments.map((entry) => entry.studentId);
        const records = await Attendance.find({ subjectId: subject._id, studentId: { $in: studentIds } });
        const total = records.length;
        const present = records.filter((row) => row.status === "Present").length;
        const percentage = total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));

        return {
          subjectId: subject._id,
          subject: subject.name,
          code: subject.code,
          enrolledStudents: studentIds.length,
          attendancePercentage: percentage,
          status: statusFromPercentage(percentage),
        };
      })
    );

    return res.json({
      teacherId: req.user._id,
      totalSubjects: subjects.length,
      subjects: aggregate,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
