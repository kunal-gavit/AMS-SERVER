import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, trim: true, uppercase: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    branch: { type: String, trim: true },
    semester: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subjectSchema.index({ name: 1, facultyId: 1 }, { unique: true });
subjectSchema.index({ code: 1 }, { unique: true, sparse: true });

const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;
