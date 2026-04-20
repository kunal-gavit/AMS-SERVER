import Attendance from "../models/Attendance.js";
import Lecture from "../models/Lecture.js";

const SAFE_THRESHOLD = 85;
const RISK_THRESHOLD = 75;

export const normalizePercentage = (value) => Number(value.toFixed(2));

export const statusFromPercentage = (percentage) => {
  if (percentage < RISK_THRESHOLD) return "At Risk";
  if (percentage < SAFE_THRESHOLD) return "Warning";
  return "Safe";
};

export const classesNeededForThreshold = (attended, total, threshold = RISK_THRESHOLD) => {
  const pct = total === 0 ? 0 : (attended / total) * 100;
  if (pct >= threshold) return 0;
  const numerator = (threshold / 100) * total - attended;
  const denominator = 1 - threshold / 100;
  return Math.max(0, Math.ceil(numerator / denominator));
};

export const predictFuturePercentage = (attended, total, futureLectures = 5, expectedPresenceRate = 0.8) => {
  const projectedPresent = attended + Math.round(futureLectures * expectedPresenceRate);
  const projectedTotal = total + futureLectures;
  if (projectedTotal <= 0) return 0;
  return normalizePercentage((projectedPresent / projectedTotal) * 100);
};

export const trendFromRecords = (records, sampleSize = 5) => {
  if (!Array.isArray(records) || records.length < sampleSize * 2) return "Stable";

  const normalize = (arr) => {
    if (arr.length === 0) return 0;
    const present = arr.filter((r) => r.status === "Present").length;
    return present / arr.length;
  };

  const previous = records.slice(-(sampleSize * 2), -sampleSize);
  const current = records.slice(-sampleSize);

  const previousRate = normalize(previous);
  const currentRate = normalize(current);

  if (currentRate > previousRate) return "Improving";
  if (currentRate < previousRate) return "Declining";
  return "Stable";
};

export const buildSubjectAnalytics = ({ subjectName, attendanceRecords, trendSampleSize = 5 }) => {
  const sorted = [...attendanceRecords].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const total = sorted.length;
  const attended = sorted.filter((record) => record.status === "Present").length;
  const percentage = total === 0 ? 0 : normalizePercentage((attended / total) * 100);

  return {
    subject: subjectName,
    total,
    attended,
    percentage,
    classesNeeded: classesNeededForThreshold(attended, total, RISK_THRESHOLD),
    status: statusFromPercentage(percentage),
    trend: trendFromRecords(sorted, trendSampleSize),
    prediction: {
      next5LecturesAt80pct: predictFuturePercentage(attended, total, 5, 0.8),
      next10LecturesAt80pct: predictFuturePercentage(attended, total, 10, 0.8),
    },
  };
};

export const getStudentSubjectSummary = async (studentId, subjectId, trendSampleSize = 5) => {
  const records = await Attendance.find({ studentId, subjectId }).sort({ createdAt: 1 });
  const lectureCount = await Lecture.countDocuments({ subjectId });
  const attended = records.filter((record) => record.status === "Present").length;
  const total = records.length;
  const percentage = total === 0 ? 0 : normalizePercentage((attended / total) * 100);

  return {
    lectureCount,
    total,
    attended,
    percentage,
    classesNeeded: classesNeededForThreshold(attended, total, RISK_THRESHOLD),
    status: statusFromPercentage(percentage),
    trend: trendFromRecords(records, trendSampleSize),
    prediction: {
      next5LecturesAt80pct: predictFuturePercentage(attended, total, 5, 0.8),
      next10LecturesAt80pct: predictFuturePercentage(attended, total, 10, 0.8),
    },
  };
};

export const generateWeeklyBand = (rows) => {
  const grouped = {};
  rows.forEach((item) => {
    const week = new Date(item.date);
    const day = week.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    week.setUTCDate(week.getUTCDate() - diffToMonday);
    week.setUTCHours(0, 0, 0, 0);
    const key = week.toISOString().split("T")[0];
    if (!grouped[key]) grouped[key] = { present: 0, total: 0 };
    grouped[key].total += 1;
    if (item.status === "Present") grouped[key].present += 1;
  });

  return Object.entries(grouped)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([weekStart, data]) => ({
      weekStart,
      percentage: data.total === 0 ? 0 : normalizePercentage((data.present / data.total) * 100),
      total: data.total,
      present: data.present,
    }));
};
