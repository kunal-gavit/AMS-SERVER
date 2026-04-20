import mongoose from "mongoose";

const lectureSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    date: { type: Date, default: Date.now },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "10:00" },
    topic: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

lectureSchema.index({ subjectId: 1, date: 1 });

const Lecture = mongoose.model("Lecture", lectureSchema);
export default Lecture;
