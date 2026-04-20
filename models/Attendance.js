import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    lectureId: { type: mongoose.Schema.Types.ObjectId, ref: "Lecture", required: true },
    status: {
      type: String,
      enum: ["Present", "Absent"],
      required: true,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, lectureId: 1 }, { unique: true });
attendanceSchema.index({ studentId: 1, subjectId: 1, createdAt: -1 });
attendanceSchema.index({ subjectId: 1, createdAt: -1 });

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;
