import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

// Models
import User from "../models/User.js";
import StudentProfile from "../models/StudentProfile.js";
import Subject from "../models/Subject.js";
import Lecture from "../models/Lecture.js";
import Attendance from "../models/Attendance.js";
import Enrollment from "../models/Enrollment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env") });

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for seeding...");

    // Clear existing data
    await User.deleteMany({});
    await StudentProfile.deleteMany({});
    await Subject.deleteMany({});
    await Lecture.deleteMany({});
    await Attendance.deleteMany({});
    await Enrollment.deleteMany({});
    console.log("Cleared existing data.");

    const rawData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../data.json"), "utf-8")
    );

    const idMap = {
      users: {}, // jsonId -> mongoId
      studentProfiles: {}, // jsonId -> mongoId
      subjects: {},
      lectures: {},
    };

    // 1. Seed Users
    console.log("Seeding users...");
    const usersToInsert = [];
    const userKeys = Object.keys(rawData.users);
    
    // Hash passwords first (batch hashing could be faster but let's do it simply)
    const salt = await bcrypt.genSalt(10);
    const hashedPwd = await bcrypt.hash("student123", salt); // Most students have this
    const hashedTeacherPwd = await bcrypt.hash("teacher123", salt);
    const hashedAdminPwd = await bcrypt.hash("admin123", salt);

    for (const key of userKeys) {
      const user = rawData.users[key];
      let pwd = hashedPwd;
      if (user.role === 'teacher') pwd = hashedTeacherPwd;
      if (user.role === 'admin') pwd = hashedAdminPwd;
      
      usersToInsert.push({
        name: user.name,
        email: user.email,
        password: pwd,
        role: user.role,
        createdAt: user.createdAt
      });
    }

    const insertedUsers = await User.insertMany(usersToInsert);
    // Map JSON IDs to Mongo IDs
    userKeys.forEach((key, index) => {
      idMap.users[key] = insertedUsers[index]._id;
    });
    console.log(`Inserted ${insertedUsers.length} users.`);

    // 2. Seed Student Profiles
    console.log("Seeding student profiles...");
    const studentProfilesToInsert = [];
    const studentKeys = Object.keys(rawData.students);

    for (const key of studentKeys) {
      const profile = rawData.students[key];
      studentProfilesToInsert.push({
        userId: idMap.users[profile.userId],
        branch: profile.branch,
        year: profile.year.toString(),
        division: profile.division,
        rollNo: profile.id.replace('student-', ''), // Use ID suffix as rollNo for now
      });
    }

    const insertedStudentProfiles = await StudentProfile.insertMany(studentProfilesToInsert);
    studentKeys.forEach((key, index) => {
      idMap.studentProfiles[key] = insertedStudentProfiles[index]._id;
    });
    console.log(`Inserted ${insertedStudentProfiles.length} student profiles.`);

    // 3. Seed Subjects
    console.log("Seeding subjects...");
    const subjectsToInsert = [];
    const subjectKeys = Object.keys(rawData.subjects);

    for (const key of subjectKeys) {
      const subject = rawData.subjects[key];
      // Note: teacherId in JSON refers to the teacher key in "teachers" object
      // Let's check how teachers are mapped.
      // In the JSON, teachers object has userId.
      const teacherObj = rawData.teachers[subject.teacherId];
      subjectsToInsert.push({
        name: subject.name,
        code: subject.code,
        facultyId: idMap.users[teacherObj.userId],
        branch: subject.branch,
        semester: subject.year * 2, // Approximate
      });
    }

    const insertedSubjects = await Subject.insertMany(subjectsToInsert);
    subjectKeys.forEach((key, index) => {
      idMap.subjects[key] = insertedSubjects[index]._id;
    });
    console.log(`Inserted ${insertedSubjects.length} subjects.`);

    // 4. Seed Lectures
    console.log("Seeding lectures...");
    const lecturesToInsert = [];
    const lectureKeys = Object.keys(rawData.lectures);

    for (const key of lectureKeys) {
      const lecture = rawData.lectures[key];
      lecturesToInsert.push({
        subjectId: idMap.subjects[lecture.subjectId],
        date: new Date(lecture.date),
        startTime: lecture.startTime,
        endTime: lecture.endTime,
      });
    }

    const insertedLectures = await Lecture.insertMany(lecturesToInsert);
    lectureKeys.forEach((key, index) => {
      idMap.lectures[key] = insertedLectures[index]._id;
    });
    console.log(`Inserted ${insertedLectures.length} lectures.`);

    // 4.5 Seed Enrollments
    console.log("Seeding enrollments...");
    const enrollmentsToInsert = [];
    const enrollmentKeys = Object.keys(rawData.enrollments);

    for (const key of enrollmentKeys) {
      const enrollment = rawData.enrollments[key];
      const studentObj = rawData.students[enrollment.studentId];
      const studentId = studentObj ? idMap.users[studentObj.userId] : null;
      const subjectId = idMap.subjects[enrollment.subjectId];

      if (studentId && subjectId) {
        enrollmentsToInsert.push({ studentId, subjectId });
      }
    }
    await Enrollment.insertMany(enrollmentsToInsert);
    console.log(`Inserted ${enrollmentsToInsert.length} enrollments.`);

    // 5. Seed Attendance
    console.log("Seeding attendance (this may take a while)...");
    const attendanceToInsert = [];
    const attendanceKeys = Object.keys(rawData.attendance);

    // Create a mapping of lectureId to subjectId for quick lookup
    const lectureToSubjectMap = {};
    Object.keys(rawData.lectures).forEach(key => {
      lectureToSubjectMap[key] = rawData.lectures[key].subjectId;
    });

    for (const key of attendanceKeys) {
      const att = rawData.attendance[key];
      const studentObj = rawData.students[att.studentId];
      const studentId = studentObj ? idMap.users[studentObj.userId] : null;
      const lectureId = idMap.lectures[att.lectureId];
      const jsonSubjectId = lectureToSubjectMap[att.lectureId];
      const subjectId = idMap.subjects[jsonSubjectId];

      if (studentId && lectureId && subjectId) {
        attendanceToInsert.push({
          studentId,
          subjectId,
          lectureId,
          status: att.status.charAt(0).toUpperCase() + att.status.slice(1),
          createdAt: new Date(att.markedAt)
        });
      }
    }

    // Insert in batches if too large
    const batchSize = 5000;
    for (let i = 0; i < attendanceToInsert.length; i += batchSize) {
      const batch = attendanceToInsert.slice(i, i + batchSize);
      await Attendance.insertMany(batch);
      console.log(`Inserted attendance batch ${i / batchSize + 1} of ${Math.ceil(attendanceToInsert.length / batchSize)}`);
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

seedData();
