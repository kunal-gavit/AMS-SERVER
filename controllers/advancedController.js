import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import { generateWeeklyBand, statusFromPercentage } from "../services/analyticsService.js";
import { sendEmail } from "../services/emailService.js";
import { toCsv } from "../services/csvService.js";

export const getLeaderboard = async (req, res) => {
  try {
    const { subjectId, limit = 10 } = req.query;

    const enrollmentFilter = subjectId ? { subjectId } : {};
    const enrollments = await Enrollment.find(enrollmentFilter).populate("studentId", "name email").populate("subjectId", "name");

    const rankings = await Promise.all(
      enrollments
        .filter((entry) => entry.studentId && entry.subjectId)
        .map(async (entry) => {
          const records = await Attendance.find({
            studentId: entry.studentId._id,
            subjectId: entry.subjectId._id,
          });
          const total = records.length;
          const present = records.filter((r) => r.status === "Present").length;
          const percentage = total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));

          return {
            studentId: entry.studentId._id,
            name: entry.studentId.name,
            email: entry.studentId.email,
            subjectId: entry.subjectId._id,
            subject: entry.subjectId.name,
            attended: present,
            total,
            percentage,
          };
        })
    );

    rankings.sort((a, b) => b.percentage - a.percentage || b.attended - a.attended);
    const parsedLimit = Math.max(1, Number(limit));

    return res.json(rankings.slice(0, parsedLimit));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const exportAttendanceCsv = async (req, res) => {
  try {
    const { subjectId, studentId, from, to } = req.query;
    const filter = {};
    if (subjectId) filter.subjectId = subjectId;
    if (studentId) filter.studentId = studentId;

    const rows = await Attendance.find(filter)
      .populate("studentId", "name email")
      .populate("subjectId", "name code")
      .populate("lectureId", "date startTime endTime topic")
      .sort({ createdAt: -1 });

    const filtered = rows.filter((row) => {
      if (!row.lectureId?.date) return false;
      const date = new Date(row.lectureId.date);
      const fromOk = from ? date >= new Date(from) : true;
      const toOk = to ? date <= new Date(to) : true;
      return fromOk && toOk;
    });

    const csvRows = filtered.map((row) => ({
      studentName: row.studentId?.name || "",
      studentEmail: row.studentId?.email || "",
      subject: row.subjectId?.name || "",
      subjectCode: row.subjectId?.code || "",
      lectureDate: row.lectureId?.date ? new Date(row.lectureId.date).toISOString() : "",
      startTime: row.lectureId?.startTime || "",
      endTime: row.lectureId?.endTime || "",
      topic: row.lectureId?.topic || "",
      status: row.status,
      markedAt: row.createdAt.toISOString(),
    }));

    const csv = toCsv(csvRows, [
      { key: "studentName", label: "Student Name" },
      { key: "studentEmail", label: "Student Email" },
      { key: "subject", label: "Subject" },
      { key: "subjectCode", label: "Subject Code" },
      { key: "lectureDate", label: "Lecture Date" },
      { key: "startTime", label: "Start Time" },
      { key: "endTime", label: "End Time" },
      { key: "topic", label: "Topic" },
      { key: "status", label: "Status" },
      { key: "markedAt", label: "Marked At" },
    ]);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=attendance-export.csv");
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const sendLowAttendanceAlerts = async (req, res) => {
  try {
    const { threshold = 75 } = req.body;
    const students = await User.find({ role: "student" }).select("_id name email");

    const deliveries = [];

    for (const student of students) {
      const enrollments = await Enrollment.find({ studentId: student._id }).populate("subjectId", "name");
      let total = 0;
      let present = 0;

      for (const enrollment of enrollments) {
        const records = await Attendance.find({
          studentId: student._id,
          subjectId: enrollment.subjectId?._id,
        });
        total += records.length;
        present += records.filter((record) => record.status === "Present").length;
      }

      const percentage = total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));
      if (percentage >= threshold) continue;

      const result = await sendEmail({
        to: student.email,
        subject: "Attendance Alert - Immediate Action Required",
        text: `Hi ${student.name}, your attendance is ${percentage}%. Please improve to stay above ${threshold}%.`,
      });

      deliveries.push({
        studentId: student._id,
        email: student.email,
        percentage,
        sent: result.sent,
        reason: result.reason || null,
      });
    }

    return res.json({ threshold, alerts: deliveries.length, deliveries });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const generateWeeklyReport = async (req, res) => {
  try {
    const { subjectId } = req.query;

    const subjectFilter = subjectId ? { _id: subjectId } : {};
    const subjects = await Subject.find(subjectFilter).select("_id name code");
    const report = [];

    for (const subject of subjects) {
      const records = await Attendance.find({ subjectId: subject._id })
        .populate("lectureId", "date")
        .select("status lectureId");

      const normalizedRows = records
        .filter((item) => item.lectureId?.date)
        .map((item) => ({ date: item.lectureId.date, status: item.status }));

      const weekly = generateWeeklyBand(normalizedRows);
      const overallTotal = normalizedRows.length;
      const overallPresent = normalizedRows.filter((row) => row.status === "Present").length;
      const overallPercentage = overallTotal === 0 ? 0 : Number(((overallPresent / overallTotal) * 100).toFixed(2));

      report.push({
        subjectId: subject._id,
        subject: subject.name,
        code: subject.code,
        overallPercentage,
        status: statusFromPercentage(overallPercentage),
        weekly,
      });
    }

    return res.json({ generatedAt: new Date().toISOString(), report });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const listAtRiskStudents = async (req, res) => {
  try {
    const threshold = Number(req.query.threshold || 75);
    const students = await User.find({ role: "student" }).select("_id name email");
    const profiles = await StudentProfile.find({ userId: { $in: students.map((s) => s._id) } });

    const atRisk = [];

    for (const student of students) {
      const records = await Attendance.find({ studentId: student._id });
      const total = records.length;
      const present = records.filter((record) => record.status === "Present").length;
      const percentage = total === 0 ? 0 : Number(((present / total) * 100).toFixed(2));

      if (percentage < threshold) {
        const profile = profiles.find((p) => String(p.userId) === String(student._id));
        atRisk.push({
          studentId: student._id,
          name: student.name,
          email: student.email,
          branch: profile?.branch || "N/A",
          year: profile?.year || "N/A",
          rollNo: profile?.rollNo || "N/A",
          percentage,
        });
      }
    }

    atRisk.sort((a, b) => a.percentage - b.percentage);
    return res.json({ threshold, count: atRisk.length, students: atRisk });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
