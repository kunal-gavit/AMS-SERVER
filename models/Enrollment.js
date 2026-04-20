import mongoose from "mongoose";

const enrollmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
  },
  { timestamps: true }
);

enrollmentSchema.index({ studentId: 1, subjectId: 1 }, { unique: true });

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);
export default Enrollment;
